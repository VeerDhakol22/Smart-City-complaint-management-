// Administrator Dashboard Logic - Modern Interactive Command Center

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
});

let searchDebounceTimer = null;
let currentStatusFilter = 'All';

async function initAdminDashboard() {
    const adminContainer = document.getElementById('adminComplaints');
    if (!adminContainer) return;

    // Prefill admin profile if in session
    try {
        const auth = await apiFetch('/auth/me');
        if (auth && auth.admin) {
            const nameEl = document.getElementById('adminNameDisplay');
            const emailEl = document.getElementById('adminEmailDisplay');
            if (nameEl) nameEl.innerText = auth.admin.name || 'Municipal Admin';
            if (emailEl) emailEl.innerText = auth.admin.email || 'admin@smartcity.gov';
        }
    } catch (e) {
        console.warn('Admin profile load warning:', e);
    }

    // Load initial stats & complaints
    await updateStatistics();
    await loadAdminComplaints();

    // Attach search input with debounce
    const searchInput = document.getElementById('searchComplaint');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadAdminComplaints();
            }, 250);
        });
    }

    // Category and Priority filters
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => loadAdminComplaints());
    }

    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) {
        priorityFilter.addEventListener('change', () => loadAdminComplaints());
    }
}

// Interactive Task Buttons & Tabs Filter Handler
function selectStatusFilter(status) {
    currentStatusFilter = status;

    // Update status button card active state
    document.querySelectorAll('.stat-card-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab pill active state
    document.querySelectorAll('.tab-pill').forEach(tab => {
        if (tab.id === `tab-${status}`) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update sync select if present
    const statusSelect = document.getElementById('statusFilter');
    if (statusSelect) {
        statusSelect.value = status;
    }

    // Update active filter badge text
    const badge = document.getElementById('activeFilterBadge');
    if (badge) {
        const labels = {
            'All': 'Total Tasks (All)',
            'Pending': 'Pending Tasks',
            'In Progress': 'In Progress Tasks',
            'Resolved': 'Resolved Tasks',
            'Cancelled': 'Cancelled Tasks'
        };
        badge.innerHTML = `Showing: <strong>${labels[status] || status}</strong>`;
    }

    loadAdminComplaints();
}

// Fetch and update dashboard statistics cards & tab counts
async function updateStatistics() {
    try {
        const res = await apiFetch('/admin/statistics');
        const stats = res.statistics || {};

        const total = stats.total || 0;
        const pending = stats.pending || 0;
        const inProgress = stats.in_progress || 0;
        const resolved = stats.resolved || 0;
        const cancelled = stats.cancelled || 0;

        // Big Numbers in Cards
        const totalEl = document.getElementById('totalCount');
        const pendingEl = document.getElementById('pendingCount');
        const progressEl = document.getElementById('progressCount');
        const resolvedEl = document.getElementById('resolvedCount');
        const cancelledEl = document.getElementById('cancelledCount');

        if (totalEl) totalEl.innerText = total;
        if (pendingEl) pendingEl.innerText = pending;
        if (progressEl) progressEl.innerText = inProgress;
        if (resolvedEl) resolvedEl.innerText = resolved;
        if (cancelledEl) cancelledEl.innerText = cancelled;

        // Tab Pill Count Badges
        const tabAll = document.getElementById('tabCount-All');
        const tabPen = document.getElementById('tabCount-Pending');
        const tabPrg = document.getElementById('tabCount-InProgress');
        const tabRes = document.getElementById('tabCount-Resolved');
        const tabCan = document.getElementById('tabCount-Cancelled');

        if (tabAll) tabAll.innerText = total;
        if (tabPen) tabPen.innerText = pending;
        if (tabPrg) tabPrg.innerText = inProgress;
        if (tabRes) tabRes.innerText = resolved;
        if (tabCan) tabCan.innerText = cancelled;
    } catch (err) {
        console.error('Failed to load admin statistics:', err);
    }
}

// Fetch and render filtered complaints list
async function loadAdminComplaints() {
    const container = document.getElementById('adminComplaints');
    if (!container) return;

    const searchInput = document.getElementById('searchComplaint');
    const categoryFilter = document.getElementById('categoryFilter');
    const priorityFilter = document.getElementById('priorityFilter');

    const search = searchInput ? searchInput.value.trim() : '';
    const status = currentStatusFilter;
    const category = categoryFilter ? categoryFilter.value : 'All';
    const priority = priorityFilter ? priorityFilter.value : 'All';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status && status !== 'All') params.append('status', status);
    if (category && category !== 'All') params.append('category', category);
    if (priority && priority !== 'All') params.append('priority', priority);

    try {
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading complaints from database...</p>
            </div>
        `;

        const res = await apiFetch(`/admin/complaints?${params.toString()}`);
        const complaints = res.complaints || [];

        // Update results badge
        const resultsBadge = document.getElementById('resultsCountBadge');
        if (resultsBadge) {
            resultsBadge.innerText = `${complaints.length} task${complaints.length === 1 ? '' : 's'}`;
        }

        container.innerHTML = '';
        if (complaints.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <span class="empty-icon">📭</span>
                    <h3>No Complaints Found</h3>
                    <p>There are no complaints matching your selected criteria (<strong>${escapeHtml(status)}</strong>, ${category !== 'All' ? escapeHtml(category) : 'All Categories'}).</p>
                    <button class="empty-reset-btn" onclick="resetAllFilters()">Reset All Filters</button>
                </div>
            `;
            return;
        }

        complaints.forEach(complaint => {
            const card = document.createElement('div');
            card.className = `modern-complaint-card status-border-${getStatusClass(complaint.status)}`;

            const createdDate = new Date(complaint.created_at).toLocaleString('en-IN', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Priority badge styling
            let priorityBadgeClass = 'badge-priority-medium';
            if (complaint.priority === 'High') priorityBadgeClass = 'badge-priority-high';
            if (complaint.priority === 'Low') priorityBadgeClass = 'badge-priority-low';

            // Photo Evidence
            let photoSection = '';
            if (complaint.photo_path) {
                photoSection = `
                    <div class="complaint-photo-box">
                        <span class="photo-box-label">📸 Photo Evidence:</span>
                        <a href="${complaint.photo_path}" target="_blank" class="photo-link">
                            <img src="${complaint.photo_path}" alt="Complaint Photo" class="complaint-thumbnail">
                            <span class="photo-zoom-hint">🔍 View Full Image</span>
                        </a>
                    </div>
                `;
            }

            // Latest Admin Reply section
            let latestReplyHtml = '';
            if (complaint.latest_admin_reply) {
                latestReplyHtml = `
                    <div class="current-reply-banner">
                        <span class="reply-badge">💬 Latest Official Response:</span>
                        <p class="reply-content">"${escapeHtml(complaint.latest_admin_reply)}"</p>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-top-header">
                    <div class="card-id-group">
                        <span class="complaint-id-chip" onclick="copyComplaintId('${escapeHtml(complaint.complaint_id)}')" title="Click to copy Complaint ID">
                            📋 ${escapeHtml(complaint.complaint_id)}
                        </span>
                        <span class="category-chip">🏷️ ${escapeHtml(complaint.category)}</span>
                        <span class="priority-chip ${priorityBadgeClass}">⚡ ${escapeHtml(complaint.priority)} Priority</span>
                    </div>
                    <div class="status-pill-badge status-pill-${getStatusClass(complaint.status)}">
                        <span class="status-dot"></span>
                        ${escapeHtml(complaint.status)}
                    </div>
                </div>

                <h3 class="card-issue-title">${escapeHtml(complaint.title)}</h3>

                <div class="card-meta-row">
                    <span class="meta-item">📍 <strong>Location:</strong> ${escapeHtml(complaint.location)}</span>
                    <span class="meta-item">📅 <strong>Submitted:</strong> ${createdDate}</span>
                </div>

                <div class="citizen-info-strip">
                    <div class="citizen-avatar-icon">👤</div>
                    <div class="citizen-meta">
                        <div class="citizen-name-row">
                            <strong>${escapeHtml(complaint.citizen_name)}</strong>
                            <span class="citizen-tag">Resident Citizen</span>
                        </div>
                        <div class="citizen-contacts">
                            <a href="tel:${escapeHtml(complaint.citizen_mobile)}" class="contact-link" title="Call Citizen">📞 ${escapeHtml(complaint.citizen_mobile)}</a>
                            <span class="contact-divider">•</span>
                            <a href="mailto:${escapeHtml(complaint.citizen_email)}" class="contact-link" title="Email Citizen">✉️ ${escapeHtml(complaint.citizen_email)}</a>
                        </div>
                    </div>
                </div>

                <div class="issue-description-box">
                    <p>${escapeHtml(complaint.description)}</p>
                </div>

                ${photoSection}
                ${latestReplyHtml}

                <div class="action-dock">
                    <div class="action-dock-header">
                        <h4>⚡ Take Administrative Action</h4>
                        <small>Update resolution status and provide citizen feedback</small>
                    </div>

                    <form id="actionForm-${complaint.id}" onsubmit="handleStatusUpdate(event, '${complaint.id}')" class="modern-action-form">
                        <div class="action-form-grid">
                            <div class="action-status-field">
                                <label for="statusSelect-${complaint.id}">Change Status:</label>
                                <select id="statusSelect-${complaint.id}" class="action-status-select select-${getStatusClass(complaint.status)}">
                                    <option value="Pending" ${complaint.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                                    <option value="In Progress" ${complaint.status === 'In Progress' ? 'selected' : ''}>🔄 In Progress</option>
                                    <option value="Resolved" ${complaint.status === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
                                    <option value="Cancelled" ${complaint.status === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
                                </select>
                            </div>

                            <div class="action-reply-field">
                                <label for="replyText-${complaint.id}">Official Municipal Response / Action Log:</label>
                                <textarea id="replyText-${complaint.id}" placeholder="e.g. Ward inspector visited location, repair scheduled with contractor..." rows="2" class="action-reply-textarea">${complaint.latest_admin_reply ? escapeHtml(complaint.latest_admin_reply) : ''}</textarea>
                            </div>
                        </div>

                        <button type="submit" id="saveBtn-${complaint.id}" class="action-save-btn">
                            💾 Save & Record Action
                        </button>
                    </form>
                </div>
            `;

            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = `<div class="track-error">Failed to load complaints: ${err.message}</div>`;
    }
}

// Handle status and reply update submission
async function handleStatusUpdate(event, complaintId) {
    event.preventDefault();

    const statusSelect = document.getElementById(`statusSelect-${complaintId}`);
    const replyText = document.getElementById(`replyText-${complaintId}`);
    const saveBtn = document.getElementById(`saveBtn-${complaintId}`);

    const newStatus = statusSelect ? statusSelect.value : null;
    const adminReply = replyText ? replyText.value.trim() : '';

    if (!newStatus) {
        showToast('Please select a valid status.', false);
        return;
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving update...';
        }

        const res = await apiFetch(`/admin/complaints/${complaintId}/status`, {
            method: 'PATCH',
            body: {
                status: newStatus,
                adminReply: adminReply,
                actionDescription: `Status updated to ${newStatus} by municipal administrator.`
            }
        });

        showToast(res.message || 'Complaint status updated successfully!', true);
        await updateStatistics();
        await loadAdminComplaints();
    } catch (err) {
        showToast(err.message || 'Failed to update complaint status.', false);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 Save & Record Action';
        }
    }
}

// Helper: Clear search input
function clearSearch() {
    const searchInput = document.getElementById('searchComplaint');
    if (searchInput) {
        searchInput.value = '';
        loadAdminComplaints();
    }
}

// Helper: Reset all search and filters
function resetAllFilters() {
    const searchInput = document.getElementById('searchComplaint');
    const categoryFilter = document.getElementById('categoryFilter');
    const priorityFilter = document.getElementById('priorityFilter');

    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = 'All';
    if (priorityFilter) priorityFilter.value = 'All';

    selectStatusFilter('All');
}

// Helper: Refresh dashboard data
async function refreshDashboard() {
    await updateStatistics();
    await loadAdminComplaints();
    showToast('Dashboard data refreshed!', true);
}

// Copy Complaint ID to clipboard
function copyComplaintId(id) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(id).then(() => {
            showToast(`Complaint ID ${id} copied!`, true);
        }).catch(() => {
            showToast(`Complaint ID: ${id}`, true);
        });
    } else {
        showToast(`Complaint ID: ${id}`, true);
    }
}

// Toast notification helper
function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toastNotification');
    if (!toast) {
        alert(message);
        return;
    }

    toast.innerText = message;
    toast.className = `toast-popup show ${isSuccess ? 'toast-success' : 'toast-error'}`;

    setTimeout(() => {
        toast.className = 'toast-popup';
    }, 3200);
}

// Map status string to CSS class suffix
function getStatusClass(status) {
    switch (status) {
        case 'Pending': return 'pending';
        case 'In Progress': return 'progress';
        case 'Resolved': return 'resolved';
        case 'Cancelled': return 'cancelled';
        default: return 'all';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.selectStatusFilter = selectStatusFilter;
window.handleStatusUpdate = handleStatusUpdate;
window.clearSearch = clearSearch;
window.resetAllFilters = resetAllFilters;
window.refreshDashboard = refreshDashboard;
window.copyComplaintId = copyComplaintId;
