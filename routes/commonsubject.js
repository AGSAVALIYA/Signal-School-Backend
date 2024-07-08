const express = require('express');
const router = express.Router();
const CommonSubjectController = require('../controllers/CommonStubjectController');
const adminConstraint = require('../middlewares/adminConstraint');


router.post('/commonsubject/create', adminConstraint, CommonSubjectController.createCommonSubject);
router.get('/commonsubject/getAll/:academicYearId', adminConstraint, CommonSubjectController.getAllCommonSubjects);
router.get('/commonsubject/getAll', adminConstraint, CommonSubjectController.getAllCommonSubjects);

module.exports = router;