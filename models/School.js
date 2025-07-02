/**
 * School Model
 * Defines the database structure for individual schools within organizations
 * Schools contain students, teachers, classes, and academic programs
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Organization = require('./Organization');

/**
 * School Model Definition
 * Represents individual educational institutions under an organization
 */
const School = sequelize.define('School', {
  name: {
    type: DataTypes.STRING,
    allowNull: false, // School name is mandatory
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true, // Physical address of the school
  },
  contactNumber: {
    type: DataTypes.STRING,
    allowNull: true, // School's contact number for communication
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false, // Geographic location (city/area) of the school
  },
  currentAcademicYear: {
    type: DataTypes.INTEGER,
    allowNull: true, // ID of the currently active academic year
  },
});

// Define relationship with organization (school belongs to an organization)
School.belongsTo(Organization);

module.exports = School;
