// Creates list thumbnails for student and staff photos uploaded before thumbnails existed (they used to come from a
// separate S3 bucket filled by a Lambda; the API now makes them at upload time). Safe to run again.
// Usage: npm run thumbnails
const { sequelize } = require('../src/db/models');
const storage = require('../src/utils/storage');

(async () => {
  const keys = (
    await sequelize.query(`SELECT photo_key AS key FROM students WHERE photo_key IS NOT NULL UNION SELECT photo_key FROM users WHERE photo_key IS NOT NULL`, {
      type: sequelize.QueryTypes.SELECT,
    })
  ).map((r) => r.key);
  let done = 0;
  let failed = 0;
  for (const key of keys) {
    try {
      await storage.ensureThumb(key);
      done += 1;
    } catch (e) {
      failed += 1;
      console.error(`${key}: ${e.message}`);
    }
  }
  console.log(`Thumbnails: ${done} made, ${failed} failed, ${keys.length} photos`);
  await sequelize.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
