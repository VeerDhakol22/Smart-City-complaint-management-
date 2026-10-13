const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdminAuth } = require('../middleware/adminMiddleware');

// Protect all admin endpoints with admin session authorization
router.use(requireAdminAuth);

router.get('/statistics', adminController.getStatistics);
router.get('/complaints', adminController.getComplaints);
router.get('/complaints/:id', adminController.getComplaintById);
router.patch('/complaints/:id/status', adminController.updateComplaintStatus);
router.post('/complaints/:id/updates', adminController.updateComplaintStatus);

module.exports = router;

