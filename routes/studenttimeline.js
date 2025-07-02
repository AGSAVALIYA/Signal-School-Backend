/**
 * Student Timeline Routes
 * Handles API endpoints for student activity timeline management with file upload capabilities
 * Supports both individual and bulk timeline creation with AWS S3 image uploads
 */

const express = require('express')
const router = express.Router()
const adminConstraint = require('../middlewares/adminConstraint')
const tokenVerify = require('../middlewares/tokenVerify')
const AWS = require("aws-sdk");
const multer = require('multer');
const multerS3 = require('multer-s3-v2');
const path = require('path');

/**
 * AWS S3 Configuration for Timeline Image Uploads
 * Configures S3 client with credentials for storing timeline images
 */
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_IAM_SECRET_ACCESS_KEY
});

/**
 * File type validation for image uploads
 * Ensures only specific file types are allowed for timeline images
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback function for validation result
 */
function checkFileType(file, cb) {
    const filetypes = /jpg|png|jpeg|gif|pdf|doc|docx|xls|xlsx/; // Allowed file extensions
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true); // File type is valid
    } else {
        cb("Image only!"); // Reject invalid file types
    }
}

/**
 * Multer S3 Upload Configuration for Timeline Images
 * Configures file upload with organized folder structure based on date and student ID
 */
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_TIMELINE_BUCKET,
        key: function (req, file, cb) {
            let studentId = req.params.studentId;
            // Create date-based folder structure (e.g., 05-04-2023/)
            let dateTime = new Date().toLocaleDateString().split('/').join('-');
            // Add timestamp for unique file naming (e.g., 01:23:45 AM)
            let time = new Date().toLocaleTimeString();
            cb(null, `${dateTime}/${time}-${studentId}${path.extname(file.originalname)}`);
        }
    }),
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
})

// Import timeline controller
const StudentTimeline = require('../controllers/StudentTimelineController')

// POST /studentTimeline/create/:studentId - Create timeline entry for individual student
router.post('/studentTimeline/create/:studentId', tokenVerify, upload.fields([
    { name: 'timelineImg', maxCount: 1 }
]), StudentTimeline.createStudentTimeline)

// POST /studentTimeline/bulkCreate/:classId - Create timeline entries for entire class
router.post('/studentTimeline/bulkCreate/:classId', tokenVerify, upload.fields([
    { name: 'timelineImg', maxCount: 1 }
]), StudentTimeline.bulkCreateStudentTimeline)

// GET /studentTimeline/getAll/:studentId - Retrieve all timeline entries for a student
router.get('/studentTimeline/getAll/:studentId', tokenVerify, StudentTimeline.getStudentTimelinesByStudentId)

// PUT /studentTimeline/update/:id - Update existing timeline entry
router.put('/studentTimeline/update/:id', tokenVerify, StudentTimeline.updateStudentTimeline)

// DELETE /studentTimeline/delete/:id - Delete timeline entry
router.delete('/studentTimeline/delete/:id', tokenVerify, StudentTimeline.deleteStudentTimeline)

module.exports = router
