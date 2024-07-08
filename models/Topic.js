const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Topic = sequelize.define('Topic', {
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    completedDate: {    
        type: DataTypes.DATEONLY,
        allowNull: true
    },
});

module.exports = Topic;
