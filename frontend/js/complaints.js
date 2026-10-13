// Complaints Management & Tracking Client Logic

document.addEventListener('DOMContentLoaded', () => {
    initComplaintSubmit();
    initMyComplaints();
    initComplaintDetails();
    initTrackComplaint();
});

// ===============================
// 1. SUBMIT COMPLAINT (complaint.html)
// ===============================
function initComplaintSubmit() {
    const complaintForm = document.getElementById('complaintForm');
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photoPreview');

    if (!complaintForm) return;

    // Photo Preview handler
    if (photoInput && photoPreview) {
        photoInput.addEventListener('change', function () {
            const file = photoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    photoPreview.src = e.target.result;
                    photoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                photoPreview.style.display = 'none';
            }
        });
    }

    // Submit form handler
    complaintForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value;
        const priority = document.getElementById('priority').value;
        const description = document.getElementById('description').value.trim();
        const location = document.getElementById('location').value.trim();
        const photoFile = photoInput && photoInput.files ? photoInput.files[0] : null;

        if (!title || !category || !priority || !description || !location) {
            alert('Please fill in all required fields.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('priority', priority);
        formData.append('description', description);
        formData.append('location', location);
        if (photoFile) {
            formData.append('photo', photoFile);
        }

        try {
            const submitBtn = complaintForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Submitting...';
            }

            const res = await apiFetch('/complaints', {
                method: 'POST',
                body: formData
            });

            alert(`Complaint submitted successfully!\n\nComplaint ID: ${res.complaintId}`);
            window.location.href = 'mycomplaints.html';
        } catch (err) {
            alert(err.message || 'Error submitting complaint.');
            const submitBtn = complaintForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Submit Complaint';
            }
        }
    });
}

// ===============================
// 2. MY COMPLAINTS (mycomplaints.html)
// ===============================
async function initMyComplaints() {
    const complaintsList = document.getElementById('complaintsList');
    if (!complaintsList) return;

    try {
        complaintsList.innerHTML = '<p>Loading your complaints...</p>';
        const res = await apiFetch('/complaints/my');
        const complaints = res.complaints || [];

        complaintsList.innerHTML = '';
        if (complaints.length === 0) {
            complaintsList.innerHTML = `
                <div class="complaint-item">
                    <p>No complaints submitted yet.</p>
                </div>
            `;
            return;
        }

        complaints.forEach(complaint => {
            const item = document.createElement('div');
            item.className = 'complaint-item';

            const formattedDate = new Date(complaint.created_at).toLocaleDateString('en-IN', {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            let cancelButton = '';
            if (complaint.status === 'Pending') {
                cancelButton = `
                    <button class="cancel-btn" onclick="cancelComplaint('${complaint.complaint_id}')" style="background:#dc3545; margin-top: 8px;">
                        ❌ Cancel Complaint
                    </button>
                `;
            }

            let statusColor = '#f39c12'; // Pending
            if (complaint.status === 'In Progress') statusColor = '#3498db';
            if (complaint.status === 'Resolved') statusColor = '#2ecc71';
            if (complaint.status === 'Cancelled') statusColor = '#95a5a6';

            item.innerHTML = `
                <h3>${escapeHtml(complaint.title)}</h3>
                <p><strong>Complaint ID:</strong> ${escapeHtml(complaint.complaint_id)}</p>
                <p><strong>Category:</strong> ${escapeHtml(complaint.category)}</p>
                <p><strong>Priority:</strong> ${escapeHtml(complaint.priority)}</p>
                <p><strong>Status:</strong> <span style="font-weight:bold; color:${statusColor};">${escapeHtml(complaint.status)}</span></p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                ${complaint.latest_admin_reply ? `<p><strong>Admin Reply:</strong> ${escapeHtml(complaint.latest_admin_reply)}</p>` : ''}
                <button onclick="viewDetails('${complaint.complaint_id}')" style="margin-top: 5px;">
                    📄 View Details
                </button>
                ${cancelButton}
            `;

            complaintsList.appendChild(item);
        });
    } catch (err) {
        complaintsList.innerHTML = `<div class="track-error">Failed to load complaints: ${err.message}</div>`;
    }
}

// Cancel Complaint
async function cancelComplaint(id) {
    if (!confirm('Are you sure you want to cancel this complaint?')) {
        return;
    }

    try {
        const res = await apiFetch(`/complaints/${encodeURIComponent(id)}/cancel`, {
            method: 'POST'
        });
        alert(res.message || 'Complaint cancelled.');
        initMyComplaints();
    } catch (err) {
        alert(err.message || 'Failed to cancel complaint.');
    }
}

// Navigate to Details
function viewDetails(id) {
    window.location.href = `complaint-details.html?id=${encodeURIComponent(id)}`;
}

// ===============================
// 3. COMPLAINT DETAILS (complaint-details.html)
// ===============================
async function initComplaintDetails() {
    const detailsContainer = document.getElementById('details');
    if (!detailsContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    const complaintId = urlParams.get('id');

    if (!complaintId) {
        detailsContainer.innerHTML = '<div class="track-error">❌ No Complaint ID specified in URL.</div>';
        return;
    }

    try {
        detailsContainer.innerHTML = '<p>Loading complaint details...</p>';
        const res = await apiFetch(`/complaints/${encodeURIComponent(complaintId)}`);
        const c = res.complaint;
        const updates = res.updates || [];

        const formattedDate = new Date(c.created_at).toLocaleString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let photoHtml = '<p><strong>Photo:</strong> No photo attached</p>';
        if (c.photo_path) {
            photoHtml = `
                <p><strong>Photo:</strong></p>
                <div style="margin: 10px 0;">
                    <a href="${c.photo_path}" target="_blank">
                        <img src="${c.photo_path}" alt="Complaint Photo" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #ddd;">
                    </a>
                    <br><small>(Click photo to view full size)</small>
                </div>
            `;
        }

        // Timeline html
        let timelineHtml = '<div style="margin-top: 15px;"><h3>📋 Status & Action History</h3>';
        if (updates.length === 0) {
            timelineHtml += '<p>No updates recorded yet.</p>';
        } else {
            timelineHtml += '<ul style="list-style: none; padding: 0;">';
            updates.forEach(u => {
                const uDate = new Date(u.created_at).toLocaleString('en-IN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                timelineHtml += `
                    <li style="border-left: 3px solid #3498db; padding: 8px 12px; margin-bottom: 10px; background: #fdfdfd; border-radius: 0 6px 6px 0;">
                        <strong>Status:</strong> ${escapeHtml(u.new_status)} 
                        <span style="font-size: 0.85em; color: #666; float: right;">${uDate}</span><br>
                        ${u.action_description ? `<small style="color:#555;">${escapeHtml(u.action_description)}</small><br>` : ''}
                        ${u.admin_reply ? `<strong>Official Reply:</strong> <em>"${escapeHtml(u.admin_reply)}"</em>` : ''}
                    </li>
                `;
            });
            timelineHtml += '</ul>';
        }
        timelineHtml += '</div>';

        detailsContainer.innerHTML = `
            <div class="complaint-detail">
                <h2>${escapeHtml(c.title)}</h2>
                <p><strong>Complaint ID:</strong> ${escapeHtml(c.complaint_id)}</p>
                <p><strong>Category:</strong> ${escapeHtml(c.category)}</p>
                <p><strong>Priority:</strong> ${escapeHtml(c.priority)}</p>
                <p><strong>Current Status:</strong> <span style="font-weight:bold; color: #2980b9;">${escapeHtml(c.status)}</span></p>
                <p><strong>Location:</strong> ${escapeHtml(c.location)}</p>
                <p><strong>Description:</strong> ${escapeHtml(c.description)}</p>
                ${photoHtml}
                <p><strong>Registered On:</strong> ${formattedDate}</p>
                ${timelineHtml}
            </div>
        `;
    } catch (err) {
        detailsContainer.innerHTML = `<div class="track-error">❌ ${err.message}</div>`;
    }
}

// ===============================
// 4. TRACK COMPLAINT (track.html)
// ===============================
function initTrackComplaint() {
    const trackForm = document.getElementById('trackForm');
    const resultContainer = document.getElementById('result');
    if (!trackForm || !resultContainer) return;

    trackForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const searchId = document.getElementById('complaintId').value.trim();

        if (!searchId) {
            alert('Please enter a Complaint ID.');
            return;
        }

        try {
            resultContainer.innerHTML = '<p>Searching complaint records...</p>';
            const res = await apiFetch(`/complaints/track/${encodeURIComponent(searchId)}`);
            const c = res.complaint;
            const updates = res.updates || [];

            let pendingClass = '';
            let progressClass = '';
            let resolvedClass = '';

            if (c.status === 'Pending') {
                pendingClass = 'active';
            } else if (c.status === 'In Progress') {
                pendingClass = 'completed';
                progressClass = 'active';
            } else if (c.status === 'Resolved') {
                pendingClass = 'completed';
                progressClass = 'completed';
                resolvedClass = 'active';
            }

            let progressBarHtml = `
                <div class="track-progress">
                    <div class="step ${pendingClass}">
                        <div class="circle">1</div>
                        <p>Pending</p>
                    </div>
                    <div class="step ${progressClass}">
                        <div class="circle">2</div>
                        <p>In Progress</p>
                    </div>
                    <div class="step ${resolvedClass}">
                        <div class="circle">3</div>
                        <p>Resolved</p>
                    </div>
                </div>
            `;

            if (c.status === 'Cancelled') {
                progressBarHtml = `
                    <div style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 6px; text-align: center; margin: 15px 0;">
                        <strong>⚠️ This complaint was Cancelled.</strong>
                    </div>
                `;
            }

            // Updates timeline
            let timelineHtml = '<div style="margin-top: 15px; text-align: left;"><h4>Action History</h4>';
            if (updates.length > 0) {
                timelineHtml += '<ul style="list-style: none; padding: 0;">';
                updates.forEach(u => {
                    const uDate = new Date(u.created_at).toLocaleString('en-IN', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                    timelineHtml += `
                        <li style="border-left: 3px solid #2980b9; padding: 6px 10px; margin-bottom: 8px; background: #f9f9f9; font-size: 0.9em;">
                            <strong>${escapeHtml(u.new_status)}</strong> - <small>${uDate}</small><br>
                            ${u.action_description ? `${escapeHtml(u.action_description)}<br>` : ''}
                            ${u.admin_reply ? `<strong>Official Reply:</strong> "${escapeHtml(u.admin_reply)}"` : ''}
                        </li>
                    `;
                });
                timelineHtml += '</ul>';
            } else {
                timelineHtml += '<p>No administrative action recorded yet.</p>';
            }
            timelineHtml += '</div>';

            resultContainer.innerHTML = `
                <div class="track-box" style="margin-top: 15px;">
                    <h3>${escapeHtml(c.title)}</h3>
                    <p><strong>Complaint ID:</strong> ${escapeHtml(c.complaint_id)}</p>
                    <p><strong>Category:</strong> ${escapeHtml(c.category)}</p>
                    <p><strong>Location:</strong> ${escapeHtml(c.location)}</p>
                    <p><strong>Current Status:</strong> <strong>${escapeHtml(c.status)}</strong></p>
                    ${progressBarHtml}
                    ${timelineHtml}
                </div>
            `;
        } catch (err) {
            resultContainer.innerHTML = `
                <div class="track-error">
                    ❌ ${err.message}
                    <br><br>
                    Please verify your Complaint ID and try again.
                </div>
            `;
        }
    });
}

// Utility to escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.cancelComplaint = cancelComplaint;
window.viewDetails = viewDetails;

