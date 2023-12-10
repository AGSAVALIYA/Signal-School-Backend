const sequelize = require('../config/db');
const Student = require('./Student');
const Subject = require('./Subject');

const StudentSubject = sequelize.define('StudentSubject', {
  // This model will have no properties other than the foreign keys
});


Student.belongsToMany(Subject, { through: StudentSubject });
Subject.belongsToMany(Student, { through: StudentSubject });    

module.exports = StudentSubject;
