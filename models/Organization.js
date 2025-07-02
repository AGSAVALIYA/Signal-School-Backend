/**
 * Organization Model
 * Defines the database structure for educational organizations
 * Organizations are the top-level entities that manage multiple schools
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Organization Model Definition
 * Represents educational institutions or groups that operate multiple schools
 */
const Organization = sequelize.define('Organization', {
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Organization name is mandatory
  },
  headOffice: {
    type: DataTypes.STRING,
    allowNull: true, // Main office address of the organization
  },
  contactNumber: {
    type: DataTypes.STRING,
    allowNull: true, // Primary contact number for the organization
  }
});

module.exports = Organization;
