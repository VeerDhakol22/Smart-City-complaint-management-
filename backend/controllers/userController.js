const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Get profile of currently logged-in user
async function getProfile(req, res) {
    try {
        const userId = req.session.userId;
        const [users] = await pool.query(
            'SELECT id, name, email, mobile, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found.'
            });
        }

        return res.json({
            success: true,
            user: users[0]
        });
    } catch (err) {
        console.error('getProfile error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching profile.'
        });
    }
}

// Update profile (name and mobile)
async function updateProfile(req, res) {
    try {
        const userId = req.session.userId;
        const { name, mobile } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Name and mobile number are required.'
            });
        }

        const cleanMobile = mobile.trim();
        if (!/^[0-9]{10}$/.test(cleanMobile)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit mobile number.'
            });
        }

        await pool.query(
            'UPDATE users SET name = ?, mobile = ? WHERE id = ?',
            [name.trim(), cleanMobile, userId]
        );

        // Update session
        if (req.session.user) {
            req.session.user.name = name.trim();
            req.session.user.mobile = cleanMobile;
        }

        return res.json({
            success: true,
            message: 'Profile updated successfully!',
            user: {
                name: name.trim(),
                mobile: cleanMobile
            }
        });
    } catch (err) {
        console.error('updateProfile error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error updating profile.'
        });
    }
}

// Change password
async function changePassword(req, res) {
    try {
        const userId = req.session.userId;
        const { oldPassword, newPassword, confirmPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new passwords are required.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long.'
            });
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match.'
            });
        }

        const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const isOldValid = await bcrypt.compare(oldPassword, users[0].password_hash);
        if (!isOldValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

        return res.json({
            success: true,
            message: 'Password changed successfully!'
        });
    } catch (err) {
        console.error('changePassword error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error updating password.'
        });
    }
}

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};

