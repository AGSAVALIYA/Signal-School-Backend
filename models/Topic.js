const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Topic = sequelize.define('Topic', {
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    }
});

module.exports = Topic;
