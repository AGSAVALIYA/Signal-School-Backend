const express = require('express')
const router = express.Router()

const ReportController = require('../controllers/ReportController')
const tokenVerify = require('../middlewares/tokenVerify')

router.post('/report/create', tokenVerify, ReportController.createReport)


module.exports = router