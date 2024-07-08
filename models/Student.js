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
  aadharNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  panCardNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fatherName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  motherName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contactNumber_1: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contactNumber_2: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bloodGroup: {
    type: DataTypes.STRING,
    allowNull: true,
  }
});

Student.belongsTo(AcademicYear);
Student.belongsTo(Class);

module.exports = Student;


