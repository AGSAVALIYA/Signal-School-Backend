const cluster = require('node:cluster');
const env = require('./config/env');
const logger = require('./utils/logger');

// With WEB_CONCURRENCY > 1 (and Redis, which every process shares) a small primary process starts that many API
// processes on the same port and restarts any that crash. A single process otherwise.
const processes = env.REDIS_URL ? env.WEB_CONCURRENCY : 1;
if (env.WEB_CONCURRENCY > 1 && !env.REDIS_URL) logger.warn('WEB_CONCURRENCY > 1 needs REDIS_URL; running one API process');

if (cluster.isPrimary && processes > 1) {
  let stopping = false;
  let quickExits = 0;
  const started = new Map();
  const fork = () => started.set(cluster.fork().id, Date.now());
  logger.info(`starting ${processes} API processes`);
  for (let i = 0; i < processes; i += 1) fork();
  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return;
    // A process that keeps dying right after starting (bad config, port taken) stops the whole API instead of looping.
    if (Date.now() - started.get(worker.id) < 5000 && ++quickExits >= 5) {
      logger.fatal('API processes keep exiting at start; stopping');
      process.exit(1);
    }
    logger.error({ code, signal }, 'API process exited; starting another');
    fork();
  });
  const stop = () => {
    stopping = true;
    for (const w of Object.values(cluster.workers)) w.process.kill('SIGTERM');
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} else {
  const createApp = require('./app');
  const sequelize = require('./config/db');
  const cache = require('./utils/cache');
  const { startJobs } = require('./jobs');

  const server = createApp().listen(env.PORT, () => logger.info(`API listening on ${env.PORT}`));
  // Housekeeping runs in one process only.
  if (!cluster.worker || cluster.worker.id === 1) startJobs();

  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));

  const shutdown = () => {
    server.close(async () => {
      await Promise.all([sequelize.close(), cache.close()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
