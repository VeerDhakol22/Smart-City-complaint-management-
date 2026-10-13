const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { requireUserAuth } = require('../middleware/authMiddleware');
const { handlePhotoUpload } = require('../middleware/uploadMiddleware');

// Complaint creation (citizen only) with optional photo upload
router.post('/', requireUserAuth, handlePhotoUpload, complaintController.createComplaint);

// My complaints list (citizen only)
router.get('/my', requireUserAuth, complaintController.getMyComplaints);

// Public / Citizen tracking by Complaint ID
router.get('/track/:complaintId', complaintController.trackComplaint);

// Complaint details by ID
router.get('/:id', complaintController.getComplaintDetails);

// Cancel complaint (citizen only)
router.post('/:id/cancel', requireUserAuth, complaintController.cancelComplaint);

module.exports = router;

