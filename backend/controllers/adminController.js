const { pool } = require('../config/db');

// Get overall statistics
async function getStatistics(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM complaints
        `);

        const stats = rows[0] || {};
        return res.json({
            success: true,
            statistics: {
                total: Number(stats.total) || 0,
                pending: Number(stats.pending) || 0,
                in_progress: Number(stats.in_progress) || 0,
                resolved: Number(stats.resolved) || 0,
                cancelled: Number(stats.cancelled) || 0
            }
        });
    } catch (err) {
        console.error('getStatistics error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching statistics.'
        });
    }
}

// Get filtered complaints list for admin
async function getComplaints(req, res) {
    try {
        const { status, category, search, priority } = req.query;

        let query = `
            SELECT c.id, c.complaint_id, c.title, c.category, c.priority, c.status,
                   c.location, c.photo_path, c.created_at, c.updated_at,
                   u.name as citizen_name, u.email as citizen_email, u.mobile as citizen_mobile,
                   (SELECT admin_reply FROM complaint_updates 
                    WHERE complaint_id = c.id AND admin_reply IS NOT NULL 
                    ORDER BY id DESC LIMIT 1) as latest_admin_reply
            FROM complaints c
            JOIN users u ON c.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'All') {
            query += ' AND c.status = ?';
            params.push(status);
        }

        if (category && category !== 'All') {
            query += ' AND c.category = ?';
            params.push(category);
        }

        if (priority && priority !== 'All') {
            query += ' AND c.priority = ?';
            params.push(priority);
        }

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            query += ` AND (
                c.complaint_id LIKE ? OR 
                c.title LIKE ? OR 
                c.location LIKE ? OR 
                u.name LIKE ? OR 
                u.email LIKE ? OR 
                u.mobile LIKE ?
            )`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY c.created_at DESC';

        const [complaints] = await pool.query(query, params);

        return res.json({
            success: true,
            count: complaints.length,
            complaints: complaints
        });
    } catch (err) {
        console.error('admin getComplaints error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching complaints.'
        });
    }
}

// Get single complaint with full details and audit trail
async function getComplaintById(req, res) {
    try {
        const id = req.params.id;

        const [complaints] = await pool.query(
            `SELECT c.*, u.name as citizen_name, u.email as citizen_email, u.mobile as citizen_mobile
             FROM complaints c
             JOIN users u ON c.user_id = u.id
             WHERE c.id = ? OR c.complaint_id = ?`,
            [id, id]
        );

        if (complaints.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        const complaint = complaints[0];

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
        console.error('admin getComplaintById error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching complaint details.'
        });
    }
}

// Update status and record admin reply
async function updateComplaintStatus(req, res) {
    const connection = await pool.getConnection();
    try {
        const id = req.params.id;
        const adminId = req.session.adminId;
        const { status, adminReply, actionDescription } = req.body;

        const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid complaint status is required.'
            });
        }

        const [complaints] = await connection.query(
            'SELECT id, complaint_id, status FROM complaints WHERE id = ? OR complaint_id = ?',
            [id, id]
        );

        if (complaints.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        const complaint = complaints[0];
        const oldStatus = complaint.status;

        await connection.beginTransaction();

        // 1. Update status
        await connection.query(
            'UPDATE complaints SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, complaint.id]
        );

        // 2. Insert into complaint_updates audit log
        const replyText = adminReply ? adminReply.trim() : null;
        const actionText = actionDescription 
            ? actionDescription.trim() 
            : (oldStatus !== status ? `Status changed from ${oldStatus} to ${status}.` : 'Administrative review note added.');

        await connection.query(
            `INSERT INTO complaint_updates 
            (complaint_id, admin_id, old_status, new_status, admin_reply, action_description)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [complaint.id, adminId, oldStatus, status, replyText, actionText]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: 'Complaint status and admin reply updated successfully!',
            complaint: {
                id: complaint.id,
                complaint_id: complaint.complaint_id,
                old_status: oldStatus,
                new_status: status,
                admin_reply: replyText
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('updateComplaintStatus error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error updating complaint status.'
        });
    } finally {
        connection.release();
    }
}

module.exports = {
    getStatistics,
    getComplaints,
    getComplaintById,
    updateComplaintStatus
};

