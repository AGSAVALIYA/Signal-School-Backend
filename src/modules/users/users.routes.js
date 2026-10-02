const router = require('express').Router();
const { z } = require('zod');
const { Op } = require('sequelize');
const validate = require('../../middlewares/validate');
const { requirePerm, yearScope } = require('../../middlewares/auth');
const { can } = require('../../config/permissions');
const { User, UserSchool, TeacherAssignment, ClassSection, Subject, AuditLog, sequelize } = require('../../db/models');
const auth = require('../auth/auth.service');
const audit = require('../../utils/audit');
const storage = require('../../utils/storage');
const { findInSchool, assertYearWritable } = require('../../utils/scope');
const { badRequest, forbidden, notFound } = require('../../utils/errors');
const { page } = require('../../utils/http');

const ROLE = z.enum(['owner', 'admin', 'clerk', 'teacher']);
const contact = {
  email: z.string().trim().email().max(200).nullish(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{8,16}$/)
    .nullish(),
};

// Admins may manage clerks/teachers/admins; only owners may grant owner.
const assertCanGrant = (req, role) => {
  if (role === 'owner' && req.role !== 'owner') throw forbidden();
};

async function userDto(user, schoolId) {
  const m = user.memberships?.find((x) => x.schoolId === schoolId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: m?.role,
    lastLoginAt: user.lastLoginAt,
    mustChangePassword: user.mustChangePassword,
    photoUrl: await storage.urlFor(user.photoKey),
  };
}

async function memberOrThrow(req, id) {
  const user = await User.findOne({
    where: { id, organizationId: req.school.organizationId },
    include: [{ model: UserSchool, as: 'memberships', where: { schoolId: req.school.id } }],
  });
  if (!user) throw notFound();
  return user;
}

router.get(
  '/users',
  validate({ query: z.object({ role: ROLE.optional(), status: z.enum(['active', 'inactive']).optional(), q: z.string().trim().max(100).optional() }) }),
  async (req, res) => {
    const { role, status, q } = req.v.query;
    const users = await User.findAll({
      where: { ...(status ? { status } : {}), ...(q ? { name: { [Op.iLike]: `%${q}%` } } : {}) },
      include: [{ model: UserSchool, as: 'memberships', where: { schoolId: req.school.id, ...(role ? { role } : {}) } }],
      order: [['name', 'ASC']],
    });
    // Teachers only need colleagues' names; contact details and login data stay with the office.
    if (!can(req.role, 'users.manage'))
      return res.json({ data: users.map((u) => ({ id: u.id, name: u.name, role: u.memberships[0]?.role, status: u.status })) });
    res.json({ data: await Promise.all(users.map((u) => userDto(u, req.school.id))) });
  },
);

// Creates a user, or links an existing user of the same organization (e.g. a teacher working in two schools).
router.post(
  '/users',
  requirePerm('users.manage'),
  validate({ body: z.object({ name: z.string().trim().min(1).max(100), role: ROLE, ...contact }).refine((b) => b.email || b.phone, { path: ['email'] }) }),
  async (req, res) => {
    const { name, role, email, phone } = req.v.body;
    assertCanGrant(req, role);
    const result = await sequelize.transaction(async (transaction) => {
      const or = [email && { email: email.toLowerCase() }, phone && { phone: phone.replace(/[^\d+]/g, '') }].filter(Boolean);
      let user = await User.findOne({ where: { [Op.or]: or }, transaction });
      let password = null;
      if (user && user.organizationId !== req.school.organizationId) throw badRequest('DUPLICATE', { fields: { email: 'DUPLICATE' } });
      if (!user) {
        password = auth.tempPassword();
        user = await User.create(
          { name, email, phone, organizationId: req.school.organizationId, passwordHash: await auth.hashPassword(password) },
          { transaction },
        );
      }
      const [membership, created] = await UserSchool.findOrCreate({ where: { userId: user.id, schoolId: req.school.id }, defaults: { role }, transaction });
      if (!created) throw badRequest('DUPLICATE', { fields: { email: 'DUPLICATE' } });
      user.memberships = [membership];
      return { user, password };
    });
    await audit(req, 'user.create', { entityType: 'user', entityId: result.user.id, summary: `${name} (${role})` });
    res.status(201).json({ data: { user: await userDto(result.user, req.school.id), tempPassword: result.password } });
  },
);

router.patch(
  '/users/:id',
  requirePerm('users.manage'),
  validate({ body: z.object({ name: z.string().trim().min(1).max(100).optional(), role: ROLE.optional(), ...contact }) }),
  async (req, res) => {
    const user = await memberOrThrow(req, req.params.id);
    const { role, ...fields } = req.v.body;
    if (role) {
      assertCanGrant(req, role);
      if (user.memberships[0].role === 'owner' && req.role !== 'owner') throw forbidden();
      await user.memberships[0].update({ role });
    }
    await user.update(fields);
    await audit(req, 'user.update', { entityType: 'user', entityId: user.id, after: req.v.body });
    res.json({ data: await userDto(await memberOrThrow(req, user.id), req.school.id) });
  },
);

router.post('/users/:id/reset-password', requirePerm('users.manage'), async (req, res) => {
  const user = await memberOrThrow(req, req.params.id);
  if (user.memberships[0].role === 'owner' && req.role !== 'owner') throw forbidden();
  const password = auth.tempPassword();
  await user.update({ passwordHash: await auth.hashPassword(password), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null });
  await auth.revokeAll(user);
  await audit(req, 'user.reset_password', { entityType: 'user', entityId: user.id });
  res.json({ data: { tempPassword: password } });
});

for (const [action, status] of [
  ['deactivate', 'inactive'],
  ['activate', 'active'],
]) {
  router.post(`/users/:id/${action}`, requirePerm('users.manage'), async (req, res) => {
    const user = await memberOrThrow(req, req.params.id);
    if (user.id === req.user.id || (user.memberships[0].role === 'owner' && req.role !== 'owner')) throw forbidden();
    await user.update({ status });
    if (status === 'inactive') await auth.revokeAll(user);
    await audit(req, `user.${action}`, { entityType: 'user', entityId: user.id, summary: user.name });
    res.json({ data: await userDto(user, req.school.id) });
  });
}

router.get('/users/:id/activity', requirePerm('audit.view'), async (req, res) => {
  await memberOrThrow(req, req.params.id);
  const { limit, offset } = page(req.query);
  const { rows, count } = await AuditLog.findAndCountAll({
    where: { userId: req.params.id, schoolId: req.school.id },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  res.json({ data: rows, meta: { total: count } });
});

// ---- Teacher assignments (per academic year) ----
router.get(
  '/assignments',
  yearScope(),
  validate({ query: z.object({ userId: z.coerce.number().optional(), classSectionId: z.coerce.number().optional() }).passthrough() }),
  async (req, res) => {
    const { userId, classSectionId } = req.v.query;
    const rows = await TeacherAssignment.findAll({
      where: { schoolId: req.school.id, academicYearId: req.year.id, ...(userId ? { userId } : {}), ...(classSectionId ? { classSectionId } : {}) },
      include: [
        { model: User, attributes: ['id', 'name'] },
        { model: ClassSection, attributes: ['id', 'name'] },
        { model: Subject, attributes: ['id', 'name'] },
      ],
      order: [['id', 'ASC']],
    });
    res.json({ data: rows });
  },
);

router.post(
  '/assignments',
  requirePerm('users.manage'),
  validate({
    body: z.object({
      userId: z.number().int(),
      classSectionId: z.number().int(),
      subjectId: z.number().int().nullish(),
      role: z.enum(['class_teacher', 'subject_teacher']),
    }),
  }),
  async (req, res) => {
    const { userId, classSectionId, subjectId, role } = req.v.body;
    const section = await findInSchool(ClassSection, classSectionId, req);
    const year = await section.getAcademicYear();
    assertYearWritable(year);
    await memberOrThrow(req, userId);
    if (subjectId) {
      const subject = await findInSchool(Subject, subjectId, req);
      if (subject.classSectionId !== section.id) throw badRequest('VALIDATION', { fields: { subjectId: 'INVALID' } });
    }
    if (role === 'class_teacher') await TeacherAssignment.destroy({ where: { classSectionId, role: 'class_teacher' } });
    const row = await TeacherAssignment.create({
      schoolId: req.school.id,
      academicYearId: year.id,
      userId,
      classSectionId,
      subjectId: role === 'class_teacher' ? null : subjectId,
      role,
    });
    await audit(req, 'assignment.create', { entityType: 'assignment', entityId: row.id, after: req.v.body });
    res.status(201).json({ data: row });
  },
);

router.delete('/assignments/:id', requirePerm('users.manage'), async (req, res) => {
  const row = await findInSchool(TeacherAssignment, req.params.id, req);
  await row.destroy();
  await audit(req, 'assignment.delete', { entityType: 'assignment', entityId: row.id, before: row.toJSON() });
  res.status(204).end();
});

module.exports = router;
