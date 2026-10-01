module.exports = (sequelize, DT) => {
  const scoped = { schoolId: { type: DT.INTEGER, allowNull: false } };
  const yearScoped = { ...scoped, academicYearId: { type: DT.INTEGER, allowNull: false } };

  const AcademicYear = sequelize.define(
    'AcademicYear',
    {
      ...scoped,
      name: { type: DT.TEXT, allowNull: false },
      startDate: { type: DT.DATEONLY, allowNull: false },
      endDate: { type: DT.DATEONLY, allowNull: false },
      status: { type: DT.TEXT, defaultValue: 'planned' },
      unlockedUntil: DT.DATE,
      closedAt: DT.DATE,
    },
    { tableName: 'academic_years' },
  );

  const Grade = sequelize.define(
    'Grade',
    {
      ...scoped,
      name: { type: DT.TEXT, allowNull: false },
      nameTranslations: { type: DT.JSONB, defaultValue: {} },
      sortOrder: { type: DT.INTEGER, defaultValue: 0 },
      nextGradeId: DT.INTEGER,
      isFinal: { type: DT.BOOLEAN, defaultValue: false },
    },
    { tableName: 'grades' },
  );

  const ClassSection = sequelize.define(
    'ClassSection',
    {
      ...yearScoped,
      gradeId: { type: DT.INTEGER, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      sortOrder: { type: DT.INTEGER, defaultValue: 0 },
      copiedFromId: DT.INTEGER,
    },
    { tableName: 'class_sections' },
  );

  const Subject = sequelize.define(
    'Subject',
    {
      ...yearScoped,
      classSectionId: { type: DT.INTEGER, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      nameTranslations: { type: DT.JSONB, defaultValue: {} },
      sortOrder: { type: DT.INTEGER, defaultValue: 0 },
      copiedFromId: DT.INTEGER,
    },
    { tableName: 'subjects' },
  );

  const TeacherAssignment = sequelize.define(
    'TeacherAssignment',
    {
      ...yearScoped,
      userId: { type: DT.INTEGER, allowNull: false },
      classSectionId: { type: DT.INTEGER, allowNull: false },
      subjectId: DT.INTEGER,
      role: { type: DT.TEXT, allowNull: false },
    },
    { tableName: 'teacher_assignments' },
  );

  const ActivityGroup = sequelize.define(
    'ActivityGroup',
    {
      ...yearScoped,
      name: { type: DT.TEXT, allowNull: false },
      nameTranslations: { type: DT.JSONB, defaultValue: {} },
    },
    { tableName: 'activity_groups' },
  );

  const ActivityMember = sequelize.define(
    'ActivityMember',
    {
      activityGroupId: { type: DT.INTEGER, primaryKey: true },
      enrollmentId: { type: DT.INTEGER, primaryKey: true },
    },
    { tableName: 'activity_members' },
  );

  const Holiday = sequelize.define(
    'Holiday',
    {
      ...scoped,
      date: { type: DT.DATEONLY, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      type: { type: DT.TEXT, defaultValue: 'holiday' },
    },
    { tableName: 'holidays' },
  );

  return { AcademicYear, Grade, ClassSection, Subject, TeacherAssignment, ActivityGroup, ActivityMember, Holiday };
};
