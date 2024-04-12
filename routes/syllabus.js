const express = require('express');
const router = express.Router();
const SyllabusController = require('../controllers/SyllabusController');
const tokenVerify = require('../middlewares/tokenVerify');
// Create a new syllabus
router.get('/syllabus/get/:subjectId',tokenVerify, SyllabusController.getSyllabus);
router.post('/syllabus/add/:subjectId',tokenVerify, SyllabusController.addSyllabus);
router.put('/syllabus/update/:chapterId', tokenVerify,SyllabusController.editChapter);
router.delete('/syllabus/delete/:chapterId', tokenVerify,SyllabusController.deleteChapter);
router.get('/syllabus/getFull' ,tokenVerify, SyllabusController.getFullForSchool);




module.exports = router;
