const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Topic = require('./Topic');

const Chapter = sequelize.define('Chapter', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

Chapter.hasMany(Topic);
Topic.belongsTo(Chapter);

module.exports = Chapter;
