const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');


module.exports = async (req, res, next) => {
    try {
        // Extract authorization header from request
        const tokenHeader = req.headers.authorization;

        // Validate presence of authorization header
        if (!tokenHeader) {
            return res.status(401).json({ error: 'Authorization header missing' });
        }

        // Extract token from "Bearer <token>" format
        const token = tokenHeader.split(' ')[1];
        
        // Validate token existence and format
        if (!token || token === '' || token === 'null' || token === 'undefined') {
            return res.status(401).json({ error: 'Token missing or invalid' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findOne({ where: { id: decodedToken.id } });
        if (!admin) {
            throw new Error('You are not authorized to access this route');
        }
        req.admin = admin;
        req.user = "admin";
        next();
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}

