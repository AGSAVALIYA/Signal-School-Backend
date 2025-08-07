/**
 * Token Verification Middleware
 * Validates JWT tokens and authenticates admin and teacher users
 * Sets up request context with user information for subsequent route handlers
 */

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const School = require('../models/School');

/**
 * JWT Token Authentication Middleware
 * Verifies the authorization token and populates request object with user data
 * Supports both admin and teacher authentication flows
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
module.exports = async (req, res, next) => {
    try {
        // Extract authorization header from request
        const tokenHeader = req.headers.authorization;

        // Validate presence of authorization header
        if (!tokenHeader) {
            return res.status(401).json({ error: 'Authorization header missing' });
        }

        // Extract token from "Bearer <token>" format
        const token = req.headers.authorization.split(' ')[1];
        
        // Validate token existence and format
        if (!token || token === '' || token === 'null' || token === 'undefined') {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        // Verify and decode JWT token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        
        // Look up admin user by email from token
        const admin = await Admin.findOne({ where: { email: decodedToken.email } });
        
        // Look up active teacher users by email with associated schools
        const teachers = await Teacher.findAll({ 
            where: { email: decodedToken.email, status: 'active' }, 
            include: { model: School }
        });
        
        // Find the correct teacher based on current school assignment
        let teacher = null;
        if (teachers.length > 0) {
            // Filter teachers to find one whose currentSchool matches an associated school
            teacher = teachers.find(teacher => {
                // Check if teacher's current school matches any of their associated schools
                return teacher.Schools.some(school => teacher.currentSchool === school.id);
            });
        }

        // Ensure either admin or teacher authentication was successful
        if (!admin && !teacher) {
            return res.status(401).json({ error: 'You are not authorized to access this route' });
        }

        // Set request context based on authenticated user type
        if (admin) {
            req.user = 'admin';
            req.admin = admin;
            req.currentSchool = admin.currentSchool;
        } else if (teacher) {
            req.user = 'teacher';
            req.teacher = teacher;
            req.currentSchool = teacher.currentSchool;
        }
        
        // Continue to next middleware/route handler
        next();
    } catch (error) {
        // Log authentication errors for debugging
        console.error(error);

        // Return unauthorized response for any authentication failures
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
