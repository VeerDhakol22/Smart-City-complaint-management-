// Authentication & User Profile Management Logic

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Citizen Registration Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const mobile = document.getElementById('mobile').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!name || !email || !mobile || !password || !confirmPassword) {
                alert('Please fill all fields.');
                return;
            }

            if (!/^[0-9]{10}$/.test(mobile)) {
                alert('Please enter a valid 10-digit mobile number.');
                return;
            }

            if (password.length < 6) {
                alert('Password must contain at least 6 characters.');
                return;
            }

            if (password !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }

            try {
                const res = await apiFetch('/auth/register', {
                    method: 'POST',
                    body: { name, email, mobile, password, confirmPassword }
                });

                alert(res.message || 'Registration successful! Please login.');
                window.location.href = 'login.html';
            } catch (err) {
                alert(err.message || 'Registration failed.');
            }
        });
    }

    // 2. Citizen Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                alert('Please enter both email and password.');
                return;
            }

            try {
                const res = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: { email, password }
                });

                alert('Login successful!');
                window.location.href = 'dashboard.html';
            } catch (err) {
                alert(err.message || 'Incorrect email or password.');
            }
        });
    }

    // 3. Admin Login Form
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value;
            const msgEl = document.getElementById('loginMessage');

            try {
                const res = await apiFetch('/auth/admin/login', {
                    method: 'POST',
                    body: { username, password }
                });

                if (msgEl) msgEl.innerText = '';
                localStorage.setItem('adminLoggedIn', 'true');
                alert('Admin login successful!');
                window.location.href = 'admin-dashboard.html';
            } catch (err) {
                if (msgEl) {
                    msgEl.innerText = err.message || 'Invalid administrator credentials.';
                } else {
                    alert(err.message || 'Invalid administrator credentials.');
                }
            }
        });
    }

    // 4. Page Protection & Context Initialization
    const path = window.location.pathname.toLowerCase();
    
    // Check Citizen Protected Pages
    const isCitizenPage = [
        'dashboard.html',
        'complaint.html',
        'mycomplaints.html',
        'profile.html',
        'edit-profile.html',
        'change-password.html'
    ].some(page => path.endsWith(page));

    // Check Admin Protected Pages
    const isAdminPage = path.endsWith('admin-dashboard.html');

    if (isCitizenPage || isAdminPage) {
        try {
            const authState = await apiFetch('/auth/me');
            
            if (isAdminPage) {
                const isLocalAdmin = localStorage.getItem('adminLoggedIn') === 'true';
                if (!authState.authenticated || authState.role !== 'admin') {
                    if (!isLocalAdmin) {
                        window.location.href = 'admin.html';
                        return;
                    }
                }
            } else if (isCitizenPage) {
                const isLocalCitizen = localStorage.getItem('citizenLoggedIn') === 'true' || localStorage.getItem('isLoggedIn') === 'true';
                if (!authState.authenticated || authState.role !== 'citizen') {
                    if (!isLocalCitizen) {
                        window.location.href = 'login.html';
                        return;
                    }
                }

                // If on dashboard, update welcome text
                const welcomeText = document.getElementById('welcomeText');
                if (welcomeText && authState.user) {
                    welcomeText.innerText = `Welcome, ${authState.user.name}`;
                }

                // If on profile page, load profile data
                if (path.endsWith('profile.html')) {
                    loadUserProfile();
                }

                // If on edit-profile page, prefill data and attach handler
                if (path.endsWith('edit-profile.html')) {
                    initEditProfile();
                }

                // If on change-password page, attach handler
                if (path.endsWith('change-password.html')) {
                    initChangePassword();
                }
            }
        } catch (err) {
            console.error('Auth verification failed:', err);
            if (isAdminPage) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'login.html';
            }
        }
    }
});

// Load User Profile on profile.html
async function loadUserProfile() {
    try {
        const res = await apiFetch('/users/profile');
        if (res.user) {
            const nameEl = document.getElementById('profileName');
            const emailEl = document.getElementById('profileEmail');
            const mobileEl = document.getElementById('profileMobile');

            if (nameEl) nameEl.innerText = res.user.name || '';
            if (emailEl) emailEl.innerText = res.user.email || '';
            if (mobileEl) mobileEl.innerText = res.user.mobile || '';
        }
    } catch (err) {
        alert('Failed to load profile details: ' + err.message);
    }
}

// Prefill and handle edit-profile.html
async function initEditProfile() {
    try {
        const res = await apiFetch('/users/profile');
        if (res.user) {
            const nameInput = document.getElementById('editName');
            const emailInput = document.getElementById('editEmail');
            const mobileInput = document.getElementById('editMobile');

            if (nameInput) nameInput.value = res.user.name || '';
            if (emailInput) emailInput.value = res.user.email || '';
            if (mobileInput) mobileInput.value = res.user.mobile || '';
        }
    } catch (err) {
        console.error('Error prefilling profile:', err);
    }

    const editForm = document.getElementById('editProfileForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('editName').value.trim();
            const newMobile = document.getElementById('editMobile').value.trim();

            if (!newName || !newMobile) {
                alert('Please fill all fields.');
                return;
            }

            if (!/^[0-9]{10}$/.test(newMobile)) {
                alert('Enter a valid 10-digit mobile number.');
                return;
            }

            try {
                const res = await apiFetch('/users/profile', {
                    method: 'PUT',
                    body: { name: newName, mobile: newMobile }
                });

                alert(res.message || 'Profile updated successfully!');
                window.location.href = 'profile.html';
            } catch (err) {
                alert(err.message || 'Failed to update profile.');
            }
        });
    }
}

// Handle change-password.html
function initChangePassword() {
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!oldPassword || !newPassword || !confirmPassword) {
                alert('Please fill all password fields.');
                return;
            }

            if (newPassword.length < 6) {
                alert('New password must contain at least 6 characters.');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('New passwords do not match.');
                return;
            }

            try {
                const res = await apiFetch('/users/change-password', {
                    method: 'PUT',
                    body: { oldPassword, newPassword, confirmPassword }
                });

                alert(res.message || 'Password changed successfully!');
                window.location.href = 'profile.html';
            } catch (err) {
                alert(err.message || 'Failed to change password.');
            }
        });
    }
}

// Global Logout function
async function logout() {
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch (err) {
        console.warn('Logout error:', err);
    }
    // Clean any legacy localStorage keys
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('complaintUser');
    window.location.href = 'login.html';
}

// Global Admin Logout function
async function adminLogout() {
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch (err) {
        console.warn('Admin logout error:', err);
    }
    localStorage.removeItem('adminLoggedIn');
    window.location.href = 'admin.html';
}

window.logout = logout;
window.adminLogout = adminLogout;

