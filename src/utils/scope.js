const { TeacherAssignment } = require('../db/models');
const { STAFF } = require('../config/permissions');
const { notFound, forbidden, AppError } = require('./errors');

// Load a record only if it belongs to the caller's school; otherwise 404 (no existence leak).
async function findInSchool(Model, id, req, options = {}) {
  const row = await Model.findOne({ ...options, where: { ...(options.where || {}), id, schoolId: req.school.id } });
  if (!row) throw notFound();
  return row;
}

const isStaff = (req) => STAFF.includes(req.role);

// Teachers write only to sections they are assigned to (class teacher, or subject teacher for that subject).
async function assertSectionWrite(req, classSectionId, subjectId) {
  if (isStaff(req)) return;
  if (req.role !== 'teacher') throw forbidden();
  const rows = await TeacherAssignment.findAll({ where: { userId: req.user.id, classSectionId } });
  const ok = rows.some((r) => r.role === 'class_teacher' || subjectId === undefined || r.subjectId === subjectId);
  if (!ok) throw forbidden();
}

// Closed years are read-only unless an admin has unlocked them temporarily.
function assertYearWritable(year) {
  const unlocked = year.unlockedUntil && new Date(year.unlockedUntil) > new Date();
  if (year.status === 'closed' && !unlocked) throw new AppError(423, 'YEAR_CLOSED');
}

module.exports = { findInSchool, isStaff, assertSectionWrite, assertYearWritable };
