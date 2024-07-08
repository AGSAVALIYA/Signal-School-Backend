const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');


const Logs = sequelize.define('Logs', {
    userType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
    },  
    description: {
        type: DataTypes.STRING,
        allowNull: false,
    }
});
O