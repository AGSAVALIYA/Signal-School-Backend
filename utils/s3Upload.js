// Import AWS SDK and multer for file upload functionality
const AWS = require("aws-sdk");
const multer = require('multer');
const multerS3 = require('multer-s3-v2');
const path = require('path');

/**
 * AWS S3 Upload Utility
 * Provides functions for uploading various types of images to different S3 buckets
 * Used for student avatars, timeline images, and faculty profile pictures
 */

// Configure AWS S3 client with credentials from environment variables
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_IAM_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_IAM_SECRET_ACCESS_KEY
});

/**
 * File type validation function for image uploads
 * Ensures only image files (jpg, png, jpeg) are uploaded
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback function to indicate validation result
 */
function checkFileType(file, cb) {
  const filetypes = /jpg|png|jpeg/; // Allowed file extensions
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true); // File type is valid
  } else {
    cb("Image only!"); // Reject non-image files
  }
}

/**
 * Upload student avatar image to S3 avatar bucket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} file - File object to upload
 * @param {Object} keyData - Object containing academicYearId and studentId for file naming
 * @returns {Promise} Promise that resolves with S3 upload location
 */
const uploadImageToAvatar = (req, res, file, keyData) => {
  return new Promise((resolve, reject) => {
    const upload = multer({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_AVATAR_BUCKET,
        key: function (req, file, cb) {
          // Generate unique file path: academicYearId/studentId + file extension
          cb(null, `${keyData.academicYearId}/${keyData.studentId}${path.extname(file.originalname)}`);
        }
      }),
      fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
      }
    }).single('avatar'); 
    
    upload(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({ Location: req.file.location }); 
      }
    });
  });
};

/**
 * Upload timeline image to S3 timeline bucket
 * Used for student activity timeline photos
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} keyData - Object containing academicYearId, studentId, and date for file naming
 * @returns {Promise} Promise that resolves with S3 upload location
 */
const uploadImageToTimeline = (req, res,  keyData) => {
  return new Promise((resolve, reject) => {
    const upload = multer({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_TIMELINE_BUCKET,
        key: function (req, file, cb) {
          // Generate unique file path: academicYearId/studentId-date + file extension
          cb(null, `${keyData.academicYearId}/${keyData.studentId}-${keyData.date}${path.extname(file.originalname)}`);
        }
      }),
      fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
      }
    })
    .single('timelineImg');
    
    upload(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({ Location: req.file.location }); 
      }
    });
  });  
};

/**
 * Upload faculty/teacher avatar image to S3 faculty bucket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} file - File object to upload
 * @param {Object} keyData - Object containing facultyId for file naming
 * @returns {Promise} Promise that resolves with S3 upload location
 */
const uploadFacultyAvatar = (req, res,file, keyData) => {
  return new Promise((resolve, reject) => {
    const upload = multer({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_FACULTY_BUCKET,
        key: function (req, file, cb) {
          // Store faculty avatars in organized folder structure
          cb(null, `images/avatar/${keyData.facultyId}${path.extname(file.originalname)}`);
        }
      }),
      fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
      }
    })
    .single('avatar');
    
    upload(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({ Location: req.file.location }); 
      }
    });
  });
};

module.exports = {
  uploadImageToAvatar,
  uploadImageToTimeline,
  uploadFacultyAvatar
};