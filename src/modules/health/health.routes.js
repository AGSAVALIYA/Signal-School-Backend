const router = require('express').Router();
const { z } = require('zod');
const { QueryTypes } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm } = require('../../middlewares/auth');
const m = require('../../db/models');
const audit = require('../../utils/audit');
const { findInSchool, isStaff } = require('../../utils/scope');
const { badRequest, forbidden } = require('../../utils/errors');
const { ISO, todayIn } = require('../../utils/dates');

const body = z.object({
  checkedOn: z.string().regex(ISO),
  heightCm: z.number().min(30).max(250).nullish(),
  weightKg: z.number().min(2).max(200).nullish(),
  needsFollowUp: z.boolean().default(false),
  notes: z.string().trim().max(1000).nullish(),
});

const dto = (h) => ({
  id: h.id,
  checkedOn: h.checkedOn,
  heightCm: h.heightCm === null ? null : Number(h.heightCm),
  weightKg: h.weightKg === null ? null : Number(h.weightKg),
  needsFollowUp: h.needsFollowUp,
  notes: h.notes,
  createdBy: h.createdBy,
  author: h.author?.name ?? null,
});

// Health camp / check-up history of one student, newest first.
router.get('/students/:id/health', async (req, res) => {
  const student = await findInSchool(m.Student, req.params.id, req);
  const rows = await m.HealthCheck.findAll({
    where: { studentId: student.id },
    include: [{ model: m.User, as: 'author', attributes: ['name'] }],
    order: [
      ['checkedOn', 'DESC'],
      ['id', 'DESC'],
    ],
  });
  res.json({ data: rows.map(dto) });
});

router.post('/students/:id/health', requirePerm('health.write'), validate({ body }), async (req, res) => {
  const student = await findInSchool(m.Student, req.params.id, req);
  const b = req.v.body;
  if (b.checkedOn > todayIn(req.school.timezone)) throw badRequest('DATE_IN_FUTURE');
  if (b.heightCm == null && b.weightKg == null && !b.notes) throw badRequest('VALIDATION', { fields: { notes: 'REQUIRED' } });
  const row = await m.HealthCheck.create({ ...b, schoolId: req.school.id, studentId: student.id, createdBy: req.user.id });
  await audit(req, 'health.create', { entityType: 'student', entityId: student.id, summary: b.checkedOn });
  res.status(201).json({ data: dto(row) });
});

router.delete('/health/:id', requirePerm('health.write'), async (req, res) => {
  const row = await findInSchool(m.HealthCheck, req.params.id, req);
  if (row.createdBy !== req.user.id && !isStaff(req)) throw forbidden();
  await row.destroy();
  await audit(req, 'health.delete', { entityType: 'student', entityId: row.studentId, summary: row.checkedOn });
  res.status(204).end();
});

// Students whose last check-up asked for a follow-up (for the office to arrange a doctor visit).
router.get('/health/follow-ups', async (req, res) => {
  const rows = await m.sequelize.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (h.student_id) h.student_id AS "studentId", st.name, h.checked_on AS "checkedOn", h.notes, h.needs_follow_up AS flag
       FROM health_checks h JOIN students st ON st.id = h.student_id
       WHERE h.school_id = :s AND st.status = 'active'
       ORDER BY h.student_id, h.checked_on DESC, h.id DESC) latest
     WHERE flag ORDER BY "checkedOn" DESC`,
    { replacements: { s: req.school.id }, type: QueryTypes.SELECT },
  );
  res.json({ data: rows.map(({ flag: _f, ...r }) => r) });
});

module.exports = router;
