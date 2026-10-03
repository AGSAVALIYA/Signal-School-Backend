const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const env = require('./config/env');
const logger = require('./utils/logger');
const storage = require('./utils/storage');
const cache = require('./utils/cache');
const sequelize = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const { AppError } = require('./utils/errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ['Authorization', 'Content-Type', 'X-School-Id', 'X-Academic-Year', 'Accept-Language'],
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use((req, res, next) => {
    const given = req.headers['x-request-id'];
    req.id = typeof given === 'string' && /^[\w.-]{1,64}$/.test(given) ? given : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: env.NODE_ENV !== 'test' }));
  // JSON shrinks ~85% with gzip: the difference between seconds and instant on 2G/3G school phones.
  app.use(compression({ threshold: 1024 }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    try {
      await sequelize.authenticate();
      // Redis is optional: the API keeps working without it, so it is reported but never fails the check.
      res.json({ status: 'ok', version: require('../package.json').version, redis: await cache.ping() });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // Local disk storage (when S3 is not configured): files are served only with a valid, expiring signature.
  if (!env.S3_BUCKET) {
    app.use('/files', (req, _res, next) => (storage.verifySigned(req.path.slice(1), req.query) ? next() : next(new AppError(404, 'NOT_FOUND'))));
    app.use('/files', express.static(storage.localDir, { maxAge: '1h', fallthrough: false, dotfiles: 'deny', index: false }));
  }

  // Broad per-IP ceiling against scripted abuse; a whole school behind one mobile IP stays far below it.
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 60000,
      limit: env.NODE_ENV === 'test' ? 100000 : env.API_RATE_LIMIT,
      store: cache.rateLimitStore('api'),
      passOnStoreError: true,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment', requestId: req.id } }),
    }),
  );
  app.use('/api/v1', require('./routes'));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
