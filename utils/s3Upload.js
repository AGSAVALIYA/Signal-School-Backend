const AWS = require("aws-sdk");
const multer = require('multer');
const multerS3 = require('multer-s3-v2');
const path = require('path'); // Add this line

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_IAM_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_IAM_SECRET_ACCESS_KEY
}
);

// Function to upload an image to S3

function checkFileType(file, cb) {
  console.log(file);
  const filetypes = /jpg|png|jpeg/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb("Image only!");
  }
}

const uploadImageToAvatar = (req, res, file, keyData) => {
  return new Promise((resolve, reject) => {
    const upload = multer({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_AVATAR_BUCKET,
        key: function (req, file, cb) {
          //schoolId/studentId + extension name of file
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





module.exports = {
  uploadImageToAvatar
};