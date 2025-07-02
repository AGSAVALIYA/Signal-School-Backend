// Import required models for admin information retrieval
const Admin = require("../models/Admin");
const Organization = require("../models/Organization");
const School = require("../models/School");

/**
 * Utility function to retrieve comprehensive admin details with associated organization and school information
 * @param {number} adminId - The unique identifier of the admin user
 * @returns {Object} Complete admin object with nested organization and school data
 */
module.exports.adminDetails = async function (adminId) {
    // Fetch admin details with associated organization and schools
    const admin = await Admin.findOne({
        where: { id: adminId },
        include: {
            model: Organization,
            include: { model: School } // Include all schools under the organization
        }
    });
    
    // If admin has a current school assignment, fetch detailed school information
    if(admin.currentSchool){
        admin.currentSchool = await School.findOne({where: {id: admin.currentSchool}});
        admin.userType = 'admin' // Set user type for authorization purposes
    }
    
    return admin;
};
