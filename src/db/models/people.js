module.exports = (sequelize, DT) => {
  const Organization = sequelize.define(
    'Organization',
    {
      name: { type: DT.TEXT, allowNull: false },
      headOffice: DT.TEXT,
      contactNumber: DT.TEXT,
      settings: { type: DT.JSONB, defaultValue: {} },
    },
    { tableName: 'organizations' },
  );

  const School = sequelize.define(
    'School',
    {
      organizationId: { type: DT.INTEGER, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      address: DT.TEXT,
      contactNumber: DT.TEXT,
      location: DT.TEXT,
      udiseCode: DT.TEXT,
      logoKey: DT.TEXT,
      defaultLanguage: { type: DT.TEXT, defaultValue: 'en' },
      timezone: { type: DT.TEXT, defaultValue: 'Asia/Kolkata' },
      grPrefix: { type: DT.TEXT, defaultValue: '' },
      nextGrNumber: { type: DT.INTEGER, defaultValue: 1 },
      attendanceEditDays: { type: DT.INTEGER, defaultValue: 7 },
      weeklyOffs: { type: DT.ARRAY(DT.INTEGER), defaultValue: [0] },
      status: { type: DT.TEXT, defaultValue: 'active' },
    },
    { tableName: 'schools' },
  );

  const User = sequelize.define(
    'User',
    {
      organizationId: { type: DT.INTEGER, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      email: {
        type: DT.CITEXT,
        set(v) {
          this.setDataValue('email', v ? String(v).trim().toLowerCase() : null);
        },
      },
      phone: {
        type: DT.TEXT,
        set(v) {
          this.setDataValue('phone', v ? String(v).replace(/[^\d+]/g, '') : null);
        },
      },
      passwordHash: { type: DT.TEXT, allowNull: false },
      mustChangePassword: { type: DT.BOOLEAN, defaultValue: true },
      status: { type: DT.TEXT, defaultValue: 'active' },
      preferredLanguage: DT.TEXT,
      photoKey: DT.TEXT,
      tokenVersion: { type: DT.INTEGER, defaultValue: 0 },
      lastLoginAt: DT.DATE,
      failedLoginCount: { type: DT.INTEGER, defaultValue: 0 },
      lockedUntil: DT.DATE,
    },
    {
      tableName: 'users',
      defaultScope: { attributes: { exclude: ['passwordHash'] } },
      scopes: { withSecret: { attributes: { include: ['passwordHash'] } } },
    },
  );

  const UserSchool = sequelize.define(
    'UserSchool',
    {
      userId: { type: DT.INTEGER, allowNull: false },
      schoolId: { type: DT.INTEGER, allowNull: false },
      role: { type: DT.TEXT, allowNull: false },
      isDefault: { type: DT.BOOLEAN, defaultValue: false },
    },
    { tableName: 'user_schools' },
  );

  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      userId: { type: DT.INTEGER, allowNull: false },
      tokenHash: { type: DT.TEXT, allowNull: false },
      expiresAt: { type: DT.DATE, allowNull: false },
      revokedAt: DT.DATE,
    },
    { tableName: 'refresh_tokens' },
  );

  return { Organization, School, User, UserSchool, RefreshToken };
};
