const { QueryTypes } = require('sequelize');
const sequelize = require('./config/db');
const logger = require('./utils/logger');

const SIX_HOURS = 6 * 3600 * 1000;

// Housekeeping: audit retention (2 years) and expired refresh tokens.
async function runMaintenance() {
  try {
    await sequelize.query(`DELETE FROM audit_logs WHERE created_at < now() - interval '2 years'`, { type: QueryTypes.DELETE });
    await sequelize.query(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'`, { type: QueryTypes.DELETE });
  } catch (err) {
    logger.error({ err }, 'maintenance failed');
  }
}

const startJobs = () => setInterval(runMaintenance, SIX_HOURS).unref();

module.exports = { startJobs, runMaintenance };
