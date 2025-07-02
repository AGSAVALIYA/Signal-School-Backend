/**
 * Student Model
 * Defines the database structure for student records in the school management system
 * Contains comprehensive student information including personal, academic, and contact details
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const AcademicYear = require('./AcademicYear');
const Class = require('./Class');

/**
 * Student Model Definition
 * Stores complete student information with personal, family, and academic details
 */
const Student = sequelize.define('Student', {
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Student name is mandatory
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false, // Age is required for academic planning
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true, // Date of birth for official records
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true, // Student's residential address
  },
  GRNumber: {
    type: DataTypes.STRING,
    allowNull: false, // Government Registration Number - unique identifier
  },
  imageLink: {
    type: DataTypes.STRING,
    allowNull: true, // URL to student's profile photo stored in S3
  },
  aadharNumber: {
    type: DataTypes.STRING,
    allowNull: true, // Aadhar card number for identity verification
  },
  panCardNumber: {
    type: DataTypes.STRING,
    allowNull: true, // PAN card number for financial records
  },
  fatherName: {
    type: DataTypes.STRING,
    allowNull: true, // Father's name for family information
  },
  motherName: {
    type: DataTypes.STRING,
    allowNull: true, // Mother's name for family information
  },
  contactNumber_1: {
    type: DataTypes.STRING,
    allowNull: true, // Primary contact number (usually parent/guardian)
  },
  contactNumber_2: {
    type: DataTypes.STRING,
    allowNull: true, // Secondary contact number for emergencies
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true, // Student's gender for demographic records
  },
  bloodGroup: {
    type: DataTypes.STRING,
    allowNull: true, // Blood group for medical emergencies
  }
});

// Define relationships with other models
Student.belongsTo(AcademicYear); // Student belongs to specific academic year
Student.belongsTo(Class);        // Student belongs to specific class

module.exports = Student;


