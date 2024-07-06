const express = require('express')
const router = express.Router()
const adminConstraint = require('../middlewares/adminConstraint')
const tokenVerify = require('../middlewares/tokenVerify')
const AWS = require("aws-sdk");
const multer = require('multer');
const multerS3 = require('multer-s3-v2');
const path = require('path'); // Add this line


const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_IAM_SECRET_ACCESS_KEY
  }
  );
  
  function checkFileType(file, cb) {
    const filetypes = /jpg|png|jpeg|gif|pdf|doc|docx|xls|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
  
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb("Image only!");
    }
  }
    

  const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_TIMELINE_BUCKET,
    key: function (req, file, cb) {
        let studentId = req.params.studentId;
        //date like 05-04-2023/
        let dateTime = new Date().toLocaleDateString().split('/').join('-');
        //only time  like 01:23:45 AM
        let time = new Date().toLocaleTimeString();
        cb(null, `${dateTime}/${time}-${studentId}${path.extname(file.originalname)}`);
      }
    }),
    fileFilter: function (req, file, cb) {4
      checkFileType(file, cb);
    }
  })
    

const StudentTimeline = require('../controllers/StudentTimelineController')

router.post('/studentTimeline/create/:studentId',tokenVerify, upload.fields([
    { name: 'timelineImg', maxCount: 1 }
  ]), StudentTimeline.createStudentTimeline)
router.post('/studentTimeline/bulkCreate/:classId', tokenVerify, upload.fields([
    { name: 'timelineImg', maxCount: 1 }
  ]), StudentTimeline.bulkCreateStudentTimeline)

router.get('/studentTimeline/getAll/:studentId',tokenVerify, StudentTimeline.getStudentTimelinesByStudentId)
router.put('/studentTimeline/update/:id',tokenVerify, StudentTimeline.updateStudentTimeline)
router.delete('/studentTimeline/delete/:id',tokenVerify, StudentTimeline.deleteStudentTimeline)

module.exports = router
