/**
 * Logs Model
 * Defines the database structure for activity logging and audit trail
 * Tracks actions performed by admins and teachers for security and monitoring purposes
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Logs Model Definition
 * Stores activity logs for audit trail and system monitoring
 * Tracks who performed what actions and when
 */
const Logs = sequelize.define('Logs', {
    userType: {
        type: DataTypes.STRING,
        allowNull: false, // Type of user ('admin' or 'teacher') who performed the action
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false, // Action type (e.g., 'Create', 'Update', 'Delete')
    },  
    description: {
        type: DataTypes.STRING,
        allowNull: false, // Detailed description of the action performed
    }
    // Note: adminId and teacherId foreign keys are defined in models/index.js relationships
});

module.exports = Logs;