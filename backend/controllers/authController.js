const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Register Citizen
async function register(req, res) {
    try {
        const { name, email, mobile, password, confirmPassword } = req.body;

        if (!name || !email || !mobile || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        const cleanMobile = mobile.trim();
        if (!/^[0-9]{10}$/.test(cleanMobile)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 10-digit mobile number.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match.'
            });
        }

        // Check duplicate email
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This email is already registered. Please log in.'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (name, email, mobile, password_hash) VALUES (?, ?, ?, ?)',
            [name.trim(), trimmedEmail, cleanMobile, passwordHash]
        );

        return res.status(201).json({
            success: true,
            message: 'Registration successful! You can now log in.',
            userId: result.insertId
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during registration.'
        });
    }
}

// Login Citizen
async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();
        const [users] = await pool.query(
            'SELECT id, name, email, mobile, password_hash FROM users WHERE email = ?',
            [trimmedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Set session
        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile
        };

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error('Session save error:', saveErr);
            }
            return res.json({
                success: true,
                message: 'Login successful!',
                user: req.session.user
            });
        });
    } catch (err) {
        console.error('Citizen login error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during login.'
        });
    }
}

// Login Administrator
async function adminLogin(req, res) {
    try {
        const { username, email, password } = req.body;
        const identifier = (email || username || '').trim();

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/Email and password are required.'
            });
        }

        // Query by email, name, role, or matching 'admin' keyword
        const [admins] = await pool.query(
            'SELECT id, name, email, password_hash, role FROM admins WHERE email = ? OR name = ? OR role = ? OR ? = "admin" LIMIT 1',
            [identifier.toLowerCase(), identifier, identifier.toLowerCase(), identifier.toLowerCase()]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid administrator credentials.'
            });
        }

        const admin = admins[0];
        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid administrator credentials.'
            });
        }

        // Set admin session
        req.session.adminId = admin.id;
        req.session.admin = {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role
        };

        // Explicitly persist session before sending response
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error('Session save error:', saveErr);
            }
            return res.json({
                success: true,
                message: 'Admin login successful!',
                admin: req.session.admin
            });
        });
    } catch (err) {
        console.error('Admin login error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during admin login.'
        });
    }
}

// Logout (both user and admin)
function logout(req, res) {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error during logout.'
            });
        }
        res.clearCookie('connect.sid');
        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    });
}

// Get current session state
function getMe(req, res) {
    if (req.session && req.session.userId) {
        return res.json({
            authenticated: true,
            role: 'citizen',
            user: req.session.user
        });
    } else if (req.session && req.session.adminId) {
        return res.json({
            authenticated: true,
            role: 'admin',
            admin: req.session.admin
        });
    }
    return res.json({
        authenticated: false
    });
}

module.exports = {
    register,
    login,
    adminLogin,
    logout,
    getMe
};

