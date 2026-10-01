const router = require('express').Router();
const { z } = require('zod');
const { Op, QueryTypes } = require('sequelize');
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
const { badRequest } = require('../../utils/errors');
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

async function loadStudent(req, id) {
  const student = await findInSchool(m.Student, id, req, { include: [enrollmentInclude(req.year?.id ?? 0)] });
  return { student, enrollment: student.Enrollments?.[0] || null };
}

// ---- List ----
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
    const where = { schoolId: req.school.id };
    if (q) where[Op.or] = [{ name: { [Op.iLike]: `%${q}%` } }, { grNumber: { [Op.iLike]: `${q}%` } }, { guardianPhone: { [Op.like]: `%${q}%` } }];
    const inYear = allYears === 'false' && req.year;
    if (status !== 'all' && !inYear) where.status = status;
    const enrollmentWhere = inYear
      ? { academicYearId: req.year.id, ...(sectionId ? { classSectionId: sectionId } : {}), ...(status === 'active' ? { status: 'active' } : {}) }
      : undefined;
    const enrollmentFilter = { model: m.Enrollment, where: enrollmentWhere, required: Boolean(inYear) };
    const count = await m.Student.count({ where, include: inYear ? [{ ...enrollmentFilter, attributes: [] }] : [], distinct: true, col: 'id' });
    const rows = await m.Student.findAll({
      where,
      include: [{ ...enrollmentFilter, include: [{ model: m.ClassSection, attributes: ['id', 'name', 'sortOrder'] }] }],
      order: inYear
        ? [
            [m.Enrollment, m.ClassSection, 'sortOrder', 'ASC'],
            [m.Enrollment, 'rollNumber', 'ASC NULLS LAST'],
            ['name', 'ASC'],
          ]
        : [['name', 'ASC']],
      limit,
      offset,
      subQuery: !inYear, // one enrollment per student per year, so a flat join paginates correctly
    });

    // Today's attendance status only makes sense for the current year.
    let today = {};
    if (inYear && req.year.status === 'active' && rows.length) {
      const att = await m.Attendance.findAll({
        where: { studentId: rows.map((s) => s.id), date: todayIn(req.school.timezone) },
        attributes: ['studentId', 'status'],
      });
      today = Object.fromEntries(att.map((a) => [a.studentId, a.status]));
    }
    const data = await Promise.all(
      rows.map(async (s) => {
        const latest = [...s.Enrollments].sort((a, b) => b.academicYearId - a.academicYearId)[0];
        return { ...(await svc.studentDto(s, latest)), todayStatus: today[s.id] ?? null };
      }),
    );
    res.json({ data, meta: { total: count } });
  },
);

// ---- Create ----
router.post('/students', requirePerm('students.write'), validate({ body: createBody }), async (req, res) => {
  const { classSectionId, rollNumber, ...fields } = req.v.body;
  const section = await findInSchool(m.ClassSection, classSectionId, req, { include: [m.AcademicYear] });
  assertYearWritable(section.AcademicYear);
  await assertSectionWrite(req, section.id);
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

// ---- Update ----
router.patch('/students/:id', requirePerm('students.write'), yearScope(), validate({ body: updateBody }), async (req, res) => {
  const { student, enrollment } = await loadStudent(req, req.params.id);
  const { classSectionId, rollNumber, activityIds, ...fields } = req.v.body;
  if (enrollment) await assertSectionWrite(req, enrollment.classSectionId);
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
        await assertSectionWrite(req, target.id);
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
  if (enrollment) await assertSectionWrite(req, enrollment.classSectionId);
  const key = await storage.saveImage(req.file.buffer, `students/${req.school.id}`);
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
    body: z.object({ date: z.string().regex(ISO), reason: z.enum(['migrated', 'dropped_out', 'transferred', 'tc_issued', 'other']), note: str(500) }),
  }),
  async (req, res) => {
    assertYearWritable(req.year);
    const { student, enrollment } = await loadStudent(req, req.params.id);
    const { date: leftOn, reason, note } = req.v.body;
    await m.sequelize.transaction(async (transaction) => {
      await student.update({ status: 'left', leftOn, leftReason: reason, leftNote: note }, { transaction });
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
    await student.update({ status: 'active', leftOn: null, leftReason: null, leftNote: null }, { transaction });
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
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
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
    const created = await m.sequelize.transaction(async (transaction) => {
      const auto = await svc.allocateGr(req.school, rows.filter((r) => !r.grNumber).length, transaction);
      const today = todayIn(req.school.timezone);
      const out = [];
      for (const { classSectionId, rollNumber, ...fields } of rows) {
        if (fields.grNumber) await svc.assertGrFree(req.school.id, fields.grNumber, transaction);
        else fields.grNumber = auto.shift();
        const s = await m.Student.create({ ...fields, schoolId: req.school.id, admissionDate: fields.admissionDate || today }, { transaction });
        await m.Enrollment.create(
          { schoolId: req.school.id, academicYearId: req.year.id, studentId: s.id, classSectionId, rollNumber, enrolledOn: today },
          { transaction },
        );
        out.push(s.id);
      }
      return out;
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
     FROM enrollments e JOIN students s ON s.id = e.student_id JOIN class_sections cs ON cs.id = e.class_section_id
     WHERE e.academic_year_id = :y AND e.school_id = :sc ${req.v.query.sectionId ? 'AND cs.id = :sec' : ''}
     ORDER BY cs.sort_order, cs.name, e.roll_number NULLS LAST, s.name`,
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
