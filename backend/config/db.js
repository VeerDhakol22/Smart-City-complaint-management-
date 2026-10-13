const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config(); // Also check root .env for deployment

let dbConfig = {};

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
    dbConfig = {
        uri: connectionUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false }
    };
} else {
    dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'smart_complaint',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    // If SSL is explicitly requested or connecting to a known cloud provider
    const hostStr = process.env.DB_HOST || '';
    if (process.env.DB_SSL === 'true' || hostStr.includes('aivencloud.com') || hostStr.includes('tidbcloud.com')) {
        dbConfig.ssl = { rejectUnauthorized: false };
    }
}

const pool = mysql.createPool(dbConfig);

// Helper to test connectivity
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        connection.release();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    pool,
    testConnection,
    dbConfig
};
