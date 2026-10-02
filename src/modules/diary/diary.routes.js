const router = require('express').Router();
const { z } = require('zod');
const { Op, QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');
const m = require('../../db/models');
const storage = require('../../utils/storage');
const audit = require('../../utils/audit');
const { findInSchool, assertSectionWrite, assertYearWritable, isStaff } = require('../../utils/scope');
const { badRequest, forbidden } = require('../../utils/errors');
const { ISO, todayIn } = require('../../utils/dates');

// Multipart forms send fields as strings; subjectIds arrives as JSON or comma list.
const body = z.object({
  note: z.string().trim().max(2000).optional().default(''),
  subjectIds: z
    .union([z.array(z.coerce.number().int()), z.string()])
    .optional()
    .transform((v) =>
      Array.isArray(v)
        ? v
        : v
          ? String(v)
              .replace(/[[\]\s]/g, '')
              .split(',')
              .filter(Boolean)
              .map(Number)
          : [],
    ),
  removePhoto: z.enum(['true', 'false']).optional(),
});
const params = z.object({ id: z.coerce.number().int(), date: z.string().regex(ISO) });

function assertDate(req, year, date) {
  if (date > todayIn(req.school.timezone)) throw badRequest('DATE_IN_FUTURE');
  if (date < year.startDate || date > year.endDate) throw badRequest('DATE_OUTSIDE_YEAR');
  assertYearWritable(year);
}

async function upsertEntry(Model, where, fields, req) {
  const existing = await Model.findOne({ where });
  let photoKey = existing?.photoKey ?? null;
  if (req.file) {
    await storage.remove(photoKey);
    photoKey = await storage.saveImage(req.file.buffer, `diary/${req.school.id}`);
  } else if (req.v.body.removePhoto === 'true') {
    await storage.remove(photoKey);
    photoKey = null;
  }
  const values = { ...where, ...fields, photoKey };
  return existing ? existing.update(values) : Model.create(values);
}

// Personal note for one student on one day (one per author per day).
router.put('/diary/students/:id/:date', requirePerm('diary.write'), upload.image('photo', { optional: true }), validate({ params, body }), async (req, res) => {
  const { id, date } = req.v.params;
  const enrollment = await m.Enrollment.findOne({
    where: { studentId: id, schoolId: req.school.id },
    include: [{ model: m.AcademicYear, where: { startDate: { [Op.lte]: date }, endDate: { [Op.gte]: date } } }],
  });
  if (!enrollment) throw badRequest('DATE_OUTSIDE_YEAR');
  assertDate(req, enrollment.AcademicYear, date);
  await assertSectionWrite(req, enrollment.classSectionId);
  const row = await upsertEntry(
    m.DailyLog,
    { studentId: id, date, createdBy: req.user.id },
    {
      schoolId: req.school.id,
      academicYearId: enrollment.academicYearId,
      enrollmentId: enrollment.id,
      note: req.v.body.note,
      subjectIds: req.v.body.subjectIds,
    },
    req,
  );
  await audit(req, 'diary.student', { entityType: 'student', entityId: id, summary: date });
  res.json({ data: row });
});

// Whole-class note with one photo; shows in the diary of every student present that day.
router.put('/diary/sections/:id/:date', requirePerm('diary.write'), upload.image('photo', { optional: true }), validate({ params, body }), async (req, res) => {
  const { id, date } = req.v.params;
  const section = await findInSchool(m.ClassSection, id, req, { include: [m.AcademicYear] });
  assertDate(req, section.AcademicYear, date);
  await assertSectionWrite(req, section.id);
  const row = await upsertEntry(
    m.ClassDailyLog,
    { classSectionId: id, date, createdBy: req.user.id },
    { schoolId: req.school.id, academicYearId: section.academicYearId, note: req.v.body.note, subjectIds: req.v.body.subjectIds },
    req,
  );
  await audit(req, 'diary.class', { entityType: 'section', entityId: id, summary: date });
  res.json({ data: row });
});

router.delete('/diary/entries/:kind/:id', async (req, res) => {
  const Model = { student: m.DailyLog, class: m.ClassDailyLog }[req.params.kind];
  if (!Model) throw badRequest('VALIDATION');
  const row = await findInSchool(Model, req.params.id, req);
  if (row.createdBy !== req.user.id && !isStaff(req)) throw forbidden();
  assertYearWritable(await m.AcademicYear.findByPk(row.academicYearId));
  await row.destroy();
  await storage.remove(row.photoKey);
  await audit(req, 'diary.delete', {
    entityType: req.params.kind === 'class' ? 'section' : 'student',
    entityId: row.classSectionId ?? row.studentId,
    summary: row.date,
  });
  res.status(204).end();
});

const entryDto = async (r) => ({ ...r, photoUrl: await storage.urlFor(r.photoKey), photoKey: undefined });

// Merged diary for a student in a year: own notes + class notes on days not marked absent.
router.get('/diary/students/:id', yearScope(), async (req, res) => {
  const student = await findInSchool(m.Student, req.params.id, req);
  const rows = await m.sequelize.query(
    `SELECT 'student' AS kind, d.id, d.date, d.note, d.photo_key AS "photoKey", d.subject_ids AS "subjectIds", u.name AS author, d.created_by AS "createdBy", a.status AS attendance
       FROM daily_logs d LEFT JOIN users u ON u.id = d.created_by LEFT JOIN attendance a ON a.student_id = d.student_id AND a.date = d.date
       WHERE d.student_id = :st AND d.academic_year_id = :y
     UNION ALL
     SELECT 'class', c.id, c.date, c.note, c.photo_key, c.subject_ids, u.name, c.created_by, a.status
       FROM class_daily_logs c JOIN enrollments e ON e.class_section_id = c.class_section_id AND e.student_id = :st AND e.academic_year_id = :y
       LEFT JOIN users u ON u.id = c.created_by LEFT JOIN attendance a ON a.student_id = :st AND a.date = c.date
       WHERE c.academic_year_id = :y AND coalesce(a.status, '') <> 'A'
     ORDER BY date DESC LIMIT 200`,
    { replacements: { st: student.id, y: req.year.id }, type: QueryTypes.SELECT },
  );
  const subjects = await m.Subject.findAll({ where: { academicYearId: req.year.id, schoolId: req.school.id }, attributes: ['id', 'name'] });
  const subjectName = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  res.json({
    data: await Promise.all(rows.map(async (r) => ({ ...(await entryDto(r)), subjects: (r.subjectIds || []).map((i) => subjectName[i]).filter(Boolean) }))),
  });
});

router.get('/diary/sections/:id', validate({ query: z.object({ from: z.string().regex(ISO), to: z.string().regex(ISO) }) }), async (req, res) => {
  const section = await findInSchool(m.ClassSection, req.params.id, req);
  const rows = await m.ClassDailyLog.findAll({
    where: { classSectionId: section.id, date: { [Op.between]: [req.v.query.from, req.v.query.to] } },
    order: [['date', 'DESC']],
    raw: true,
  });
  res.json({ data: await Promise.all(rows.map(entryDto)) });
});

module.exports = router;
