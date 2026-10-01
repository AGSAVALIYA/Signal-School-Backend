const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { can } = require('../config/permissions');
const { User, UserSchool, School, AcademicYear } = require('../db/models');
const { AppError, forbidden } = require('../utils/errors');

const unauth = (code = 'UNAUTHENTICATED') => new AppError(401, code);

async function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauth();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    throw unauth(e.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED');
  }
  const user = await User.findByPk(payload.sub, { include: [{ model: UserSchool, as: 'memberships' }] });
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.tv) throw unauth('SESSION_EXPIRED');
  req.user = user;
  next();
}

// Resolves the school for this request from X-School-Id (or the user's default membership).
async function schoolScope(req, _res, next) {
  const memberships = req.user.memberships;
  if (!memberships.length) throw new AppError(403, 'NO_SCHOOL');
  const wanted = Number(req.headers['x-school-id']) || null;
  const m = wanted ? memberships.find((x) => x.schoolId === wanted) : memberships.find((x) => x.isDefault) || memberships[0];
  if (!m) throw forbidden();
  const school = await School.findByPk(m.schoolId);
  if (!school || school.status !== 'active') throw forbidden();
  req.school = school;
  req.role = m.role;
  next();
}

// Resolves the academic year from X-Academic-Year / ?academicYearId, defaulting to the active year.
const yearScope = ({ required = true } = {}) =>
  async function resolveYear(req, _res, next) {
    const wanted = Number(req.headers['x-academic-year'] || req.query.academicYearId) || null;
    const where = wanted ? { id: wanted, schoolId: req.school.id } : { schoolId: req.school.id, status: 'active' };
    req.year = await AcademicYear.findOne({ where });
    if (!req.year && (wanted || required)) throw wanted ? new AppError(404, 'NOT_FOUND') : new AppError(409, 'NO_ACTIVE_YEAR');
    next();
  };

const requirePerm = (perm) =>
  function checkPermission(req, _res, next) {
    if (!can(req.role, perm)) throw forbidden();
    next();
  };

module.exports = { authenticate, schoolScope, yearScope, requirePerm };
