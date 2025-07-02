/**
 * Teacher Model
 * Defines the database structure for teacher accounts in the school management system
 * Teachers can be associated with multiple schools and have authentication capabilities
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const School = require('./School');

/**
 * Teacher Model Definition
 * Stores teacher profile information and authentication credentials
 */
const Teacher = sequelize.define('Teacher', {
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Teacher's full name is required
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Email must be unique for login purposes
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false, // Hashed password for authentication
  },
  imageLink: {
    type: DataTypes.STRING,
    allowNull: true, // URL to teacher's profile photo stored in S3
  },
  contactNumber: {
    type: DataTypes.STRING,
    allowNull: true, // Teacher's contact number for communication
  },
  currentSchool: {
    type: DataTypes.INTEGER,
    allowNull: false, // ID of the school where teacher is currently active
  },
});

// Define many-to-many relationship with schools (teachers can work at multiple schools)
Teacher.belongsToMany(School, { through: 'TeacherSchool' });

module.exports = Teacher;
