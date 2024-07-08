const express = require('express')
const adminConstraint = require('../middlewares/adminConstraint')
const router = express.Router()
const DashboardController = require('../controllers/DashboardController')



router.get('/dashboard', adminConstraint, DashboardController.getDashboardData);

module.exports = router
