# Deployment Guide: Smart City Complaint Management System

This comprehensive guide covers two production deployment strategies for the **Smart City Complaint Management System**:
1. **Cloud Deployment on Render (Render.com)** — Zero server management, free-tier friendly, automated CI/CD from GitHub.
2. **Manual VPS Deployment (Ubuntu / Debian / EC2 / DigitalOcean)** — Full control, self-hosted MySQL, PM2 process management, Nginx reverse proxy, and Let's Encrypt SSL.

---

## Architecture Overview

- **Backend**: Node.js & Express.js (REST API, Sessions, Multer photo uploads)
- **Frontend**: Pure HTML5, CSS3, JavaScript (served directly by Express from `/frontend`)
- **Database**: MySQL 5.7+ or MySQL 8.0+
- **Process Port**: Configurable via `PORT` (defaults to `5000` locally, `10000` on Render)

---

# Part 1: Deploy to Render (Render.com)

Render provides free cloud hosting for Node.js web services. Because Render only offers managed PostgreSQL on its free tier, we will pair Render with a free cloud MySQL provider (such as **Aiven for MySQL** or **TiDB Cloud Serverless**).

```
   ┌───────────────────────┐           ┌────────────────────────────┐
   │  Render Web Service   │  SSL URI  │  Cloud MySQL Database      │
   │  (Node.js + Express)  │──────────>│  (Aiven / TiDB / Railway)  │
   │  smart-city.onrender  │           │  Port 3306 with SSL        │
   └───────────────────────┘           └────────────────────────────┘
```

### Step 1: Provision a Free Cloud MySQL Database

Choose any one of the following providers:

#### Option A: Aiven for MySQL (Recommended - Free Tier)
1. Sign up at [aiven.io](https://aiven.io/).
2. Create a new service: Choose **MySQL** and select the **Free Plan** (or free trial).
3. Select your closest cloud region (e.g., AWS / Google Cloud).
4. After provisioning, open the service overview and copy the **Service URI**:
   ```
   mysql://avnadmin:your_password@your-host.aivencloud.com:port/defaultdb?ssl-mode=REQUIRED
   ```

#### Option B: TiDB Cloud Serverless (Free Forever - MySQL 8 Compatible)
1. Sign up at [tidbcloud.com](https://tidbcloud.com/).
2. Create a new cluster and select **Serverless (Free)**.
3. In the cluster dashboard, click **Connect** -> Choose **Node.js / General Connection String**.
4. Note the host, user, password, port, and database name.

---

### Step 2: Initialize Database Schema Remotely

Run the database setup script from your local machine targeting your cloud database:

```bash
# Set your cloud database URL in your terminal (replace with your actual URI):
# Windows PowerShell:
$env:DATABASE_URL="mysql://username:password@hostname:port/database_name?ssl-mode=REQUIRED"
$env:DB_SSL="true"
npm run db:init

# Mac / Linux:
DATABASE_URL="mysql://username:password@hostname:port/database_name?ssl-mode=REQUIRED" DB_SSL="true" npm run db:init
```

The script will automatically create:
- `users` table
- `admins` table with default credentials (`admin@smartcity.gov` / `admin123`)
- `complaints` table
- `complaint_updates` table

---

### Step 3: Push Your Code to GitHub

If your project is not yet in a GitHub repository:

```bash
# 1. Initialize git
git init

# 2. Add all files (.gitignore will exclude node_modules, .env, and local uploads)
git add .

# 3. Commit
git commit -m "feat: complete smart city complaint management system"

# 4. Link to your GitHub repository and push
git branch -M main
git remote add origin https://github.com/<your-username>/smart-complaint.git
git push -u origin main
```

---

### Step 4: Create a New Web Service on Render

1. Log in to [dashboard.render.com](https://dashboard.render.com/).
2. Click **New +** -> Select **Web Service**.
3. Connect your GitHub repository (`smart-complaint`).
4. Configure the service settings:
   - **Name**: `smart-complaint-app` (or any unique name)
   - **Region**: Choose the region closest to your database
   - **Branch**: `main`
   - **Root Directory**: Leave blank (uses repo root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. Expand the **Environment Variables** section and add:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production mode |
| `DATABASE_URL` | `mysql://user:pass@host:port/dbname` | Your Cloud MySQL Connection URI |
| `DB_SSL` | `true` | Enables encrypted connection to MySQL |
| `SESSION_SECRET` | `generate-a-strong-random-secret` | 32+ character random string for cookies |

*(Note: Render automatically sets `PORT=10000`. Our server binds to `process.env.PORT` automatically).*

6. Click **Create Web Service**. Render will install dependencies, build, and start your application.

---

### Step 5: Test and Verify Render Deployment

1. Once deployment status says **Live**, click on your onrender URL:
   `https://smart-complaint-app.onrender.com`
2. Test the health check endpoint:
   `https://smart-complaint-app.onrender.com/api/health`
   Should return: `{"status":"UP","database":{"status":"connected"}}`
3. Test citizen features:
   - Register a citizen account.
   - Submit a complaint with a photo.
   - Track complaint with ID.
4. Test administrator features:
   - Visit `https://smart-complaint-app.onrender.com/admin.html`.
   - Log in with `admin@smartcity.gov` / `admin123`.
   - Update complaint status and reply.

> **Important Note on Render Free Tier File Uploads**:
> Render's free tier uses ephemeral disks. Uploaded complaint photos will be preserved while the instance is active, but will reset upon container redeploy. For persistent production uploads on Render, you can either:
> 1. Attach a Render Persistent Disk (available on Starter plan), or
> 2. Configure AWS S3 or Cloudinary storage for photo uploads.

---

# Part 2: Manual VPS Deployment (Ubuntu / Debian)

This guide walks through deploying the application on a dedicated Linux VPS (such as DigitalOcean Droplet, AWS EC2, Linode, or Hetzner).

```
 Internet (Port 80/443)
       │
       ▼
 ┌───────────┐     Reverse Proxy     ┌──────────────────────┐
 │   Nginx   │ ────────────────────> │  PM2 Process Manager │
 │   (SSL)   │   127.0.0.1:5000      │  (Node.js Server)    │
 └───────────┘                       └──────────────────────┘
                                                │
                                                ▼
                                     ┌──────────────────────┐
                                     │  MySQL 8 Database    │
                                     │  (Localhost:3306)    │
                                     └──────────────────────┘
```

### Step 1: Update Server and Install Prerequisites

Connect to your VPS via SSH:
```bash
ssh root@your_server_ip
```

Update packages and install curl, git, build essentials:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw software-properties-common
```

Install **Node.js 20 LTS**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Should output v20.x.x
npm -v    # Should output 10.x.x
```

Install **PM2** process manager globally:
```bash
sudo npm install -g pm2
```

---

### Step 2: Install and Secure MySQL Server

```bash
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

Run security setup:
```bash
sudo mysql_secure_installation
```

Log in to MySQL and set up the database and a dedicated user:
```bash
sudo mysql
```

Run the following SQL commands:
```sql
CREATE DATABASE smart_complaint CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user (replace 'StrongPassword123!' with your own secure password)
CREATE USER 'smart_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'StrongPassword123!';

-- Grant permissions
GRANT ALL PRIVILEGES ON smart_complaint.* TO 'smart_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### Step 3: Clone Code and Install Dependencies

Create application directory and clone the code:
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/<your-username>/smart-complaint.git
cd smart-complaint

# Install production dependencies
npm install --omit=dev
```

Ensure the upload directory exists with proper permissions:
```bash
mkdir -p backend/uploads
chmod -R 755 backend/uploads
```

---

### Step 4: Configure Production Environment (`.env`)

Create production `.env` file:
```bash
nano .env
```

Paste your production configuration:
```ini
PORT=5000
NODE_ENV=production

# MySQL Local Connection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=smart_user
DB_PASSWORD=StrongPassword123!
DB_NAME=smart_complaint
DB_SSL=false

# Session Secret (Generate a unique 32+ character key)
SESSION_SECRET=e7b4c91a03f8482db0cf1928374a5e1f82c4091a03f8482db0cf1928374a5e1f

# Administrator Seed
ADMIN_NAME=Municipal Administrator
ADMIN_EMAIL=admin@smartcity.gov
ADMIN_PASSWORD=CreateAStrongAdminPasswordHere!
```

Save and exit (`Ctrl + O`, then `Enter`, then `Ctrl + X`).

---

### Step 5: Initialize the Database Schema

Run the database initialization script:
```bash
npm run db:init
```

You should see:
```
--- Initializing Smart City Complaint Database ---
Connected to MySQL server. Database 'smart_complaint' verified/created.
Table users verified/created.
Table admins verified/created.
Table complaints verified/created.
Table complaint_updates verified/created.
Administrator account ready: admin@smartcity.gov
Database initialization completed successfully!
```

---

### Step 6: Start Application with PM2

Start the application under PM2 process supervisor:
```bash
pm2 start backend/server.js --name "smart-complaint"
```

Configure PM2 to automatically start on server reboot:
```bash
pm2 startup systemd
# Copy and run the command printed on screen by PM2, then run:
pm2 save
```

Verify PM2 status:
```bash
pm2 status
pm2 logs smart-complaint --lines 20
```

---

### Step 7: Configure Nginx as Reverse Proxy

Install Nginx:
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/smart-complaint
```

Paste the following configuration (replace `yourdomain.com` with your domain or server IP):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Maximum file upload size for complaint photos (10 MB)
    client_max_body_size 10M;

    # Reverse proxy to Node.js
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/smart-complaint /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 8: Install Free SSL Certificate with Certbot (Let's Encrypt)

If you have a domain pointing to your VPS IP:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will automatically configure HTTPS, redirect HTTP to HTTPS, and set up auto-renewal cron tasks.

---

### Step 9: Configure Firewall (UFW)

Protect your server with Ubuntu's Uncomplicated Firewall:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Check firewall status:
```bash
sudo ufw status
```

---

## Operations & Maintenance Cheat Sheet

### PM2 Commands
- View live application logs: `pm2 logs smart-complaint`
- Restart application: `pm2 restart smart-complaint`
- Stop application: `pm2 stop smart-complaint`
- Monitor memory & CPU: `pm2 monit`

### Updating Code
When you push changes to GitHub, pull and deploy on your VPS:
```bash
cd /var/www/smart-complaint
git pull origin main
npm install --omit=dev
pm2 reload smart-complaint
```

### Database Backups (Automated Daily)
Create a daily backup script at `/usr/local/bin/backup-complaint-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/smart_complaint"
mkdir -p "$BACKUP_DIR"
mysqldump -u smart_user -p'StrongPassword123!' smart_complaint | gzip > "$BACKUP_DIR/backup-$(date +%F).sql.gz"
# Keep backups for 14 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -exec rm {} +
```
Make executable:
```bash
chmod +x /usr/local/bin/backup-complaint-db.sh
```
Add to cron (`crontab -e`):
```cron
0 2 * * * /usr/local/bin/backup-complaint-db.sh
```

---

## Troubleshooting Guide

| Issue | Cause | Solution |
|---|---|---|
| `502 Bad Gateway` (Nginx) | Node server is down or crashed | Check `pm2 status` and `pm2 logs smart-complaint`. Verify database credentials in `.env`. |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL server is stopped | Run `sudo systemctl status mysql` and start with `sudo systemctl start mysql`. |
| `File too large` / `413 Request Entity Too Large` | Nginx default 1MB upload limit | Ensure `client_max_body_size 10M;` is present inside your Nginx server block. |
| Session logged out on refresh | Cookie or proxy configuration issue | Verify `app.set('trust proxy', 1);` in `backend/server.js` and that Nginx forwards `X-Forwarded-Proto`. |
| Render database connection timeout | Remote DB not accepting SSL or firewall | Add `DB_SSL=true` in Render environment variables and check your cloud DB whitelist. |

