const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // Also check project root .env

const { testConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for cloud deployments (Render, Heroku, Nginx, Cloudflare)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'smart_city_complaint_mgmt_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: 'auto', // Automatically uses secure cookies when accessed via HTTPS/Render
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Static directories
// 1. Uploaded complaint photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Frontend web application
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const dbStatus = await testConnection();
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: dbStatus.success ? 'Connected' : `Error: ${dbStatus.error}`
    });
});

// Fallback to frontend index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error occurred.'
    });
});

// Start Server
app.listen(PORT, async () => {
    console.log(`=================================================`);
    console.log(`  Smart City Complaint Management Server Running`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Frontend: http://localhost:${PORT}/index.html`);
    console.log(`=================================================`);

    const dbStatus = await testConnection();
    if (dbStatus.success) {
        console.log('✅ Connected to MySQL database successfully.');
    } else {
        console.warn('⚠️  MySQL connection warning:', dbStatus.error);
        console.warn('   Please ensure MySQL is running and DB_PASSWORD in backend/.env is correct.');
    }
});

module.exports = app;

