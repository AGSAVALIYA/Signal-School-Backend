const jwt = require('jsonwebtoken');
const JWT_KEY = require('../config/jwtKey');
const { can } = require('../config/permissions');
const { User, UserSchool, School, AcademicYear } = require('../db/models');
const { AppError, forbidden } = require('../utils/errors');

const unauth = (code = 'UNAUTHENTICATED') => new AppError(401, code);

// Who is asking (user + memberships), their school and its year were 3 of the ~5 queries of a typical request. This
// process keeps them for 5 s as plain rows; anything this process changes drops them at once (model hooks below), and
// other API processes see a change within 5 s. Revoked sessions (tokenVersion) are therefore refused within 5 s.
const TTL = 5000;
const cached = { users: new Map(), schools: new Map(), years: new Map() };
async function memo(map, key, load) {
  const hit = map.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await load();
  if (map.size >= 2000) map.delete(map.keys().next().value);
  map.set(key, { value, exp: Date.now() + TTL });
  return value;
}
const forgetUser = (id) => cached.users.delete(id);
const forgetAll = () => Object.values(cached).forEach((m) => m.clear());
for (const [model, map, key] of [
  [User, cached.users, 'id'],
  [UserSchool, cached.users, 'userId'],
  [School, cached.schools, 'id'],
  [AcademicYear, cached.years, null],
]) {
  model.addHook('afterSave', (row) => (key ? map.delete(row[key]) : map.clear()));
  model.addHook('afterDestroy', (row) => (key ? map.delete(row[key]) : map.clear()));
  for (const hook of ['afterBulkCreate', 'afterBulkUpdate', 'afterBulkDestroy']) model.addHook(hook, () => map.clear());
}
const build = (Model, row) => row && Model.build(row, { isNewRecord: false, raw: true });

async function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauth();
  let payload;
  try {
    payload = jwt.verify(token, JWT_KEY, { algorithms: ['HS256'] });
  } catch (e) {
    throw unauth(e.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED');
  }
  const found = await memo(cached.users, payload.sub, async () => {
    const user = await User.findByPk(payload.sub, { raw: true });
    return user && { user, memberships: await UserSchool.findAll({ where: { userId: user.id }, raw: true }) };
  });
  if (!found || found.user.status !== 'active' || found.user.tokenVersion !== payload.tv) throw unauth('SESSION_EXPIRED');
  req.user = build(User, found.user);
  req.user.memberships = found.memberships;
  next();
}

// Resolves the school for this request from X-School-Id (or the user's default membership).
async function schoolScope(req, _res, next) {
  const memberships = req.user.memberships;
  if (!memberships.length) throw new AppError(403, 'NO_SCHOOL');
  const wanted = Number(req.headers['x-school-id']) || null;
  const m = wanted ? memberships.find((x) => x.schoolId === wanted) : memberships.find((x) => x.isDefault) || memberships[0];
  if (!m) throw forbidden();
  const school = build(School, await memo(cached.schools, m.schoolId, () => School.findByPk(m.schoolId, { raw: true })));
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
    req.year = build(AcademicYear, await memo(cached.years, `${req.school.id}:${wanted || 'active'}`, () => AcademicYear.findOne({ where, raw: true })));
    if (!req.year && (wanted || required)) throw wanted ? new AppError(404, 'NOT_FOUND') : new AppError(409, 'NO_ACTIVE_YEAR');
    next();
  };

const requirePerm = (perm) =>
  function checkPermission(req, _res, next) {
    if (!can(req.role, perm)) throw forbidden();
    next();
  };

module.exports = { authenticate, schoolScope, yearScope, requirePerm, forgetUser, forgetAll };
