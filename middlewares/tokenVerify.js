const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');

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
        const teacher = await Teacher.findOne({ where: { email: decodedToken.email } });

        if (!admin && !teacher) {
            // Only send the response here, and use return to exit the function
            return res.status(401).json({ error: 'You are not authorized to access this route' });
        }

        if (admin) {
            req.user = 'admin';
            req.admin = admin;
        } else if (teacher) {
            req.user = 'teacher';
            req.teacher = teacher;
        }

        // Call next() outside of the if conditions
        next();
    } catch (error) {
        // Log the error for debugging purposes
        console.error(error);

        // Send an unauthorized response
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
