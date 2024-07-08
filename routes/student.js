const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/StudentController');
const adminConstraint = require('../middlewares/adminConstraint');
const tokenVerify = require('../middlewares/tokenVerify');

const multer = require('multer');
//save to tmp then delete 
const upload = multer({ dest: 'tmp/csv/' });




router.post('/student/create', tokenVerify,StudentController.createStudent);
router.get('/student/getAll', tokenVerify,StudentController.getAllStudents);
router.get('/student/getAll/:classId', tokenVerify, StudentController.getAllStudentsByClassId);
router.get('/student/get/:id',tokenVerify, StudentController.getStudentById);
router.put('/student/update/:id', tokenVerify,StudentController.updateStudent);
router.delete('/student/delete/:id',tokenVerify, StudentController.deleteStudent);
router.get('/student/searchName', tokenVerify,StudentController.searchStudentNames);
router.post('/student/addAvatar/:id',tokenVerify, StudentController.addAvatar);
router.get('/student/getSampleCsv/:classId', tokenVerify, StudentController.getSampleCsv);
// router.post('/student/uploadCsv/:classId', tokenVerify, StudentController.getStudentsFromCsv);
router.post('/student/uploadCsv/:classId', tokenVerify, upload.single('file'), StudentController.getStudentsFromCsv);



module.exports = router;

