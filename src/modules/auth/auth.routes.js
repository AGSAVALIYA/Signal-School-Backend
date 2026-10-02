const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const validate = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');
const { UserSchool } = require('../../db/models');
const storage = require('../../utils/storage');
const { forbidden } = require('../../utils/errors');
const env = require('../../config/env');
const svc = require('./auth.service');

const LANGS = ['en', 'hi', 'mr', 'gu'];
const password = z.string().min(8).max(100);

const limiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60000,
    limit: env.NODE_ENV === 'test' ? 10000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment', requestId: req.id } }),
  });
const loginLimiter = limiter(20);
const refreshLimiter = limiter(120);

router.post(
  '/auth/login',
  loginLimiter,
  validate({ body: z.object({ identifier: z.string().trim().min(3).max(200), password: z.string().min(1).max(100) }) }),
  async (req, res) => {
    res.json({ data: await svc.login(req.v.body.identifier, req.v.body.password) });
  },
);

router.post('/auth/refresh', refreshLimiter, validate({ body: z.object({ refreshToken: z.string().max(200) }) }), async (req, res) => {
  res.json({ data: await svc.refresh(req.v.body.refreshToken) });
});

router.post('/auth/logout', validate({ body: z.object({ refreshToken: z.string().optional() }) }), async (req, res) => {
  await svc.logout(req.v.body.refreshToken);
  res.status(204).end();
});

router.get('/me', authenticate, async (req, res) => res.json({ data: await svc.meDto(req.user.id) }));

router.patch(
  '/me',
  authenticate,
  validate({ body: z.object({ name: z.string().min(1).max(100).optional(), preferredLanguage: z.enum(LANGS).optional() }) }),
  async (req, res) => {
    await req.user.update(req.v.body);
    res.json({ data: await svc.meDto(req.user.id) });
  },
);

router.post('/me/password', authenticate, validate({ body: z.object({ currentPassword: z.string().max(100), newPassword: password }) }), async (req, res) =>
  res.json({ data: await svc.changePassword(req.user.id, req.v.body.currentPassword, req.v.body.newPassword) }),
);

router.post('/me/photo', authenticate, upload.image(), async (req, res) => {
  const key = await storage.saveImage(req.file.buffer, 'users');
  await storage.remove(req.user.photoKey);
  await req.user.update({ photoKey: key });
  res.json({ data: await svc.meDto(req.user.id) });
});

router.put('/me/default-school', authenticate, validate({ body: z.object({ schoolId: z.number().int() }) }), async (req, res) => {
  const { schoolId } = req.v.body;
  if (!req.user.memberships.some((m) => m.schoolId === schoolId)) throw forbidden();
  await UserSchool.update({ isDefault: false }, { where: { userId: req.user.id } });
  await UserSchool.update({ isDefault: true }, { where: { userId: req.user.id, schoolId } });
  res.json({ data: await svc.meDto(req.user.id) });
});

module.exports = router;
