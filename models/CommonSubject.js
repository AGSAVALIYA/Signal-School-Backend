const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CommonSubject = sequelize.define('CommonSubject', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

module.exports = CommonSubject;

