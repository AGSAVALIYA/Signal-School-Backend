const express = require('express');
const router = express.Router();
const ClassController = require('../controllers/ClassController');
const adminConstraint = require('../middlewares/adminConstraint');
const tokenVerify = require('../middlewares/tokenVerify');

router.post('/class/create', adminConstraint, ClassController.createClass);

//returns of current academic year
router.get('/class/getAll',tokenVerify, ClassController.getAllClasses);

//getBy academic year id
router.get('/class/getAll/:id',tokenVerify, ClassController.getClassesByAcademicYearId);

router.get('/class/get/:id',tokenVerify, ClassController.getClassById);
router.put('/class/update/:id',adminConstraint, ClassController.updateClass);
router.delete('/class/delete/:id',adminConstraint, ClassController.deleteClass);

module.exports = router;