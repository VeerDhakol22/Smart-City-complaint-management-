const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Citizen registration & login
router.post('/register', authController.register);
router.post('/login', authController.login);

// Admin login
router.post('/admin/login', authController.adminLogin);

// Logout & session check
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

module.exports = router;

