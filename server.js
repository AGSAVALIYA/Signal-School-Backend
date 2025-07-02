// Import database models and establish connections
const DB = require('./models/index');

// Import required Express.js framework and middleware packages
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const AWS = require("aws-sdk");

// Load environment variables from .env file
dotenv.config();


// Initialize Express application
const app = express();

// Configure CORS to allow requests from any origin
app.use(cors({
    origin: '*'
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Configure body parser middleware to handle URL-encoded and JSON data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Import all route modules for different API endpoints
const AuthRoute = require('./routes/auth');               // Authentication routes (login, signup)
const OrganizationRoute = require('./routes/organization'); // Organization management routes
const SchoolRoute = require('./routes/school');            // School management routes
const TeacherRoute = require('./routes/teacher');          // Teacher management routes
const StudentRoute = require('./routes/student');          // Student management routes
const SubjectRoute = require('./routes/subject');          // Subject management routes
const AcademicYearRoute = require('./routes/academicYear'); // Academic year management routes
const ClassRoute = require('./routes/class');              // Class management routes
const StudentTimelineRoute = require('./routes/studenttimeline'); // Student timeline/activity routes
const ReportRoute = require('./routes/report');            // Report generation routes
const AttendanceRoute = require('./routes/attendance');    // Attendance tracking routes
const SyllabusRoute = require('./routes/syllabus');        // Syllabus management routes
const CommonSubjectRoute = require('./routes/commonsubject'); // Common subject routes
const DashboardRoute = require('./routes/dashboard');      // Dashboard analytics routes

// Register all route handlers with the Express application
app.use('/', AuthRoute);
app.use('/', OrganizationRoute);
app.use('/', SchoolRoute);
app.use('/', TeacherRoute);
app.use('/', StudentRoute);
app.use('/', SubjectRoute);
app.use('/', AcademicYearRoute);
app.use('/', ClassRoute);
app.use('/', StudentTimelineRoute);
app.use('/', ReportRoute);
app.use('/', AttendanceRoute);
app.use('/', SyllabusRoute);
app.use('/', CommonSubjectRoute);
app.use('/', DashboardRoute);

// Health check endpoint to verify API is running
app.get('/', (req, res) => {
    res.send('Signal School API D220724');
});

// Configure server port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
