const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./utils/logger');
const storage = require('./utils/storage');
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
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  app.use(pinoHttp({ logger, genReqId: (req) => req.id, autoLogging: env.NODE_ENV !== 'test' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    await sequelize.authenticate();
    res.json({ status: 'ok', version: require('../package.json').version });
  });

  // Development file storage (production uses private S3 with signed URLs).
  if (!env.S3_BUCKET) app.use('/files', express.static(storage.localDir, { maxAge: '7d', fallthrough: false }));

  app.use('/api/v1', require('./routes'));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
