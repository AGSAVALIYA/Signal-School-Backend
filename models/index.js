/**
 * Database Models Index File
 * This file establishes all database relationships between models using Sequelize associations
 * It defines the entire data structure and relationships for the Signal School Management System
 */

// Import all model definitions
const Admin = require('./Admin');
const School = require('./School');
const Teacher = require('./Teacher');
const Organization = require('./Organization');
const Student = require('./Student');
const Subject = require('./Subject');
const AcademicYear = require('./AcademicYear');
const Class = require('./Class');
const StudentTimeline = require('./StudentTimeline');
const Report = require('./Report');
const sequelize = require('../config/db');
const Attendance = require('./Attendance');
const Chapter = require('./Chapter');
const Topic = require('./Topic');
const CommonSubject = require('./CommonSubject');
const Logs = require('./Logs');

/**
 * ORGANIZATION AND SCHOOL RELATIONSHIPS
 * An organization can have multiple schools
 */
Organization.hasMany(School);
School.belongsTo(Organization);

/**
 * ORGANIZATION AND ADMIN RELATIONSHIPS  
 * An organization can have multiple admins
 */
Organization.hasMany(Admin);
Admin.belongsTo(Organization);

/**
 * REPORT RELATIONSHIPS
 * Reports are linked to students, subjects, classes, and academic years
 * Each report belongs to one entity of each type
 */
Student.hasMany(Report);
Report.belongsTo(Student);

Subject.hasMany(Report);
Report.belongsTo(Subject);

Class.hasMany(Report);
Report.belongsTo(Class);

AcademicYear.hasMany(Report);
Report.belongsTo(AcademicYear);

/**
 * SCHOOL RELATIONSHIPS
 * Schools contain students, academic years, classes, and subjects
 */
School.hasMany(Student);
Student.belongsTo(School);

School.hasMany(AcademicYear);
AcademicYear.belongsTo(School);

School.hasMany(Class);
Class.belongsTo(School);

School.hasMany(Subject);
Subject.belongsTo(School);

/**
 * ACADEMIC YEAR AND CLASS RELATIONSHIPS
 * Academic years contain multiple classes
 */
AcademicYear.hasMany(Class);
Class.belongsTo(AcademicYear);

/**
 * CLASS RELATIONSHIPS
 * Classes contain students and subjects
 */
Class.hasMany(Student);
Student.belongsTo(Class);

Class.hasMany(Subject);
Subject.belongsTo(Class);

/**
 * COMMON SUBJECT RELATIONSHIPS
 * Common subjects are shared across academic years and schools
 */
AcademicYear.hasMany(CommonSubject);
CommonSubject.belongsTo(AcademicYear);

School.hasMany(CommonSubject);
CommonSubject.belongsTo(School);

/**
 * STUDENT AND COMMON SUBJECT MANY-TO-MANY RELATIONSHIP
 * Students can be enrolled in multiple common subjects
 */
Student.belongsToMany(CommonSubject, { through: 'StudentCommonSubject' });
CommonSubject.belongsToMany(Student, { through: 'StudentCommonSubject' });

/**
 * TEACHER AND SCHOOL MANY-TO-MANY RELATIONSHIP
 * Teachers can work at multiple schools
 */
Teacher.belongsToMany(School, { through: 'TeacherSchool' });
School.belongsToMany(Teacher, { through: 'TeacherSchool' });

/**
 * STUDENT TIMELINE RELATIONSHIPS
 * Students have multiple timeline entries for tracking activities
 */
Student.hasMany(StudentTimeline, { foreignKey: 'StudentId' });
StudentTimeline.belongsTo(Student, { foreignKey: 'StudentId' });

/**
 * STUDENT AND SUBJECT MANY-TO-MANY RELATIONSHIP
 * Students can be enrolled in multiple subjects
 */
Student.belongsToMany(Subject, { through: 'StudentSubject' });

/**
 * SUBJECT AND STUDENT TIMELINE MANY-TO-MANY RELATIONSHIP
 * Timeline entries can be associated with multiple subjects
 */
Subject.belongsToMany(StudentTimeline, { through: 'SubjectStudentTimeline' });
StudentTimeline.belongsToMany(Subject, { through: 'SubjectStudentTimeline' });

/**
 * ATTENDANCE RELATIONSHIPS
 * Attendance records are linked to students, classes, and schools
 */
Student.hasMany(Attendance, { foreignKey: 'studentId' });
Attendance.belongsTo(Student , { foreignKey: 'studentId' });

Class.hasMany(Attendance , { foreignKey: 'classId' });
Attendance.belongsTo(Class , { foreignKey: 'classId' });

School.hasMany(Attendance , { foreignKey: 'schoolId' });
Attendance.belongsTo(School , { foreignKey: 'schoolId' });

/**
 * SYLLABUS RELATIONSHIPS
 * Subjects contain chapters, chapters contain topics
 */
Subject.hasMany(Chapter);
Chapter.belongsTo(Subject);

Chapter.hasMany(Topic);
Topic.belongsTo(Chapter);

/**
 * TEACHER AND TOPIC COMPLETION RELATIONSHIP
 * Teachers can mark topics as completed
 */
Teacher.hasMany(Topic , { foreignKey: 'completedBy' });
Topic.belongsTo(Teacher , { foreignKey: 'completedBy' });

/**
 * ACTIVITY LOGGING RELATIONSHIPS
 * Teachers and admins have activity logs for audit purposes
 */
Teacher.hasMany(Logs , { foreignKey: 'teacherId' });
Logs.belongsTo(Teacher , { foreignKey: 'teacherId' });

Admin.hasMany(Logs , { foreignKey: 'adminId' });
Logs.belongsTo(Admin , { foreignKey: 'adminId' });

/**
 * DATABASE SYNCHRONIZATION
 * Sync all models with the database and create/update tables as needed
 */
sequelize.sync({ alter: true })
.then(() => {
    console.log('Database synced successfully.');
})
.catch((err) => {
    console.log('Error syncing database: ', err);
});

