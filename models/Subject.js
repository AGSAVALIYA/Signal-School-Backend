const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const AcademicYear = require('./AcademicYear');
const Class = require('./Class');
const Chapter = require('./Chapter');

const Subject = sequelize.define('Subject', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Subject.belongsTo(AcademicYear);
Subject.belongsTo(Class);
Subject.hasMany(Chapter);
Chapter.belongsTo(Subject);

module.exports = Subject;
