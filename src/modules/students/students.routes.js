const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const ExcelJS = require('exceljs');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');
const m = require('../../db/models');
const svc = require('./students.service');
const imp = require('./import.service');
const audit = require('../../utils/audit');
const storage = require('../../utils/storage');
const { findInSchool, assertSectionWrite, assertYearWritable, isStaff } = require('../../utils/scope');
const { badRequest, conflict } = require('../../utils/errors');
const { page } = require('../../utils/http');
const { ISO, todayIn } = require('../../utils/dates');

const opt = (s) => s.nullish().transform((v) => (v === '' ? null : v));
const str = (max = 200) => opt(z.string().trim().max(max));
const date = opt(z.string().regex(ISO));

const profile = {
  name: z.string().trim().min(1).max(150),
  gender: opt(z.enum(['F', 'M', 'O'])),
  dob: date,
  dobIsApproximate: z.boolean().optional(),
  estimatedBirthYear: opt(z.number().int().min(1990).max(2100)),
  bloodGroup: str(5),
  address: str(500),
  fatherName: str(),
  motherName: str(),
  guardianName: str(),
  guardianRelation: str(50),
  guardianPhone: opt(
    z
      .string()
      .trim()
      .regex(/^\+?[\d\s-]{8,16}$/),
  ),
  guardianPhone2: opt(
    z
      .string()
      .trim()
      .regex(/^\+?[\d\s-]{8,16}$/),
  ),
  guardianLanguage: opt(z.enum(['en', 'hi', 'mr', 'gu'])),
  aadhaarLast4: opt(z.string().regex(/^\d{4}$/)),
  admissionDate: date,
  consentPhoto: z.boolean().optional(),
  grNumber: str(30),
};
const createBody = z.object({ ...profile, classSectionId: z.number().int(), rollNumber: opt(z.number().int().min(1).max(999)) });
const updateBody = z
  .object({
    ...profile,
    classSectionId: z.number().int().optional(),
    rollNumber: opt(z.number().int().min(1).max(999)),
    activityIds: z.array(z.number().int()).optional(),
  })
  .partial();

const enrollmentInclude = (yearId) => ({
  model: m.Enrollment,
  where: { academicYearId: yearId },
  required: false,
  include: [{ model: m.ClassSection, attributes: ['id', 'name'] }],
});

// The office (clerk) keeps every child's record; teachers only those in their own classes.
const assertStudentWrite = (req, sectionId) => (req.role === 'clerk' ? undefined : assertSectionWrite(req, sectionId));

async function loadStudent(req, id) {
  const student = await findInSchool(m.Student, id, req, { include: [enrollmentInclude(req.year?.id ?? 0)] });
  return { student, enrollment: student.Enrollments?.[0] || null };
}

// ---- List ----
// Lean rows for list screens: raw SQL (no model building) and a thumbnail instead of the full photo.
const LIST_COLUMNS = `s.id, s.name, s.gr_number AS "grNumber", s.status, s.gender, s.guardian_phone AS "guardianPhone", s.photo_key AS "photoKey"`;
const likeSafe = (q) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const listDto = async ({
  photoKey,
  enrollmentId,
  academicYearId,
  classSectionId,
  sectionName,
  rollNumber,
  enrollmentStatus,
  todayStatus,
  total: _total,
  ...s
}) => ({
  ...s,
  thumbUrl: await storage.thumbUrlFor(photoKey),
  todayStatus: todayStatus ?? null,
  enrollment: enrollmentId ? { id: enrollmentId, academicYearId, classSectionId, sectionName, rollNumber, status: enrollmentStatus } : null,
});
router.get(
  '/students',
  yearScope({ required: false }),
  validate({
    query: z.object({
      sectionId: z.coerce.number().int().optional(),
      q: z.string().trim().max(100).optional(),
      status: z.enum(['active', 'left', 'graduated', 'all']).default('active'),
      allYears: z.enum(['true', 'false']).default('false'),
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
    }),
  }),
  async (req, res) => {
    const { sectionId, q, status, allYears } = req.v.query;
    const { limit, offset } = page(req.v.query);
    const r = { s: req.school.id, limit, offset, status, sec: sectionId };
    const where = ['s.school_id = :s'];
    if (q) {
      Object.assign(r, { like: `%${likeSafe(q)}%`, prefix: `${likeSafe(q)}%` });
      where.push('(s.name ILIKE :like OR s.gr_number ILIKE :prefix OR s.guardian_phone LIKE :like)');
    }
    const inYear = allYears === 'false' && req.year;
    let sql;
    if (inYear) {
      // One enrollment per child per year: a flat join, ordered like the register (class level, class, roll number).
      Object.assign(r, { y: req.year.id, today: req.year.status === 'active' ? todayIn(req.school.timezone) : null });
      where.push('e.academic_year_id = :y');
      if (sectionId) where.push('e.class_section_id = :sec');
      if (status === 'active') where.push("e.status = 'active'");
      else if (status !== 'all') where.push('s.status = :status');
      sql = `SELECT ${LIST_COLUMNS}, e.id AS "enrollmentId", e.academic_year_id AS "academicYearId", e.class_section_id AS "classSectionId",
                cs.name AS "sectionName", e.roll_number AS "rollNumber", e.status AS "enrollmentStatus", a.status AS "todayStatus",
                count(*) OVER()::int AS total
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN class_sections cs ON cs.id = e.class_section_id
         JOIN grades g ON g.id = cs.grade_id
         LEFT JOIN attendance a ON a.student_id = s.id AND a.date = :today
         WHERE e.school_id = :s AND ${where.join(' AND ')}
         ORDER BY g.sort_order, cs.sort_order, cs.name, e.roll_number NULLS LAST, s.name, s.id
         LIMIT :limit OFFSET :offset`;
    } else {
      // All years: each child once, with their most recent class.
      if (status !== 'all') where.push('s.status = :status');
      sql = `SELECT ${LIST_COLUMNS}, le.id AS "enrollmentId", le.academic_year_id AS "academicYearId", le.class_section_id AS "classSectionId",
                le.section_name AS "sectionName", le.roll_number AS "rollNumber", le.status AS "enrollmentStatus", NULL AS "todayStatus",
                count(*) OVER()::int AS total
         FROM students s
         LEFT JOIN LATERAL (
           SELECT e.id, e.academic_year_id, e.class_section_id, cs.name AS section_name, e.roll_number, e.status
           FROM enrollments e JOIN class_sections cs ON cs.id = e.class_section_id JOIN academic_years y ON y.id = e.academic_year_id
           WHERE e.student_id = s.id ORDER BY y.start_date DESC LIMIT 1) le ON true
         WHERE ${where.join(' AND ')}
         ORDER BY s.name, s.id
         LIMIT :limit OFFSET :offset`;
    }
    const rows = await m.sequelize.query(sql, { replacements: r, type: QueryTypes.SELECT });
    const data = await Promise.all(rows.map(listDto));
    // count(*) OVER() comes with the rows; only a page past the end needs a separate count.
    let total = rows[0]?.total ?? 0;
    if (!rows.length && offset) {
      const all = sql.replace(/LIMIT :limit OFFSET :offset$/, '');
      [{ total }] = await m.sequelize.query(`SELECT count(*)::int AS total FROM (${all}) x`, { replacements: r, type: QueryTypes.SELECT });
    }
    res.json({ data, meta: { total } });
  },
);

// ---- Create ----
router.post('/students', requirePerm('students.write'), validate({ body: createBody }), async (req, res) => {
  const { classSectionId, rollNumber, ...fields } = req.v.body;
  const section = await findInSchool(m.ClassSection, classSectionId, req, { include: [m.AcademicYear] });
  assertYearWritable(section.AcademicYear);
  await assertStudentWrite(req, section.id);
  const student = await m.sequelize.transaction(async (transaction) => {
    if (fields.grNumber) await svc.assertGrFree(req.school.id, fields.grNumber, transaction);
    else [fields.grNumber] = await svc.allocateGr(req.school, 1, transaction);
    const s = await m.Student.create(
      { ...fields, schoolId: req.school.id, admissionDate: fields.admissionDate || todayIn(req.school.timezone) },
      { transaction },
    );
    await m.Enrollment.create(
      {
        schoolId: req.school.id,
        academicYearId: section.academicYearId,
        studentId: s.id,
        classSectionId: section.id,
        rollNumber,
        enrolledOn: todayIn(req.school.timezone),
      },
      { transaction },
    );
    return s;
  });
  await audit(req, 'student.create', { entityType: 'student', entityId: student.id, summary: `${student.name} → ${section.name}` });
  req.year = section.AcademicYear;
  const { enrollment } = await loadStudent(req, student.id);
  res.status(201).json({ data: await svc.studentDto(student, enrollment) });
});

// ---- Possible duplicates (returning children) ----
// Similar name (trigram) or same guardian phone, so the office re-admits instead of creating a second record.
router.get(
  '/students/possible-duplicates',
  requirePerm('students.write'),
  validate({ query: z.object({ name: z.string().trim().max(150).default(''), guardianPhone: z.string().trim().max(20).default('') }) }),
  async (req, res) => {
    const name = req.v.query.name;
    const phone = req.v.query.guardianPhone.replace(/\D/g, '');
    if (name.length < 3 && phone.length < 8) return res.json({ data: [] });
    const rows = await m.sequelize.query(
      `SELECT s.id, s.name, s.gr_number AS "grNumber", s.status, s.guardian_name AS "guardianName", s.guardian_phone AS "guardianPhone",
              (SELECT cs.name FROM enrollments e JOIN class_sections cs ON cs.id = e.class_section_id JOIN academic_years y ON y.id = e.academic_year_id
                WHERE e.student_id = s.id ORDER BY y.start_date DESC LIMIT 1) AS "lastClass",
              round(similarity(s.name, :name)::numeric, 2)::float AS score,
              (:phone <> '' AND right(regexp_replace(coalesce(s.guardian_phone, ''), '\\D', '', 'g'), 10) = right(:phone, 10)) AS "samePhone"
       FROM students s
       WHERE s.school_id = :school
         AND ((length(:name) >= 3 AND s.name % :name)
           OR (length(:phone) >= 8 AND right(regexp_replace(coalesce(s.guardian_phone, ''), '\\D', '', 'g'), 10) = right(:phone, 10)))
       ORDER BY "samePhone" DESC, score DESC, s.name LIMIT 5`,
      { replacements: { school: req.school.id, name, phone }, type: QueryTypes.SELECT },
    );
    res.json({ data: rows });
  },
);

// ---- Read ----
router.get('/students/:id', yearScope({ required: false }), async (req, res) => {
  const { student, enrollment } = await loadStudent(req, req.params.id);
  const activities = enrollment ? await enrollment.getActivityGroups({ attributes: ['id', 'name', 'nameTranslations'], joinTableAttributes: [] }) : [];
  res.json({ data: { ...(await svc.studentDto(student, enrollment)), activities } });
});

router.get('/students/:id/history', async (req, res) => {
  const student = await findInSchool(m.Student, req.params.id, req);
  res.json({ data: await svc.history(student.id) });
});

// One child's attendance for a month (calendar for parent meetings).
router.get('/students/:id/attendance', validate({ query: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }) }), async (req, res) => {
  const student = await findInSchool(m.Student, req.params.id, req);
  res.json({ data: await svc.monthAttendance(req.school, student, req.v.query.month) });
});

// ---- Update ----
router.patch('/students/:id', requirePerm('students.write'), yearScope(), validate({ body: updateBody }), async (req, res) => {
  const { student, enrollment } = await loadStudent(req, req.params.id);
  const { classSectionId, rollNumber, activityIds, ...fields } = req.v.body;
  if (enrollment) await assertStudentWrite(req, enrollment.classSectionId);
  else if (!isStaff(req) && req.role !== 'clerk') throw badRequest('VALIDATION');
  const before = student.toJSON();
  await m.sequelize.transaction(async (transaction) => {
    if (fields.grNumber && fields.grNumber !== student.grNumber) await svc.assertGrFree(req.school.id, fields.grNumber, transaction, student.id);
    await student.update(fields, { transaction });
    if (enrollment && (classSectionId || rollNumber !== undefined)) {
      assertYearWritable(req.year);
      if (classSectionId) {
        const target = await findInSchool(m.ClassSection, classSectionId, req);
        if (target.academicYearId !== enrollment.academicYearId) throw badRequest('VALIDATION', { fields: { classSectionId: 'INVALID' } });
        await assertStudentWrite(req, target.id);
      }
      await enrollment.update({ ...(classSectionId ? { classSectionId } : {}), ...(rollNumber !== undefined ? { rollNumber } : {}) }, { transaction });
    }
    if (enrollment && activityIds) {
      const groups = await m.ActivityGroup.findAll({ where: { id: activityIds, academicYearId: enrollment.academicYearId }, transaction });
      await enrollment.setActivityGroups(groups, { transaction });
    }
  });
  await audit(req, 'student.update', { entityType: 'student', entityId: student.id, before, after: req.v.body });
  const fresh = await loadStudent(req, student.id);
  res.json({ data: await svc.studentDto(fresh.student, fresh.enrollment) });
});

router.post('/students/:id/photo', requirePerm('students.write'), yearScope({ required: false }), upload.image(), async (req, res) => {
  const { student, enrollment } = await loadStudent(req, req.params.id);
  if (enrollment) await assertStudentWrite(req, enrollment.classSectionId);
  const key = await storage.saveImage(req.file.buffer, `students/${req.school.id}`, { thumb: true });
  await storage.remove(student.photoKey);
  await student.update({ photoKey: key });
  res.json({ data: await svc.studentDto(student, enrollment) });
});

// ---- Leave / re-admit (never hard delete) ----
router.post(
  '/students/:id/leave',
  requirePerm('students.leave'),
  yearScope(),
  validate({
    body: z.object({
      date: z.string().regex(ISO),
      reason: z.enum(['migrated', 'dropped_out', 'transferred', 'tc_issued', 'other']),
      note: str(500),
      toSchool: str(200),
    }),
  }),
  async (req, res) => {
    assertYearWritable(req.year);
    const { student, enrollment } = await loadStudent(req, req.params.id);
    const { date: leftOn, reason, note, toSchool } = req.v.body;
    await m.sequelize.transaction(async (transaction) => {
      await student.update({ status: 'left', leftOn, leftReason: reason, leftNote: note, leftToSchool: toSchool }, { transaction });
      if (enrollment) await enrollment.update({ status: 'left', exitedOn: leftOn }, { transaction });
    });
    await audit(req, 'student.leave', { entityType: 'student', entityId: student.id, summary: `${student.name}: ${reason}` });
    res.json({ data: await svc.studentDto(student, enrollment) });
  },
);

router.post('/students/:id/readmit', requirePerm('students.leave'), validate({ body: z.object({ classSectionId: z.number().int() }) }), async (req, res) => {
  const student = await findInSchool(m.Student, req.params.id, req);
  const section = await findInSchool(m.ClassSection, req.v.body.classSectionId, req, { include: [m.AcademicYear] });
  assertYearWritable(section.AcademicYear);
  await m.sequelize.transaction(async (transaction) => {
    await student.update({ status: 'active', leftOn: null, leftReason: null, leftNote: null, leftToSchool: null }, { transaction });
    const [enrollment, created] = await m.Enrollment.findOrCreate({
      where: { studentId: student.id, academicYearId: section.academicYearId },
      defaults: { schoolId: req.school.id, classSectionId: section.id, enrolledOn: todayIn(req.school.timezone) },
      transaction,
    });
    if (!created) await enrollment.update({ classSectionId: section.id, status: 'active', exitedOn: null }, { transaction });
  });
  await audit(req, 'student.readmit', { entityType: 'student', entityId: student.id, summary: `${student.name} → ${section.name}` });
  res.json({ data: { ok: true } });
});

// ---- Import / export ----
const sectionsOf = (req) =>
  m.ClassSection.findAll({
    where: { academicYearId: req.year.id },
    include: [{ model: m.Grade, attributes: [] }],
    order: m.SECTION_ORDER,
  });

router.get('/students-import/template', requirePerm('students.import'), yearScope(), async (req, res) => {
  const buf = await imp.template((await sectionsOf(req)).map((s) => s.name));
  res.attachment('students-template.xlsx').type('xlsx').send(Buffer.from(buf));
});

router.post('/students-import/preview', requirePerm('students.import'), yearScope(), upload.sheet(), async (req, res) => {
  const rows = imp.validateRows(await imp.readSheet(req.file), await sectionsOf(req));
  const grs = rows.map((r) => r.data.grNumber).filter(Boolean);
  if (grs.length) {
    const taken = new Set((await m.Student.findAll({ where: { schoolId: req.school.id, grNumber: grs }, attributes: ['grNumber'] })).map((s) => s.grNumber));
    rows.forEach((r) => {
      if (taken.has(r.data.grNumber)) r.errors.gr_number = 'DUPLICATE';
    });
  }
  res.json({ data: { rows, valid: rows.filter((r) => !Object.keys(r.errors).length).length, total: rows.length } });
});

router.post(
  '/students-import',
  requirePerm('students.import'),
  yearScope(),
  validate({
    body: z.object({
      rows: z
        .array(createBody.extend({ grNumber: str(30) }))
        .min(1)
        .max(2000),
    }),
  }),
  async (req, res) => {
    assertYearWritable(req.year);
    const sectionIds = new Set((await sectionsOf(req)).map((s) => s.id));
    const rows = req.v.body.rows;
    if (rows.some((r) => !sectionIds.has(r.classSectionId))) throw badRequest('VALIDATION', { fields: { classSectionId: 'INVALID' } });
    // Two bulk inserts for the whole file (was two queries per child).
    const created = await m.sequelize.transaction(async (transaction) => {
      const manual = rows.map((r) => r.grNumber).filter(Boolean);
      const twice = manual.find((gr, i) => manual.indexOf(gr) !== i);
      if (twice)
        throw conflict('GR_DUPLICATE', { params: { gr: twice, name: rows.find((r) => r.grNumber === twice).name }, fields: { grNumber: 'DUPLICATE' } });
      if (manual.length) {
        const taken = await m.Student.findOne({ where: { schoolId: req.school.id, grNumber: manual }, attributes: ['grNumber', 'name'], transaction });
        if (taken) throw conflict('GR_DUPLICATE', { params: { gr: taken.grNumber, name: taken.name }, fields: { grNumber: 'DUPLICATE' } });
      }
      const auto = await svc.allocateGr(req.school, rows.length - manual.length, transaction);
      const today = todayIn(req.school.timezone);
      const students = await m.Student.bulkCreate(
        rows.map(({ classSectionId: _c, rollNumber: _r, ...fields }) => ({
          ...fields,
          grNumber: fields.grNumber || auto.shift(),
          schoolId: req.school.id,
          admissionDate: fields.admissionDate || today,
        })),
        { transaction, returning: ['id'] },
      );
      await m.Enrollment.bulkCreate(
        rows.map(({ classSectionId, rollNumber }, i) => ({
          schoolId: req.school.id,
          academicYearId: req.year.id,
          studentId: students[i].id,
          classSectionId,
          rollNumber,
          enrolledOn: today,
        })),
        { transaction, returning: false },
      );
      return students.map((st) => st.id);
    });
    await audit(req, 'student.import', { entityType: 'student', summary: `${created.length} students` });
    res.status(201).json({ data: { created: created.length } });
  },
);

router.get(
  '/students-export',
  requirePerm('reports.view'),
  yearScope(),
  validate({ query: z.object({ sectionId: z.coerce.number().int().optional() }).passthrough() }),
  async (req, res) => {
    const rows = await m.sequelize.query(
      `SELECT s.gr_number, s.name, cs.name AS class, e.roll_number, s.gender, s.dob, s.estimated_birth_year, s.guardian_name, s.guardian_phone,
            s.father_name, s.mother_name, s.address, s.admission_date, e.status
     FROM enrollments e JOIN students s ON s.id = e.student_id JOIN class_sections cs ON cs.id = e.class_section_id JOIN grades g ON g.id = cs.grade_id
     WHERE e.academic_year_id = :y AND e.school_id = :sc ${req.v.query.sectionId ? 'AND cs.id = :sec' : ''}
     ORDER BY g.sort_order, cs.sort_order, cs.name, e.roll_number NULLS LAST, s.name`,
      { replacements: { y: req.year.id, sc: req.school.id, sec: req.v.query.sectionId }, type: QueryTypes.SELECT },
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(req.year.name);
    const cols = Object.keys(rows[0] || { gr_number: 1, name: 1, class: 1 });
    ws.columns = cols.map((key) => ({ header: key, key, width: 18 }));
    ws.getRow(1).font = { bold: true };
    ws.addRows(rows);
    res
      .attachment(`students-${req.year.name}.xlsx`)
      .type('xlsx')
      .send(Buffer.from(await wb.xlsx.writeBuffer()));
  },
);

module.exports = router;
