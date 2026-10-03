const { Sequelize } = require('sequelize');
const env = require('./env');

const ssl =
  env.DATABASE_SSL === 'true' ? { require: true, rejectUnauthorized: true, ...(env.DATABASE_CA ? { ca: env.DATABASE_CA.replace(/\\n/g, '\n') } : {}) } : false;

module.exports = new Sequelize(env.DATABASE_URL, {
  logging: false,
  dialectOptions: ssl ? { ssl } : {},
  // Requests run independent queries in parallel; keep max × API instances below Postgres max_connections (100).
  pool: { max: env.DB_POOL_MAX, idle: 10000 },
  define: { underscored: true, timestamps: true },
});
