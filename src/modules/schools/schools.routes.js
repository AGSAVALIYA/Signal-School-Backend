const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');
const { Organization, School, UserSchool, sequelize } = require('../../db/models');
const storage = require('../../utils/storage');
const audit = require('../../utils/audit');
const { notFound } = require('../../utils/errors');
const { todayIn } = require('../../utils/dates');

const text = z.string().trim().max(300);
const schoolFields = z.object({
  name: text.min(1).optional(),
  address: text.nullish(),
  contactNumber: text.nullish(),
  location: text.nullish(),
  udiseCode: text.nullish(),
  defaultLanguage: z.enum(['en', 'hi', 'mr', 'gu']).optional(),
  grPrefix: z.string().max(20).optional(),
  attendanceEditDays: z.number().int().min(0).max(60).optional(),
  weeklyOffs: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});

const schoolDto = async (s) => ({ ...s.toJSON(), logoUrl: await storage.urlFor(s.logoKey) });

router.get('/organization', async (req, res) => {
  res.json({ data: await Organization.findByPk(req.school.organizationId) });
});

router.patch(
  '/organization',
  requirePerm('org.manage'),
  validate({ body: z.object({ name: text.min(1).optional(), headOffice: text.nullish(), contactNumber: text.nullish() }) }),
  async (req, res) => {
    const org = await Organization.findByPk(req.school.organizationId);
    await org.update(req.v.body);
    await audit(req, 'organization.update', { entityType: 'organization', entityId: org.id, after: req.v.body });
    res.json({ data: org });
  },
);

// Owner overview across all schools of the organization.
router.get('/organization/summary', requirePerm('org.manage'), async (req, res) => {
  const rows = await sequelize.query(
    `SELECT s.id, s.name, s.status,
       (SELECT count(*) FROM enrollments e JOIN academic_years y ON y.id = e.academic_year_id AND y.status = 'active'
          WHERE e.school_id = s.id AND e.status = 'active')::int AS students,
       (SELECT count(*) FROM user_schools us JOIN users u ON u.id = us.user_id AND u.status = 'active'
          WHERE us.school_id = s.id AND us.role = 'teacher')::int AS teachers,
       (SELECT round(100.0 * sum(present_count + late_count) / nullif(sum(present_count + late_count + absent_count + leave_count), 0))
          FROM attendance_sessions a WHERE a.school_id = s.id AND a.date > current_date - 30)::int AS attendance_rate_30d,
       (SELECT round(100.0 * count(tc.id) / nullif(count(t.id), 0))
          FROM topics t JOIN chapters c ON c.id = t.chapter_id JOIN subjects sb ON sb.id = c.subject_id
          JOIN academic_years y ON y.id = sb.academic_year_id AND y.status = 'active'
          LEFT JOIN topic_completions tc ON tc.topic_id = t.id WHERE t.school_id = s.id)::int AS syllabus_percent
     FROM schools s WHERE s.organization_id = :org ORDER BY s.name`,
    { replacements: { org: req.school.organizationId }, type: QueryTypes.SELECT },
  );
  res.json({ data: rows, meta: { date: todayIn(req.school.timezone) } });
});

router.post('/schools', requirePerm('org.manage'), validate({ body: schoolFields.extend({ name: text.min(1) }) }), async (req, res) => {
  const school = await sequelize.transaction(async (transaction) => {
    const s = await School.create({ ...req.v.body, organizationId: req.school.organizationId }, { transaction });
    // Every owner of the organization gets access to the new school.
    const owners = await UserSchool.findAll({
      where: { role: 'owner' },
      include: [{ model: School, where: { organizationId: req.school.organizationId }, attributes: [] }],
      transaction,
    });
    const ownerIds = [...new Set([req.user.id, ...owners.map((o) => o.userId)])];
    await UserSchool.bulkCreate(
      ownerIds.map((userId) => ({ userId, schoolId: s.id, role: 'owner' })),
      { transaction, ignoreDuplicates: true },
    );
    return s;
  });
  await audit(req, 'school.create', { entityType: 'school', entityId: school.id, summary: school.name });
  res.status(201).json({ data: await schoolDto(school) });
});

router.get('/school', async (req, res) => res.json({ data: await schoolDto(req.school) }));

router.patch(
  '/school',
  requirePerm('school.manage'),
  validate({ body: schoolFields.extend({ status: z.enum(['active', 'archived']).optional() }) }),
  async (req, res) => {
    if (req.v.body.status && req.role !== 'owner') delete req.v.body.status;
    const before = req.school.toJSON();
    await req.school.update(req.v.body);
    await audit(req, 'school.update', { entityType: 'school', entityId: req.school.id, before, after: req.v.body });
    res.json({ data: await schoolDto(req.school) });
  },
);

router.post('/school/logo', requirePerm('school.manage'), upload.image('logo'), async (req, res) => {
  const key = await storage.saveImage(req.file.buffer, `schools/${req.school.id}`);
  await storage.remove(req.school.logoKey);
  await req.school.update({ logoKey: key });
  res.json({ data: await schoolDto(req.school) });
});

router.get('/schools', async (req, res) => {
  const where = req.role === 'owner' ? { organizationId: req.school.organizationId } : { id: req.user.memberships.map((m) => m.schoolId) };
  const schools = await School.findAll({ where, order: [['name', 'ASC']] });
  if (!schools.length) throw notFound();
  res.json({ data: await Promise.all(schools.map(schoolDto)) });
});

module.exports = router;
