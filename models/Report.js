/**
 * Report Model
 * Defines the database structure for student academic reports
 * Supports different report types and stores academic performance data
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Report Model Definition
 * Stores academic report data for students including grades and performance details
 */
const Report = sequelize.define('Report', {
    reportType: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['s1', 's2', 'annual']] // Semester 1, Semester 2, or Annual report types
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false, // Detailed report content and feedback
    },
    grade: {
        type: DataTypes.STRING,
        allowNull: false, // Academic grade awarded (A, B, C, etc.)
    },
    GRNumber: {
        type: DataTypes.STRING,
        allowNull: false, // Student's Government Registration Number for identification
    },
});

module.exports = Report;


