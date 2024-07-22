const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const School = require('../models/School');

module.exports = async (req, res, next) => {
    try {
        const tokenHeader = req.headers.authorization;

        if (!tokenHeader) {
            return res.status(401).json({ error: 'Authorization header missing' });
        }

        const token = req.headers.authorization.split(' ')[1];
        if (!token || token === '' || token === 'null' || token === 'undefined') {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findOne({ where: { email: decodedToken.email } });
        const teachers = await Teacher.findAll({ where: { email: decodedToken.email } , include: { model: School }});
        // //find where school id = teacher.currentSchool
        let teacher = null;
        if (teachers.length > 0) {
            // Assuming teachers is an array, we filter through each teacher
            // and find the one where currentSchool matches the ID of one of their associated schools.
            teacher = teachers.find(teacher => {
                // Checking if any of the teacher's associated schools have an ID that matches currentSchool
                return teacher.Schools.some(school => teacher.currentSchool === school.id);
            });
        }
        

        if (!admin && !teacher) {
            // Only send the response here, and use return to exit the function
            return res.status(401).json({ error: 'You are not authorized to access this route' });
        }

        if (admin) {
            req.user = 'admin';
            req.admin = admin;
            req.currentSchool = admin.currentSchool;
        } else if (teacher) {
            req.user = 'teacher';
            req.teacher = teacher;
            req.currentSchool = teacher.currentSchool;
        }
        next();
    } catch (error) {
        // Log the error for debugging purposes
        console.error(error);

        // Send an unauthorized response
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
