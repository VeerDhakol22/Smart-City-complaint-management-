const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config(); // Also check project root .env

async function initDB() {
    console.log('--- Initializing Smart City Complaint Database ---');
    console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`Database: ${process.env.DB_NAME}`);

    let connection;
    try {
        const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
        const dbName = process.env.DB_NAME || 'smart_complaint';

        if (connectionUrl) {
            console.log('Connecting via DATABASE_URL...');
            connection = await mysql.createConnection({
                uri: connectionUrl,
                ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false }
            });
        } else {
            // Connect to server
            const connOptions = {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT, 10) || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || ''
            };
            if (process.env.DB_SSL === 'true') {
                connOptions.ssl = { rejectUnauthorized: false };
            }
            connection = await mysql.createConnection(connOptions);
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
            await connection.query(`USE \`${dbName}\`;`);
        }
        console.log(`Connected to MySQL server. Database '${dbName}' verified/created.`);

        // Step 3: Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                mobile VARCHAR(15) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        `);
        console.log('Table users verified/created.');

        // Step 4: Create admins table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        `);
        console.log('Table admins verified/created.');

        // Step 5: Create complaints table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS complaints (
                id INT AUTO_INCREMENT PRIMARY KEY,
                complaint_id VARCHAR(50) NOT NULL UNIQUE,
                user_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                location VARCHAR(255) NOT NULL,
                priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
                photo_path VARCHAR(255) NULL,
                status ENUM('Pending', 'In Progress', 'Resolved', 'Cancelled') DEFAULT 'Pending',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_complaint_id (complaint_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        `);
        console.log('Table complaints verified/created.');

        // Step 6: Create complaint_updates table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS complaint_updates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                complaint_id INT NOT NULL,
                admin_id INT NULL,
                old_status VARCHAR(50) NULL,
                new_status VARCHAR(50) NOT NULL,
                admin_reply TEXT NULL,
                action_description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
                INDEX idx_update_complaint (complaint_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        `);
        console.log('Table complaint_updates verified/created.');

        // Step 7: Seed default admin if none exists
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@smartcity.gov';
        const adminName = process.env.ADMIN_NAME || 'Municipal Administrator';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        const [existing] = await connection.query('SELECT id FROM admins WHERE email = ?', [adminEmail]);
        if (existing.length === 0) {
            const hash = await bcrypt.hash(adminPassword, 10);
            await connection.query(
                'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                [adminName, adminEmail, hash, 'admin']
            );
            console.log(`Default admin created: ${adminEmail} (password: ${adminPassword})`);
        } else {
            console.log(`Admin account '${adminEmail}' already exists.`);
        }

        console.log('Database initialization completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Database initialization error:', err.message);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\nNOTE: MySQL access denied. Please verify DB_USER and DB_PASSWORD in backend/.env.');
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initDB();
