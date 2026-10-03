const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const m = require('../../db/models');
const audit = require('../../utils/audit');
const storage = require('../../utils/storage');
const { findInSchool, assertSectionWrite, assertYearWritable } = require('../../utils/scope');
const { badRequest } = require('../../utils/errors');
const { PRESENT } = require('../attendance/attendance.service');

const TERM = z.enum(['S1', 'S2', 'ANNUAL']);

// Grid of all active students of a subject's class for one term.
router.get('/marks', validate({ query: z.object({ subjectId: z.coerce.number().int(), term: TERM }).passthrough() }), async (req, res) => {
  const subject = await findInSchool(m.Subject, req.v.query.subjectId, req);
  const enrollments = await m.Enrollment.findAll({
    where: { classSectionId: subject.classSectionId, status: 'active' },
    include: [{ model: m.Student, attributes: ['id', 'name', 'grNumber'] }],
    order: [
      ['rollNumber', 'ASC NULLS LAST'],
      [m.Student, 'name', 'ASC'],
    ],
  });
  const entries = await m.ReportEntry.findAll({ where: { subjectId: subject.id, term: req.v.query.term } });
  const byEnrollment = Object.fromEntries(entries.map((e) => [e.enrollmentId, e]));
  res.json({
    data: {
      subject,
      term: req.v.query.term,
      rows: enrollments.map((e) => {
        const r = byEnrollment[e.id];
        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          name: e.Student.name,
          rollNumber: e.rollNumber,
          grade: r?.grade ?? '',
          marks: r?.marks ?? null,
          maxMarks: r?.maxMarks ?? null,
          remarks: r?.remarks ?? '',
        };
      }),
    },
  });
});

router.put(
  '/marks',
  requirePerm('marks.write'),
  validate({
    body: z.object({
      subjectId: z.number().int(),
      term: TERM,
      entries: z
        .array(
          z
            .object({
              enrollmentId: z.number().int(),
              grade: z.string().trim().max(5).nullish(),
              marks: z.number().min(0).max(1000).nullish(),
              maxMarks: z.number().min(1).max(1000).nullish(),
              remarks: z.string().trim().max(500).nullish(),
            })
            .refine((e) => e.marks == null || e.maxMarks == null || e.marks <= e.maxMarks, { path: ['marks'], message: 'MORE_THAN_MAX' }),
        )
        .max(500),
    }),
  }),
  async (req, res) => {
    const { subjectId, term, entries } = req.v.body;
    const subject = await findInSchool(m.Subject, subjectId, req);
    assertYearWritable(await m.AcademicYear.findByPk(subject.academicYearId));
    await assertSectionWrite(req, subject.classSectionId, subject.id);
    const ids = entries.map((e) => e.enrollmentId);
    if ((await m.Enrollment.count({ where: { id: ids, classSectionId: subject.classSectionId } })) !== new Set(ids).size) throw badRequest('VALIDATION');
    await m.sequelize.transaction((transaction) =>
      Promise.all(
        entries.map((e) =>
          m.ReportEntry.upsert(
            { ...e, subjectId, term, schoolId: req.school.id, academicYearId: subject.academicYearId, enteredBy: req.user.id },
            { transaction, conflictFields: ['enrollment_id', 'subject_id', 'term'] },
          ),
        ),
      ),
    );
    await audit(req, 'marks.save', { entityType: 'subject', entityId: subject.id, summary: `${subject.name} ${term}: ${entries.length}` });
    res.json({ data: { saved: entries.length } });
  },
);

// Everything a printable report card needs for one student, one year and one term.
router.get('/report-cards/:studentId', yearScope(), validate({ query: z.object({ term: TERM }).passthrough() }), async (req, res) => {
  const student = await findInSchool(m.Student, req.params.studentId, req);
  const enrollment = await m.Enrollment.findOne({ where: { studentId: student.id, academicYearId: req.year.id }, include: [m.ClassSection] });
  if (!enrollment) throw badRequest('VALIDATION');
  const subjects = await m.sequelize.query(
    `SELECT sb.name AS subject, r.grade, r.marks, r.max_marks AS "maxMarks", r.remarks
     FROM subjects sb LEFT JOIN report_entries r ON r.subject_id = sb.id AND r.enrollment_id = :e AND r.term = :t
     WHERE sb.class_section_id = :c ORDER BY sb.sort_order, sb.name`,
    { replacements: { e: enrollment.id, t: req.v.query.term, c: enrollment.classSectionId }, type: QueryTypes.SELECT },
  );
  // Counted in SQL (index on enrollment_id) instead of loading a year of rows.
  const [att] = await m.sequelize.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN (:present))::int AS present FROM attendance WHERE enrollment_id = :e`,
    { replacements: { e: enrollment.id, present: PRESENT }, type: QueryTypes.SELECT },
  );
  const { present } = att;
  res.json({
    data: {
      school: { name: req.school.name, address: req.school.address, logoUrl: await storage.urlFor(req.school.logoKey) },
      year: { id: req.year.id, name: req.year.name },
      term: req.v.query.term,
      student: {
        id: student.id,
        name: student.name,
        grNumber: student.grNumber,
        dob: student.dob,
        guardianName: student.guardianName,
        photoUrl: await storage.urlFor(student.photoKey),
      },
      section: enrollment.ClassSection.name,
      rollNumber: enrollment.rollNumber,
      subjects,
      attendance: { present, total: att.total, percent: att.total ? Math.round((100 * present) / att.total) : null },
    },
  });
});

module.exports = router;
