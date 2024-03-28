const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attendance = sequelize.define('Attendance', {
   
  
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    classId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    schoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('present', 'absent'),
        allowNull: false,
    },
    //unique constraint combination of studentId and date

}, {    
    uniqueKeys: {
        uniqueAttendance: {
            fields: ['studentId', 'date']
        }
    }
});

module.exports = Attendance;
