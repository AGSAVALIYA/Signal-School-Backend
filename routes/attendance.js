const express  = require('express')
const tokenVerify = require('../middlewares/tokenVerify')
const { getClassWiseAttendance } = require('../controllers/AttendanceController')
const router = express.Router()


router.get('/attendance/:classId',  getClassWiseAttendance);


module.exports = router