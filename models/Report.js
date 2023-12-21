const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Report = sequelize.define('Report', {
    reportType: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['s1', 's2', 'annual']]
        }
    },
    content : {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    grade: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    GRNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },

});




module.exports = Report;


