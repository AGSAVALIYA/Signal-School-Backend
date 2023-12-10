const Admin = require("../models/Admin");
const Organization = require("../models/Organization");
const School = require("../models/School");

module.exports.adminDetails = async function (adminId) {
    const admin = await Admin.findOne({
        where: { id: adminId },
        include: {
            model: Organization,
            include: { model: School }
        }
    });
    if(admin.currentSchool){
        admin.currentSchool = await School.findOne({where: {id: admin.currentSchool}});
        admin.userType = 'admin'
    }
    return admin;
};
