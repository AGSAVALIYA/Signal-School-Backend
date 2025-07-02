// Import the Logs model for activity tracking
const Logs = require("../models/Logs")

/**
 * Utility function to create activity logs for admin and teacher actions
 * This function tracks user activities for audit purposes and system monitoring
 * 
 * @param {string} usertype - Type of user performing the action ('admin' or 'teacher')
 * @param {string} action - The action being performed (e.g., 'Create', 'Update', 'Delete')
 * @param {string} description - Detailed description of the action performed
 * @param {number} userId - The unique identifier of the user performing the action
 * @returns {void} Creates a log entry in the database
 */
const createLog = (usertype, action, description, userId) => {
    // Validate required parameters before creating log entry
    if (!usertype || !action || !description || !userId) {
        return
    }
    
    // Ensure usertype is valid (only admin and teacher are supported)
    if (usertype !== "admin" && usertype !== "teacher") {
        return
    }
    
    // Create log entry for admin users
    if (usertype === "admin") {
        Logs.create({
            userType: usertype,
            action: action,
            description: description,
            adminId: userId // Link log to specific admin user
        })
    }
    
    // Create log entry for teacher users
    if (usertype === "teacher") {
        Logs.create({
            userType: usertype,
            action: action,
            description: description,
            teacherId: userId // Link log to specific teacher user
        })
    }
}

module.exports = {
    createLog
}
