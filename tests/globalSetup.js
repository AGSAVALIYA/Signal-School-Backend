// Fresh schema for every test run.
module.exports = async () => {
  require('./env');
  const sequelize = require('../src/config/db');
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await require('../src/db/migrator').up();
  await sequelize.close();
};
