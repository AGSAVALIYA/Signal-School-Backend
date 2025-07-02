/**
 * Authentication Routes
 * Defines API endpoints for admin authentication and management
 * Handles registration, login, and CRUD operations for admin users
 */

const express = require('express')
const router = express.Router()
const adminConstraint = require('../middlewares/adminConstraint')
const tokenVerify = require('../middlewares/tokenVerify')
const AdminController = require('../controllers/AdminController')

// POST /admin/register - Register a new admin user
router.post('/admin/register', AdminController.AdminRegister)

// POST /admin/login - Authenticate admin user and return JWT token
router.post('/admin/login', AdminController.AdminLogin)

// GET /admin/getAll - Retrieve all admin users (requires authentication)
router.get('/admin/getAll', AdminController.AdminRetrieve)

// GET /admin/get/:id - Retrieve specific admin user by ID
router.get('/admin/get/:id', AdminController.AdminRetrieveById)

// PUT /admin/update/:id - Update admin user information (requires admin privileges)
router.put('/admin/update/:id', adminConstraint, AdminController.AdminUpdate)

// DELETE /admin/delete/:id - Delete admin user (requires admin privileges)
router.delete('/admin/delete/:id', adminConstraint, AdminController.AdminDelete)

module.exports = router

