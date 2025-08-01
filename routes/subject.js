const expess = require('express');
const router = expess.Router();
const SubjectController = require('../controllers/SubjectController');
const adminConstraint = require('../middlewares/adminConstraint');
const tokenVerify = require('../middlewares/tokenVerify');

router.post('/subject/create', adminConstraint,SubjectController.createSubject);
router.get('/subject/getAll/:classId', tokenVerify,SubjectController.getAllSubjects);
router.get('/subject/get/:id', adminConstraint,SubjectController.getSubjectById);
router.put('/subject/update/:id', adminConstraint,SubjectController.updateSubject);
router.delete('/subject/delete/:id', adminConstraint,SubjectController.deleteSubject);

module.exports = router;