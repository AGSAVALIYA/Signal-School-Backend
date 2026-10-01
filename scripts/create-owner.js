// Bootstraps an organization, its first school and the owner account (replaces public admin sign-up).
// Usage: npm run create-owner -- --org "Signal Trust" --school "Thane Signal School" --name "Owner Name" --email owner@example.org [--password secret123]
const { sequelize, Organization, School, User, UserSchool } = require('../src/db/models');
const { hashPassword, tempPassword } = require('../src/modules/auth/auth.service');

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

(async () => {
  const [org, school, name, email, phone] = ['org', 'school', 'name', 'email', 'phone'].map(arg);
  if (!org || !school || !name || !(email || phone)) throw new Error('Required: --org --school --name and --email or --phone');
  const password = arg('password') || tempPassword();
  await sequelize.transaction(async (transaction) => {
    const o = await Organization.create({ name: org }, { transaction });
    const s = await School.create({ organizationId: o.id, name: school }, { transaction });
    const u = await User.create(
      { organizationId: o.id, name, email, phone, passwordHash: await hashPassword(password), mustChangePassword: !arg('password') },
      { transaction },
    );
    await UserSchool.create({ userId: u.id, schoolId: s.id, role: 'owner', isDefault: true }, { transaction });
  });
  console.log(`Owner created. Login: ${email || phone}  Password: ${password}`);
  await sequelize.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
