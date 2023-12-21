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


Organization.hasMany(School);
School.belongsTo(Organization);


Organization.hasMany(Admin);
Admin.belongsTo(Organization);


//add foreign key to report table of student id ,  subject id , class id , academic year id
Student.hasMany(Report);
Report.belongsTo(Student);

Subject.hasMany(Report);
Report.belongsTo(Subject);

Class.hasMany(Report);
Report.belongsTo(Class);

AcademicYear.hasMany(Report);
Report.belongsTo(AcademicYear);

School.hasMany(Student);
Student.belongsTo(School);

School.hasMany(AcademicYear);
AcademicYear.belongsTo(School);

School.hasMany(Class);
Class.belongsTo(School);

School.hasMany(Subject);
Subject.belongsTo(School);

// Class.hasMany(AcademicYear);
// AcademicYear.belongsTo(Class);
AcademicYear.hasMany(Class);
Class.belongsTo(AcademicYear);

Class.hasMany(Student);
Student.belongsTo(Class);

Class.hasMany(Subject);
Subject.belongsTo(Class);


Teacher.belongsToMany(School, { through: 'TeacherSchool' });
School.belongsToMany(Teacher, { through: 'TeacherSchool' });

// In StudentTimeline model
Student.hasMany(StudentTimeline, { foreignKey: 'StudentId' });
StudentTimeline.belongsTo(Student, { foreignKey: 'StudentId' });

//students.getSubject() => returns all subjects of a student
Student.belongsToMany(Subject, { through: 'StudentSubject' });






sequelize.sync({ alter: true })
.then(() => {
    console.log('Database synced successfully.');
})
.catch((err) => {
    console.log('Error syncing database: ', err);
});


