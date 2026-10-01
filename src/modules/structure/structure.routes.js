const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const { Grade, ClassSection, Subject, ActivityGroup, ActivityMember, Enrollment, TeacherAssignment, User, sequelize } = require('../../db/models');
const audit = require('../../utils/audit');
const { findInSchool, assertYearWritable } = require('../../utils/scope');
const { conflict, badRequest } = require('../../utils/errors');

const name = z.string().trim().min(1).max(100);
const translations = z.record(z.string(), z.string().max(100)).optional();
const manage = requirePerm('structure.manage');

// ---- Grades (permanent levels such as "Std 1") ----
router.get('/grades', async (req, res) => {
  res.json({
    data: await Grade.findAll({
      where: { schoolId: req.school.id },
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    }),
  });
});

const gradeBody = z.object({
  name,
  nameTranslations: translations,
  sortOrder: z.number().int().optional(),
  nextGradeId: z.number().int().nullish(),
  isFinal: z.boolean().optional(),
});

router.post('/grades', manage, validate({ body: gradeBody }), async (req, res) => {
  const max = (await Grade.max('sortOrder', { where: { schoolId: req.school.id } })) ?? -1;
  const grade = await Grade.create({ sortOrder: max + 1, ...req.v.body, schoolId: req.school.id });
  await audit(req, 'grade.create', { entityType: 'grade', entityId: grade.id, summary: grade.name });
  res.status(201).json({ data: grade });
});

router.patch('/grades/:id', manage, validate({ body: gradeBody.partial() }), async (req, res) => {
  const grade = await findInSchool(Grade, req.params.id, req);
  if (req.v.body.nextGradeId) await findInSchool(Grade, req.v.body.nextGradeId, req);
  await grade.update(req.v.body);
  res.json({ data: grade });
});

// Reorder in one call: [{id, sortOrder}]
router.put('/grades/order', manage, validate({ body: z.array(z.object({ id: z.number().int(), sortOrder: z.number().int() })) }), async (req, res) => {
  await sequelize.transaction((transaction) =>
    Promise.all(req.v.body.map(({ id, sortOrder }) => Grade.update({ sortOrder }, { where: { id, schoolId: req.school.id }, transaction }))),
  );
  res.status(204).end();
});

router.delete('/grades/:id', manage, async (req, res) => {
  const grade = await findInSchool(Grade, req.params.id, req);
  await grade.destroy();
  res.status(204).end();
});

// ---- Class sections (a grade in a year) ----
router.get('/sections', yearScope(), async (req, res) => {
  const sections = await ClassSection.findAll({
    where: { schoolId: req.school.id, academicYearId: req.year.id },
    include: [
      { model: Grade, attributes: ['id', 'name', 'nameTranslations', 'sortOrder'] },
      { model: Subject, attributes: ['id', 'name', 'nameTranslations', 'sortOrder'] },
      { model: TeacherAssignment, include: [{ model: User, attributes: ['id', 'name'] }] },
    ],
    order: [
      [Grade, 'sortOrder', 'ASC'],
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
      [Subject, 'sortOrder', 'ASC'],
      [Subject, 'name', 'ASC'],
    ],
  });
  const counts = await sequelize.query(
    `SELECT class_section_id AS id, count(*)::int AS n FROM enrollments WHERE academic_year_id = :y AND status = 'active' GROUP BY 1`,
    { replacements: { y: req.year.id }, type: QueryTypes.SELECT },
  );
  const byId = Object.fromEntries(counts.map((c) => [c.id, c.n]));
  res.json({
    data: sections.map((s) => {
      const j = s.toJSON();
      const classTeacher = j.TeacherAssignments.find((a) => a.role === 'class_teacher');
      return { ...j, studentCount: byId[s.id] || 0, classTeacher: classTeacher ? classTeacher.User : null };
    }),
  });
});

const sectionBody = z.object({ gradeId: z.number().int(), name: name.optional(), sortOrder: z.number().int().optional() });

router.post('/sections', manage, yearScope(), validate({ body: sectionBody }), async (req, res) => {
  assertYearWritable(req.year);
  const grade = await findInSchool(Grade, req.v.body.gradeId, req);
  const section = await ClassSection.create({ name: grade.name, ...req.v.body, schoolId: req.school.id, academicYearId: req.year.id });
  await audit(req, 'section.create', { entityType: 'section', entityId: section.id, summary: section.name });
  res.status(201).json({ data: section });
});

router.patch('/sections/:id', manage, validate({ body: sectionBody.partial() }), async (req, res) => {
  const section = await findInSchool(ClassSection, req.params.id, req);
  assertYearWritable(await section.getAcademicYear());
  if (req.v.body.gradeId) await findInSchool(Grade, req.v.body.gradeId, req);
  await section.update(req.v.body);
  res.json({ data: section });
});

router.delete('/sections/:id', manage, async (req, res) => {
  const section = await findInSchool(ClassSection, req.params.id, req);
  assertYearWritable(await section.getAcademicYear());
  if (await Enrollment.count({ where: { classSectionId: section.id } })) throw conflict('IN_USE');
  await section.destroy();
  await audit(req, 'section.delete', { entityType: 'section', entityId: section.id, summary: section.name });
  res.status(204).end();
});

// ---- Subjects ----
const subjectBody = z.object({ classSectionId: z.number().int(), name, nameTranslations: translations, sortOrder: z.number().int().optional() });

router.post('/subjects', manage, validate({ body: subjectBody }), async (req, res) => {
  const section = await findInSchool(ClassSection, req.v.body.classSectionId, req);
  assertYearWritable(await section.getAcademicYear());
  const subject = await Subject.create({ ...req.v.body, schoolId: req.school.id, academicYearId: section.academicYearId });
  res.status(201).json({ data: subject });
});

router.patch('/subjects/:id', manage, validate({ body: subjectBody.omit({ classSectionId: true }).partial() }), async (req, res) => {
  const subject = await findInSchool(Subject, req.params.id, req);
  await subject.update(req.v.body);
  res.json({ data: subject });
});

router.delete('/subjects/:id', manage, async (req, res) => {
  const subject = await findInSchool(Subject, req.params.id, req);
  const [{ used }] = await sequelize.query(
    `SELECT (EXISTS (SELECT 1 FROM report_entries WHERE subject_id = :id)
          OR EXISTS (SELECT 1 FROM topic_completions tc JOIN topics t ON t.id = tc.topic_id JOIN chapters c ON c.id = t.chapter_id WHERE c.subject_id = :id)) AS used`,
    { replacements: { id: subject.id }, type: QueryTypes.SELECT },
  );
  if (used) throw conflict('IN_USE');
  await subject.destroy();
  await audit(req, 'subject.delete', { entityType: 'subject', entityId: subject.id, summary: subject.name });
  res.status(204).end();
});

// ---- Activities (extra subjects / clubs) ----
router.get('/activities', yearScope(), async (req, res) => {
  const rows = await sequelize.query(
    `SELECT g.id, g.name, g.name_translations AS "nameTranslations", count(m.enrollment_id)::int AS "memberCount"
     FROM activity_groups g LEFT JOIN activity_members m ON m.activity_group_id = g.id
     WHERE g.academic_year_id = :y AND g.school_id = :s GROUP BY g.id ORDER BY g.name`,
    { replacements: { y: req.year.id, s: req.school.id }, type: QueryTypes.SELECT },
  );
  res.json({ data: rows });
});

router.post('/activities', manage, yearScope(), validate({ body: z.object({ name, nameTranslations: translations }) }), async (req, res) => {
  assertYearWritable(req.year);
  res.status(201).json({ data: await ActivityGroup.create({ ...req.v.body, schoolId: req.school.id, academicYearId: req.year.id }) });
});

router.patch('/activities/:id', manage, validate({ body: z.object({ name: name.optional(), nameTranslations: translations }) }), async (req, res) => {
  const group = await findInSchool(ActivityGroup, req.params.id, req);
  await group.update(req.v.body);
  res.json({ data: group });
});

router.delete('/activities/:id', manage, async (req, res) => {
  await (await findInSchool(ActivityGroup, req.params.id, req)).destroy();
  res.status(204).end();
});

// Replace the member list of an activity in one call.
router.put('/activities/:id/members', manage, validate({ body: z.object({ enrollmentIds: z.array(z.number().int()).max(5000) }) }), async (req, res) => {
  const group = await findInSchool(ActivityGroup, req.params.id, req);
  const ids = [...new Set(req.v.body.enrollmentIds)];
  const valid = await Enrollment.count({ where: { id: ids, academicYearId: group.academicYearId, schoolId: req.school.id } });
  if (valid !== ids.length) throw badRequest('VALIDATION', { fields: { enrollmentIds: 'INVALID' } });
  await sequelize.transaction(async (transaction) => {
    await ActivityMember.destroy({ where: { activityGroupId: group.id }, transaction });
    await ActivityMember.bulkCreate(
      ids.map((enrollmentId) => ({ activityGroupId: group.id, enrollmentId })),
      { transaction },
    );
  });
  res.json({ data: { memberCount: ids.length } });
});

router.get('/activities/:id/members', async (req, res) => {
  const group = await findInSchool(ActivityGroup, req.params.id, req);
  const rows = await ActivityMember.findAll({ where: { activityGroupId: group.id }, attributes: ['enrollmentId'] });
  res.json({ data: rows.map((r) => r.enrollmentId) });
});

module.exports = router;
