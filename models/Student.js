const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const AcademicYear = require('./AcademicYear');
const Class = require('./Class');

const Student = sequelize.define('Student', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  GRNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imageLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },

});

Student.belongsTo(AcademicYear);
Student.belongsTo(Class);

module.exports = Student;


