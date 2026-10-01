const migrator = require('../src/db/migrator');
const sequelize = require('../src/config/db');

(async () => {
  const cmd = process.argv[2] || 'up';
  if (cmd === 'up') await migrator.up();
  else if (cmd === 'down') await migrator.down();
  else throw new Error(`Unknown command ${cmd}`);
  await sequelize.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
