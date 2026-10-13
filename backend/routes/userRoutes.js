const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireUserAuth } = require('../middleware/authMiddleware');

// Protected profile routes
router.get('/profile', requireUserAuth, userController.getProfile);
router.put('/profile', requireUserAuth, userController.updateProfile);
router.put('/change-password', requireUserAuth, userController.changePassword);

module.exports = router;

