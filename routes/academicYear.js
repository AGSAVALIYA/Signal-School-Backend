const express = require('express');
const router = express.Router();
const AcademicYearController = require('../controllers/AcademicYearController');
const adminConstraint = require('../middlewares/adminConstraint');

router.post('/academicYear/create', adminConstraint, AcademicYearController.createAcademicYear);
router.post('/academicYear/setCurrentAcademicYear', adminConstraint, AcademicYearController.setCurrentAcademicYear);
router.get('/academicYear/getAll', adminConstraint, AcademicYearController.getAllAcademicYears);
router.get('/academicYear/get/:id', adminConstraint, AcademicYearController.getAcademicYearById);
router.put('/academicYear/update/:id', adminConstraint, adminConstraint,AcademicYearController.updateAcademicYear);
router.delete('/academicYear/delete/:id', adminConstraint,AcademicYearController.deleteAcademicYear);

module.exports = router;
