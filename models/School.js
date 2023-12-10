const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Organization = require('./Organization');

const School = sequelize.define('School', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contactNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  currentAcademicYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

School.belongsTo(Organization);

module.exports = School;
