const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm } = require('../../middlewares/auth');
const { AcademicYear, ClassSection, sequelize } = require('../../db/models');
const audit = require('../../utils/audit');
const { findInSchool } = require('../../utils/scope');
const { conflict, badRequest } = require('../../utils/errors');
const { ISO } = require('../../utils/dates');
const svc = require('./rollover.service');

const manage = requirePerm('years.manage');
const date = z.string().regex(ISO);
const yearBody = z
  .object({ name: z.string().trim().min(1).max(30), startDate: date, endDate: date })
  .refine((b) => b.startDate < b.endDate, { path: ['endDate'], message: 'END_BEFORE_START' });

router.get('/academic-years', async (req, res) => {
  const rows = await sequelize.query(
    `SELECT y.id, y.name, y.start_date AS "startDate", y.end_date AS "endDate", y.status, y.unlocked_until AS "unlockedUntil",
       (SELECT count(*) FROM class_sections s WHERE s.academic_year_id = y.id)::int AS "sectionCount",
       (SELECT count(*) FROM enrollments e WHERE e.academic_year_id = y.id AND e.status = 'active')::int AS "studentCount"
     FROM academic_years y WHERE y.school_id = :s ORDER BY y.start_date DESC`,
    { replacements: { s: req.school.id }, type: QueryTypes.SELECT },
  );
  res.json({ data: rows });
});

router.post('/academic-years', manage, validate({ body: yearBody }), async (req, res) => {
  const year = await sequelize.transaction(async (transaction) => {
    await svc.assertNoOverlap(req.school.id, req.v.body.startDate, req.v.body.endDate, transaction);
    const hasActive = await AcademicYear.count({ where: { schoolId: req.school.id, status: 'active' }, transaction });
    // The very first year of a school becomes current immediately.
    return AcademicYear.create({ ...req.v.body, schoolId: req.school.id, status: hasActive ? 'planned' : 'active' }, { transaction });
  });
  await audit(req, 'year.create', { entityType: 'year', entityId: year.id, summary: year.name });
  res.status(201).json({ data: year });
});

router.patch('/academic-years/:id', manage, validate({ body: yearBody }), async (req, res) => {
  const year = await findInSchool(AcademicYear, req.params.id, req);
  await sequelize.transaction(async (transaction) => {
    await svc.assertNoOverlap(req.school.id, req.v.body.startDate, req.v.body.endDate, transaction, year.id);
    await year.update(req.v.body, { transaction });
  });
  await audit(req, 'year.update', { entityType: 'year', entityId: year.id, after: req.v.body });
  res.json({ data: year });
});

router.delete('/academic-years/:id', manage, async (req, res) => {
  const year = await findInSchool(AcademicYear, req.params.id, req);
  const [{ hasData }] = await sequelize.query(
    `SELECT EXISTS (SELECT 1 FROM attendance WHERE academic_year_id = :id) OR EXISTS (SELECT 1 FROM enrollments WHERE academic_year_id = :id) AS "hasData"`,
    { replacements: { id: year.id }, type: QueryTypes.SELECT },
  );
  if (year.status !== 'planned' || hasData) throw conflict('YEAR_HAS_DATA');
  await year.destroy();
  await audit(req, 'year.delete', { entityType: 'year', entityId: year.id, summary: year.name });
  res.status(204).end();
});

router.post('/academic-years/:id/activate', manage, async (req, res) => {
  const year = await findInSchool(AcademicYear, req.params.id, req);
  await sequelize.transaction((transaction) => svc.activateYear(year, transaction));
  await audit(req, 'year.activate', { entityType: 'year', entityId: year.id, summary: year.name });
  res.json({ data: year });
});

router.post('/academic-years/:id/close', manage, async (req, res) => {
  const year = await findInSchool(AcademicYear, req.params.id, req);
  await year.update({ status: 'closed', closedAt: new Date(), unlockedUntil: null });
  await audit(req, 'year.close', { entityType: 'year', entityId: year.id, summary: year.name });
  res.json({ data: year });
});

// Temporary write access to a closed year for corrections; always audited with a reason.
router.post(
  '/academic-years/:id/unlock',
  manage,
  validate({ body: z.object({ minutes: z.number().int().min(5).max(240), reason: z.string().trim().min(3).max(300) }) }),
  async (req, res) => {
    const year = await findInSchool(AcademicYear, req.params.id, req);
    if (year.status !== 'closed') throw badRequest('VALIDATION');
    await year.update({ unlockedUntil: new Date(Date.now() + req.v.body.minutes * 60000) });
    await audit(req, 'year.unlock', { entityType: 'year', entityId: year.id, summary: req.v.body.reason });
    res.json({ data: year });
  },
);

// ---- Rollover ----
router.post(
  '/academic-years/rollover/preview',
  manage,
  validate({ body: z.object({ sourceYearId: z.number().int(), name: z.string().trim().min(1).max(30), startDate: date, endDate: date }) }),
  async (req, res) => {
    const { sourceYearId, ...meta } = req.v.body;
    res.json({ data: await svc.buildPlan(req.school.id, sourceYearId, meta) });
  },
);

const planSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  plan: z.object({
    sourceYearId: z.number().int(),
    name: z.string().trim().min(1).max(30),
    startDate: date,
    endDate: date,
    activate: z.boolean(),
    copy: z.object({ subjects: z.boolean(), syllabus: z.boolean(), assignments: z.boolean() }),
    sections: z
      .array(
        z.object({
          key: z.string(),
          sourceId: z.number().int().nullish(),
          gradeId: z.number().int(),
          name: z.string().trim().min(1).max(100),
          include: z.boolean(),
        }),
      )
      .max(500),
    promotions: z
      .array(
        z.object({
          enrollmentId: z.number().int(),
          action: z.enum(['promote', 'detain', 'leave', 'graduate']),
          targetKey: z.string().nullish(),
          reason: z.string().nullish(),
        }),
      )
      .max(20000),
  }),
});

router.post('/academic-years/rollover', manage, validate({ body: planSchema }), async (req, res) => {
  const { plan, idempotencyKey } = req.v.body;
  if (plan.startDate >= plan.endDate) throw badRequest('VALIDATION', { fields: { endDate: 'INVALID' } });
  const summary = await svc.applyPlan(req.school.id, req.user.id, plan, idempotencyKey);
  await audit(req, 'year.rollover', { entityType: 'year', entityId: summary.academicYearId, after: summary });
  res.status(201).json({ data: summary });
});

// Promote students later (e.g. joined the old year after the wizard ran).
router.post(
  '/academic-years/:id/promotions',
  manage,
  validate({
    body: z.object({
      items: z
        .array(
          z.object({
            enrollmentId: z.number().int(),
            action: z.enum(['promote', 'detain', 'leave', 'graduate']),
            targetSectionId: z.number().int().nullish(),
            reason: z.string().nullish(),
          }),
        )
        .min(1)
        .max(5000),
    }),
  }),
  async (req, res) => {
    const year = await findInSchool(AcademicYear, req.params.id, req);
    await sequelize.transaction(async (transaction) => {
      for (const item of req.v.body.items) {
        if (item.targetSectionId) {
          const target = await ClassSection.findOne({ where: { id: item.targetSectionId, academicYearId: year.id }, transaction });
          if (!target) throw badRequest('ROLLOVER_INVALID');
        }
        await svc.applyPromotion(item, { targetYear: year, targetSectionId: item.targetSectionId, transaction });
      }
    });
    await audit(req, 'year.promotions', { entityType: 'year', entityId: year.id, summary: `${req.v.body.items.length} students` });
    res.json({ data: { processed: req.v.body.items.length } });
  },
);

module.exports = router;
