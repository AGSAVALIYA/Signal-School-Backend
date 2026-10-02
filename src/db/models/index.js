const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const m = {
  ...require('./people')(sequelize, DataTypes),
  ...require('./structure')(sequelize, DataTypes),
  ...require('./students')(sequelize, DataTypes),
  ...require('./records')(sequelize, DataTypes),
};

// All associations live here, defined once.
m.Organization.hasMany(m.School, { foreignKey: 'organizationId' });
m.School.belongsTo(m.Organization, { foreignKey: 'organizationId' });
m.User.hasMany(m.UserSchool, { foreignKey: 'userId', as: 'memberships' });
m.UserSchool.belongsTo(m.User, { foreignKey: 'userId' });
m.UserSchool.belongsTo(m.School, { foreignKey: 'schoolId' });

m.Grade.belongsTo(m.Grade, { foreignKey: 'nextGradeId', as: 'nextGrade' });
m.ClassSection.belongsTo(m.Grade, { foreignKey: 'gradeId' });
m.ClassSection.belongsTo(m.AcademicYear, { foreignKey: 'academicYearId' });
m.ClassSection.hasMany(m.Subject, { foreignKey: 'classSectionId' });
m.ClassSection.hasMany(m.Enrollment, { foreignKey: 'classSectionId' });
m.ClassSection.hasMany(m.TeacherAssignment, { foreignKey: 'classSectionId' });
m.Subject.belongsTo(m.ClassSection, { foreignKey: 'classSectionId' });
m.Subject.hasMany(m.Chapter, { foreignKey: 'subjectId' });
m.TeacherAssignment.belongsTo(m.User, { foreignKey: 'userId' });
m.TeacherAssignment.belongsTo(m.ClassSection, { foreignKey: 'classSectionId' });
m.TeacherAssignment.belongsTo(m.Subject, { foreignKey: 'subjectId' });

m.Student.hasMany(m.Enrollment, { foreignKey: 'studentId' });
m.Student.hasMany(m.HealthCheck, { foreignKey: 'studentId' });
m.HealthCheck.belongsTo(m.User, { foreignKey: 'createdBy', as: 'author' });
m.Enrollment.belongsTo(m.Student, { foreignKey: 'studentId' });
m.Enrollment.belongsTo(m.ClassSection, { foreignKey: 'classSectionId' });
m.Enrollment.belongsTo(m.AcademicYear, { foreignKey: 'academicYearId' });
m.ActivityGroup.belongsToMany(m.Enrollment, { through: m.ActivityMember, foreignKey: 'activityGroupId', otherKey: 'enrollmentId' });
m.Enrollment.belongsToMany(m.ActivityGroup, { through: m.ActivityMember, foreignKey: 'enrollmentId', otherKey: 'activityGroupId' });

m.Chapter.hasMany(m.Topic, { foreignKey: 'chapterId' });
m.Topic.belongsTo(m.Chapter, { foreignKey: 'chapterId' });
m.Topic.hasOne(m.TopicCompletion, { foreignKey: 'topicId', as: 'completion' });
m.TopicCompletion.belongsTo(m.User, { foreignKey: 'completedBy', as: 'teacher' });
m.ReportEntry.belongsTo(m.Subject, { foreignKey: 'subjectId' });
m.ReportEntry.belongsTo(m.Enrollment, { foreignKey: 'enrollmentId' });
m.AuditLog.belongsTo(m.User, { foreignKey: 'userId' });

// Canonical class order everywhere (Balwadi, Std 1, Std 2 …): by class level, then section.
// Use with `include: [{ model: Grade, attributes: [] }]` (or any Grade include).
const SECTION_ORDER = [
  [m.Grade, 'sortOrder', 'ASC'],
  ['sortOrder', 'ASC'],
  ['name', 'ASC'],
];

module.exports = { ...m, sequelize, SECTION_ORDER };
