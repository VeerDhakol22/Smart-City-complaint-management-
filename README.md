# Smart City Complaint Management System

A full-stack civic grievance management platform built with **HTML5, CSS3, JavaScript, Node.js, Express.js, MySQL, session-based authentication, and Multer**.

Citizens can register civic complaints online with photo evidence, monitor status in real-time, view official municipal replies and action history, and manage their profile. Administrators can review incoming complaints, filter and search cases, view citizen contact details, update status (Pending, In Progress, Resolved, Cancelled), and log administrative actions with full audit tracking.

---

## 🌟 Key Features

### Citizen Portal
- **Secure Registration & Login**: Validated inputs, email uniqueness, phone verification, and salted password hashing (`bcryptjs`).
- **Session Authentication**: State management via secure HTTP session cookies (`express-session`).
- **Submit Complaint**: File civic issues under categories (Road, Garbage, Water, Electricity, Drainage, Street Light, Other) with priority, location, and optional photo upload.
- **Unique Complaint ID**: Generates a standardized tracking code (e.g., `CMP-123456-7890`).
- **My Complaints**: View all submitted complaints with live status, date, and latest administrative response.
- **Cancellation Workflow**: Citizens can cancel complaints only while in `Pending` status.
- **Real-Time Tracking**: Visual 3-stage progress track (`Pending` ➔ `In Progress` ➔ `Resolved` or `Cancelled`) and complete chronological action history.
- **Profile Management**: View and update profile contact details and change password.

### Administrator Operations
- **Dedicated Admin Login**: Role-restricted access (`/admin.html`).
- **Operations Dashboard**: Real-time KPI counters (Total, Pending, In Progress, Resolved, Cancelled).
- **Search & Filtering**: Search by Complaint ID, Title, Citizen Name, Mobile, or Location. Filter by Category and Status.
- **Detailed Grievance Inspection**: Review citizen contact info, location, and uploaded photo.
- **Status & Reply Audit Log**: Update status and attach official notes; every update is recorded in the `complaint_updates` audit table.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+ Fetch API, FormData)
- **Backend**: Node.js, Express.js REST API
- **Database**: MySQL (`smart_complaint`)
- **Authentication**: Session-based (`express-session`), `bcryptjs` password hashing
- **File Uploads**: `multer` with MIME-type restriction and file size limits (5MB)

---

## 📁 Project Structure

```
complaint-management/
├── frontend/
│   ├── index.html               # Public Landing page
│   ├── login.html               # Citizen login
│   ├── register.html            # Citizen registration
│   ├── dashboard.html           # Citizen dashboard
│   ├── complaint.html           # Complaint submission form
│   ├── mycomplaints.html        # Citizen complaint history
│   ├── complaint-details.html   # Detailed view + audit timeline
│   ├── track.html               # Public / Citizen tracking
│   ├── profile.html             # Profile view
│   ├── edit-profile.html        # Edit contact information
│   ├── change-password.html     # Change account password
│   ├── admin.html               # Administrator login
│   ├── admin-dashboard.html     # Administrator operations dashboard
│   ├── style.css                # Unified stylesheet
│   └── js/
│       ├── api.js               # Universal fetch wrapper with session cookie support
│       ├── auth.js              # Auth & profile management logic
│       ├── complaints.js        # Complaint submission, list, details & tracking
│       └── admin.js             # Admin stats, filtering, and status update
├── backend/
│   ├── server.js                # Express app entrypoint & static server
│   ├── package.json             # Backend dependencies & scripts
│   ├── .env                     # Local environment variables (DB credentials, secret)
│   ├── .env.example             # Template environment variables
│   ├── config/
│   │   └── db.js                # MySQL2 connection pool configuration
│   ├── controllers/
│   │   ├── authController.js    # Register, login, adminLogin, logout, me
│   │   ├── userController.js    # Profile & password management
│   │   ├── complaintController.js # Complaint CRUD, tracking, and cancellation
│   │   └── adminController.js   # Admin stats, filtering, and audit updates
│   ├── middleware/
│   │   ├── authMiddleware.js    # Citizen session guard
│   │   ├── adminMiddleware.js   # Admin session guard
│   │   └── uploadMiddleware.js  # Multer photo upload configuration
│   ├── routes/
│   │   ├── authRoutes.js        # /api/auth endpoints
│   │   ├── userRoutes.js        # /api/users endpoints
│   │   ├── complaintRoutes.js   # /api/complaints endpoints
│   │   └── adminRoutes.js       # /api/admin endpoints
│   ├── sql/
│   │   └── schema.sql           # Database schema SQL script
│   ├── scripts/
│   │   ├── init-db.js           # Database auto-setup & default admin seeder
│   │   └── test-api.js          # Automated end-to-end API test suite
│   └── uploads/                 # Storage directory for uploaded complaint photos
├── package.json                 # Root script runner
├── .gitignore
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- **Node.js**: v18 or higher (v22 installed)
- **MySQL Server**: running on port `3306`

### 2. Configure Environment Variables
Edit `backend/.env` to configure your MySQL credentials:
```env
PORT=5000
NODE_ENV=development

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_complaint

# Session Secret
SESSION_SECRET=smart_city_complaint_mgmt_super_secret_key_2026

# Seed Admin Credentials
ADMIN_NAME=Municipal Administrator
ADMIN_EMAIL=admin@smartcity.gov
ADMIN_PASSWORD=admin123
```

### 3. Initialize the Database
Run the automated schema and admin seeder:
```bash
# From the project root or backend folder:
node backend/scripts/init-db.js
```
This automatically creates:
- The `smart_complaint` database
- All 4 tables: `users`, `admins`, `complaints`, `complaint_updates`
- The default administrator account (`admin@smartcity.gov` / `admin123`)

### 4. Start the Application
```bash
# Run server:
node backend/server.js
```
The application will be live at:
- **Web Portal**: [http://localhost:5000](http://localhost:5000)
- **API Health**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Admin Portal**: [http://localhost:5000/admin.html](http://localhost:5000/admin.html)

---

## 🧪 Testing the API & Workflows

To run the automated end-to-end integration test suite:
```bash
node backend/scripts/test-api.js
```
This validates:
1. Citizen registration & duplicate email check
2. Citizen login & session cookie establishment
3. Complaint filing with photo attachment
4. Unique Complaint ID generation
5. Citizen complaint listing & access boundaries
6. Complaint tracking & audit history
7. Administrator login & authentication
8. Operations KPI counters
9. Admin status transition & reply logging
10. Complaint cancellation rules

---

## 🚀 Production Deployment

Comprehensive step-by-step guides for both **Cloud (Render.com)** and **Self-Hosted Linux VPS** are available in [DEPLOYMENT.md](file:///d:/Tejas/complaint%20management/DEPLOYMENT.md):

- **Render Cloud Deployment**: Free web service hosting with GitHub CI/CD, Blueprint configuration (`render.yaml`), and Cloud MySQL setup (Aiven / TiDB).
- **Manual VPS Deployment**: Production setup with Ubuntu/Debian, local MySQL 8, PM2 process manager, Nginx reverse proxy, and free SSL via Let's Encrypt / Certbot.

