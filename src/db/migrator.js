const fs = require('fs');
const path = require('path');
const sequelize = require('../config/db');

// SQL migrations: NNNN-name.up.sql / NNNN-name.down.sql, applied in name order, each in its own transaction, and
// recorded in schema_migrations (the same table and column the previous umzug-based runner used).
const dir = path.join(__dirname, 'migrations');
const names = () =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .map((f) => f.replace('.up.sql', ''))
    .sort();
const read = (name, kind) => fs.readFileSync(path.join(dir, `${name}.${kind}.sql`), 'utf8');
const quiet = process.env.NODE_ENV === 'test';
const log = (event, name) => quiet || console.log({ event, name });

async function applied() {
  await sequelize.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY)');
  const [rows] = await sequelize.query('SELECT name FROM schema_migrations ORDER BY name');
  return rows.map((r) => r.name);
}

// Applies every migration not applied yet. Returns their names.
async function up() {
  const done = new Set(await applied());
  const pending = names().filter((n) => !done.has(n));
  for (const name of pending) {
    log('migrating', name);
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(read(name, 'up'), { transaction });
      await sequelize.query('INSERT INTO schema_migrations (name) VALUES (:name)', { replacements: { name }, transaction });
    });
    log('migrated', name);
  }
  return pending;
}

// Reverts the most recent migration. Returns its name (or null when nothing is applied).
async function down() {
  const name = (await applied()).at(-1);
  if (!name) return null;
  log('reverting', name);
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(read(name, 'down'), { transaction });
    await sequelize.query('DELETE FROM schema_migrations WHERE name = :name', { replacements: { name }, transaction });
  });
  log('reverted', name);
  return name;
}

module.exports = { up, down, applied };
