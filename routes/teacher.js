const express = require('express')
const adminConstraint = require('../middlewares/adminConstraint')
const router = express.Router()

const TeacherController = require('../controllers/TeacherController')
const tokenVerify = require('../middlewares/tokenVerify')

router.post('/teacher/login', TeacherController.teacherLogin)
router.post('/teacher/create', adminConstraint, TeacherController.createTeacher)
router.get('/teacher/getAll', adminConstraint,TeacherController.getAllTeachers)
router.get('/teacher/get/:id', adminConstraint,TeacherController.getTeacherById)
router.put('/teacher/update/:id', tokenVerify,TeacherController.updateTeacher)
router.put('/teacher/updatePassword/:id', adminConstraint,TeacherController.updateTeacherPassword)
router.post('/teacher/addAvatar/:id', tokenVerify,TeacherController.addTeacherAvatar)
router.get('/teacher/getLogs/:id', adminConstraint,TeacherController.getTeacherLogs)

router.delete('/teacher/delete/:id', adminConstraint,TeacherController.deleteTeacher)


module.exports = router