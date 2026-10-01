const env = require('./config/env');
const createApp = require('./app');
const sequelize = require('./config/db');
const logger = require('./utils/logger');
const { startJobs } = require('./jobs');

const server = createApp().listen(env.PORT, () => logger.info(`API listening on ${env.PORT}`));
startJobs();

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));

const shutdown = () => {
  server.close(async () => {
    await sequelize.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
