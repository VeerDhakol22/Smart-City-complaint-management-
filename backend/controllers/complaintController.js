const { pool } = require('../config/db');

// Helper to generate a unique readable Complaint ID
function generateComplaintId() {
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CMP-${timestamp}-${rand}`;
}

// Create new complaint
async function createComplaint(req, res) {
    const connection = await pool.getConnection();
    try {
        const userId = req.session.userId;
        const { title, category, priority, description, location } = req.body;

        if (!title || !category || !description || !location) {
            return res.status(400).json({
                success: false,
                message: 'Title, category, description, and location are required.'
            });
        }

        const validCategories = ['Road', 'Garbage', 'Water', 'Electricity', 'Drainage', 'Street Light', 'Other'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid complaint category selected.'
            });
        }

        const validPriorities = ['Low', 'Medium', 'High'];
        const chosenPriority = validPriorities.includes(priority) ? priority : 'Medium';

        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
        const complaintId = generateComplaintId();

        await connection.beginTransaction();

        // 1. Insert into complaints table
        const [complaintResult] = await connection.query(
            `INSERT INTO complaints 
            (complaint_id, user_id, title, category, description, location, priority, photo_path, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [complaintId, userId, title.trim(), category, description.trim(), location.trim(), chosenPriority, photoPath]
        );

        const internalId = complaintResult.insertId;

        // 2. Insert initial entry into complaint_updates audit table
        await connection.query(
            `INSERT INTO complaint_updates 
            (complaint_id, admin_id, old_status, new_status, admin_reply, action_description)
            VALUES (?, NULL, NULL, 'Pending', NULL, 'Complaint registered in municipal portal.')`,
            [internalId]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Complaint submitted successfully!',
            complaintId: complaintId,
            complaint: {
                id: internalId,
                complaint_id: complaintId,
                title: title.trim(),
                category: category,
                priority: chosenPriority,
                status: 'Pending',
                photo_path: photoPath
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('createComplaint error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error submitting complaint.'
        });
    } finally {
        connection.release();
    }
}

// Get complaints of logged-in citizen
async function getMyComplaints(req, res) {
    try {
        const userId = req.session.userId;
        const [complaints] = await pool.query(
            `SELECT c.id, c.complaint_id, c.title, c.category, c.priority, c.status, 
                    c.location, c.photo_path, c.created_at, c.updated_at,
                    (SELECT admin_reply FROM complaint_updates 
                     WHERE complaint_id = c.id AND admin_reply IS NOT NULL 
                     ORDER BY id DESC LIMIT 1) as latest_admin_reply
             FROM complaints c
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [userId]
        );

        return res.json({
            success: true,
            complaints: complaints
        });
    } catch (err) {
        console.error('getMyComplaints error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching your complaints.'
        });
    }
}

// Get complaint details by ID (with audit timeline)
async function getComplaintDetails(req, res) {
    try {
        const identifier = req.params.id;
        const userId = req.session.userId;
        const adminId = req.session.adminId;

        // Find complaint either by internal numeric id or unique complaint_id string
        const [complaints] = await pool.query(
            `SELECT c.*, u.name as user_name, u.email as user_email, u.mobile as user_mobile
             FROM complaints c
             JOIN users u ON c.user_id = u.id
             WHERE c.id = ? OR c.complaint_id = ?`,
            [identifier, identifier]
        );

        if (complaints.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        const complaint = complaints[0];

        // Authorization check: If not admin, the complaint must belong to the requesting user
        if (!adminId && complaint.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own complaints.'
            });
        }

        // Fetch audit updates history
        const [updates] = await pool.query(
            `SELECT cu.id, cu.old_status, cu.new_status, cu.admin_reply, cu.action_description, 
                    cu.created_at, a.name as admin_name
             FROM complaint_updates cu
             LEFT JOIN admins a ON cu.admin_id = a.id
             WHERE cu.complaint_id = ?
             ORDER BY cu.created_at ASC`,
            [complaint.id]
        );

        return res.json({
            success: true,
            complaint: complaint,
            updates: updates
        });
    } catch (err) {
        console.error('getComplaintDetails error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching complaint details.'
        });
    }
}

// Track complaint by Complaint ID (public/citizen tracking with safe sanitized view)
async function trackComplaint(req, res) {
    try {
        const complaintId = (req.params.complaintId || '').trim();
        if (!complaintId) {
            return res.status(400).json({
                success: false,
                message: 'Complaint ID is required for tracking.'
            });
        }

        const [complaints] = await pool.query(
            `SELECT c.id, c.complaint_id, c.user_id, c.title, c.category, c.priority, 
                    c.status, c.location, c.photo_path, c.created_at, c.updated_at,
                    c.description
             FROM complaints c
             WHERE c.complaint_id = ?`,
            [complaintId]
        );

        if (complaints.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found. Please verify the Complaint ID.'
            });
        }

        const complaint = complaints[0];

        // If user is logged in and it's their complaint, or if it's admin, they can see full details
        const isOwner = req.session && req.session.userId === complaint.user_id;
        const isAdmin = req.session && !!req.session.adminId;

        // Fetch updates history
        const [updates] = await pool.query(
            `SELECT cu.id, cu.old_status, cu.new_status, cu.admin_reply, cu.action_description, 
                    cu.created_at, a.name as admin_name
             FROM complaint_updates cu
             LEFT JOIN admins a ON cu.admin_id = a.id
             WHERE cu.complaint_id = ?
             ORDER BY cu.created_at ASC`,
            [complaint.id]
        );

        return res.json({
            success: true,
            isOwner: isOwner || isAdmin,
            complaint: {
                id: complaint.id,
                complaint_id: complaint.complaint_id,
                title: complaint.title,
                category: complaint.category,
                priority: complaint.priority,
                status: complaint.status,
                location: complaint.location,
                photo_path: complaint.photo_path,
                created_at: complaint.created_at,
                updated_at: complaint.updated_at,
                description: complaint.description
            },
            updates: updates
        });
    } catch (err) {
        console.error('trackComplaint error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error tracking complaint.'
        });
    }
}

// Cancel a complaint (citizen allowed only if status is Pending)
async function cancelComplaint(req, res) {
    const connection = await pool.getConnection();
    try {
        const identifier = req.params.id;
        const userId = req.session.userId;

        const [complaints] = await connection.query(
            'SELECT id, complaint_id, user_id, status FROM complaints WHERE (id = ? OR complaint_id = ?) AND user_id = ?',
            [identifier, identifier, userId]
        );

        if (complaints.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found or not owned by you.'
            });
        }

        const complaint = complaints[0];

        if (complaint.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Complaint cannot be cancelled because it is already '${complaint.status}'.`
            });
        }

        await connection.beginTransaction();

        // 1. Update status to Cancelled
        await connection.query(
            "UPDATE complaints SET status = 'Cancelled' WHERE id = ?",
            [complaint.id]
        );

        // 2. Insert update audit trail
        await connection.query(
            `INSERT INTO complaint_updates 
            (complaint_id, admin_id, old_status, new_status, admin_reply, action_description)
            VALUES (?, NULL, 'Pending', 'Cancelled', NULL, 'Complaint was cancelled by the citizen.')`,
            [complaint.id]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: 'Complaint has been successfully cancelled.'
        });
    } catch (err) {
        await connection.rollback();
        console.error('cancelComplaint error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error cancelling complaint.'
        });
    } finally {
        connection.release();
    }
}

module.exports = {
    createComplaint,
    getMyComplaints,
    getComplaintDetails,
    trackComplaint,
    cancelComplaint
};

