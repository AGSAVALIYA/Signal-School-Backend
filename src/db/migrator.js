const fs = require('fs');
const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('../config/db');

const dir = path.join(__dirname, 'migrations');

// Migrations are plain SQL pairs: NNNN-name.up.sql / NNNN-name.down.sql
const migrator = new Umzug({
  migrations: fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort()
    .map((f) => {
      const name = f.replace('.up.sql', '');
      const read = (kind) => fs.readFileSync(path.join(dir, `${name}.${kind}.sql`), 'utf8');
      return {
        name,
        up: () => sequelize.query(read('up')),
        down: () => sequelize.query(read('down')),
      };
    }),
  storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
  logger: process.env.NODE_ENV === 'test' ? undefined : console,
});

module.exports = migrator;
