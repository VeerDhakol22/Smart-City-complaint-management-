// Centralized API client for Smart City Complaint Management System
const API_BASE = (window.location.protocol === 'file:' || !window.location.origin.includes('5000'))
    ? 'http://localhost:5000/api'
    : '/api';

/**
 * Universal fetch wrapper that manages session cookies, headers, and error handling.
 */
async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    // Automatically include cookies for session authentication
    options.credentials = 'include';
    
    // If body is NOT FormData, set default Content-Type to application/json
    if (options.body && !(options.body instanceof FormData)) {
        options.headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body);
        }
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMsg = data.message || `Request failed with status ${response.status}`;
            const err = new Error(errorMsg);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    } catch (err) {
        console.error(`API Error on [${options.method || 'GET'} ${url}]:`, err);
        throw err;
    }
}

/**
 * Clean alert / toast notification helper
 */
function showAlert(message, isSuccess = true) {
    alert(message);
}

// Export to window
window.apiFetch = apiFetch;
window.showAlert = showAlert;

