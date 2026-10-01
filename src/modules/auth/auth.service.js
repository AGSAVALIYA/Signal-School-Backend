const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../../config/env');
const { User, UserSchool, School, RefreshToken } = require('../../db/models');
const { AppError } = require('../../utils/errors');
const storage = require('../../utils/storage');

const MAX_FAILED = 10;
const LOCK_MINUTES = 15;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const hashPassword = (plain) => bcrypt.hash(plain, 10);

// Readable temporary password (no 0/O/1/l confusion) for sharing over the phone or WhatsApp.
function tempPassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(length), (b) => chars[b % chars.length]).join('');
}

async function issueTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, tv: user.tokenVersion }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000),
  });
  return { accessToken, refreshToken };
}

async function meDto(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: UserSchool, as: 'memberships', include: [{ model: School, attributes: ['id', 'name', 'defaultLanguage', 'status'] }] }],
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    preferredLanguage: user.preferredLanguage,
    mustChangePassword: user.mustChangePassword,
    photoUrl: await storage.urlFor(user.photoKey),
    schools: user.memberships
      .filter((m) => m.School.status === 'active')
      .map((m) => ({ id: m.School.id, name: m.School.name, role: m.role, isDefault: m.isDefault, defaultLanguage: m.School.defaultLanguage })),
  };
}

async function login(identifier, password) {
  const id = identifier.trim();
  const phone = id.replace(/[^\d+]/g, '');
  const user = await User.scope('withSecret').findOne({
    where: { [Op.or]: [{ email: id.toLowerCase() }, ...(phone.length >= 6 ? [{ phone }] : [])] },
  });
  if (!user) throw new AppError(401, 'INVALID_CREDENTIALS');
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new AppError(429, 'ACCOUNT_LOCKED');
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    await user.update({
      failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
      lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_INACTIVE');
  await user.update({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });
  return { ...(await issueTokens(user)), user: await meDto(user.id) };
}

async function refresh(token) {
  const row = await RefreshToken.findOne({ where: { tokenHash: sha256(token || ''), revokedAt: null, expiresAt: { [Op.gt]: new Date() } } });
  if (!row) throw new AppError(401, 'SESSION_EXPIRED');
  const user = await User.findByPk(row.userId);
  if (!user || user.status !== 'active') throw new AppError(401, 'SESSION_EXPIRED');
  await row.update({ revokedAt: new Date() });
  return issueTokens(user);
}

const logout = (token) => RefreshToken.update({ revokedAt: new Date() }, { where: { tokenHash: sha256(token || ''), revokedAt: null } });

// Invalidates every session of the user (password change, reset, deactivation).
async function revokeAll(user, transaction) {
  await user.increment('tokenVersion', { transaction });
  await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
}

async function changePassword(userId, current, next) {
  const user = await User.scope('withSecret').findByPk(userId);
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', { fields: { currentPassword: 'WRONG' } });
  await user.update({ passwordHash: await hashPassword(next), mustChangePassword: false });
  await revokeAll(user);
  await user.reload();
  return issueTokens(user);
}

module.exports = { hashPassword, tempPassword, login, refresh, logout, revokeAll, changePassword, meDto, issueTokens };
