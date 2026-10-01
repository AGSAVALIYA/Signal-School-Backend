module.exports = (sequelize, DT) => {
  const yearScoped = {
    schoolId: { type: DT.INTEGER, allowNull: false },
    academicYearId: { type: DT.INTEGER, allowNull: false },
  };

  const Attendance = sequelize.define(
    'Attendance',
    {
      ...yearScoped,
      enrollmentId: { type: DT.INTEGER, allowNull: false },
      studentId: { type: DT.INTEGER, allowNull: false },
      classSectionId: { type: DT.INTEGER, allowNull: false },
      date: { type: DT.DATEONLY, allowNull: false },
      status: { type: DT.TEXT, allowNull: false },
      remark: DT.TEXT,
      markedBy: DT.INTEGER,
      markedAt: DT.DATE,
    },
    { tableName: 'attendance' },
  );

  const AttendanceSession = sequelize.define(
    'AttendanceSession',
    {
      ...yearScoped,
      classSectionId: { type: DT.INTEGER, allowNull: false },
      date: { type: DT.DATEONLY, allowNull: false },
      submittedBy: DT.INTEGER,
      submittedAt: DT.DATE,
      presentCount: { type: DT.INTEGER, defaultValue: 0 },
      absentCount: { type: DT.INTEGER, defaultValue: 0 },
      leaveCount: { type: DT.INTEGER, defaultValue: 0 },
      lateCount: { type: DT.INTEGER, defaultValue: 0 },
    },
    { tableName: 'attendance_sessions' },
  );

  const diaryFields = {
    ...yearScoped,
    date: { type: DT.DATEONLY, allowNull: false },
    note: DT.TEXT,
    photoKey: DT.TEXT,
    subjectIds: { type: DT.ARRAY(DT.INTEGER), defaultValue: [] },
    createdBy: DT.INTEGER,
  };
  const DailyLog = sequelize.define(
    'DailyLog',
    {
      ...diaryFields,
      enrollmentId: { type: DT.INTEGER, allowNull: false },
      studentId: { type: DT.INTEGER, allowNull: false },
    },
    { tableName: 'daily_logs' },
  );
  const ClassDailyLog = sequelize.define(
    'ClassDailyLog',
    {
      ...diaryFields,
      classSectionId: { type: DT.INTEGER, allowNull: false },
    },
    { tableName: 'class_daily_logs' },
  );

  const Chapter = sequelize.define(
    'Chapter',
    {
      schoolId: { type: DT.INTEGER, allowNull: false },
      subjectId: { type: DT.INTEGER, allowNull: false },
      name: { type: DT.TEXT, allowNull: false },
      sortOrder: { type: DT.INTEGER, defaultValue: 0 },
      copiedFromId: DT.INTEGER,
    },
    { tableName: 'chapters' },
  );

  const Topic = sequelize.define(
    'Topic',
    {
      schoolId: { type: DT.INTEGER, allowNull: false },
      chapterId: { type: DT.INTEGER, allowNull: false },
      content: { type: DT.TEXT, allowNull: false },
      sortOrder: { type: DT.INTEGER, defaultValue: 0 },
      copiedFromId: DT.INTEGER,
    },
    { tableName: 'topics' },
  );

  const TopicCompletion = sequelize.define(
    'TopicCompletion',
    {
      schoolId: { type: DT.INTEGER, allowNull: false },
      topicId: { type: DT.INTEGER, allowNull: false },
      completedBy: DT.INTEGER,
      completedOn: { type: DT.DATEONLY, allowNull: false },
    },
    { tableName: 'topic_completions' },
  );

  const ReportEntry = sequelize.define(
    'ReportEntry',
    {
      ...yearScoped,
      enrollmentId: { type: DT.INTEGER, allowNull: false },
      subjectId: { type: DT.INTEGER, allowNull: false },
      term: { type: DT.TEXT, allowNull: false },
      grade: DT.TEXT,
      marks: DT.DECIMAL(6, 2),
      maxMarks: DT.DECIMAL(6, 2),
      remarks: DT.TEXT,
      enteredBy: DT.INTEGER,
    },
    { tableName: 'report_entries' },
  );

  const RolloverRun = sequelize.define(
    'RolloverRun',
    {
      schoolId: { type: DT.INTEGER, allowNull: false },
      idempotencyKey: { type: DT.TEXT, allowNull: false },
      academicYearId: DT.INTEGER,
      summary: { type: DT.JSONB, defaultValue: {} },
      createdBy: DT.INTEGER,
    },
    { tableName: 'rollover_runs' },
  );

  const AuditLog = sequelize.define(
    'AuditLog',
    {
      schoolId: DT.INTEGER,
      userId: DT.INTEGER,
      action: { type: DT.TEXT, allowNull: false },
      entityType: DT.TEXT,
      entityId: DT.INTEGER,
      summary: DT.TEXT,
      before: DT.JSONB,
      after: DT.JSONB,
      ip: DT.TEXT,
      requestId: DT.TEXT,
    },
    { tableName: 'audit_logs', updatedAt: false },
  );

  return { Attendance, AttendanceSession, DailyLog, ClassDailyLog, Chapter, Topic, TopicCompletion, ReportEntry, RolloverRun, AuditLog };
};
