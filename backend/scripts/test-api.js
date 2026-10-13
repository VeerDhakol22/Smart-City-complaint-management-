const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

async function runTests() {
    console.log('==================================================');
    console.log('  Smart City Complaint Management API Test Suite  ');
    console.log(`  Target: ${BASE_URL}`);
    console.log('==================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, extra = '') {
        if (condition) {
            console.log(`✅ PASS: ${testName} ${extra}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${testName} ${extra}`);
            failed++;
        }
    }

    let userCookie = null;
    let adminCookie = null;
    let testComplaintId = null;
    let testNumericId = null;

    const testEmail = `citizen_${Date.now()}@example.com`;
    const testPassword = 'Password@123';

    try {
        // Test 1: Health check
        console.log('[1] Checking Server Health...');
        const healthRes = await fetch(`${BASE_URL}/api/health`);
        const healthData = await healthRes.json();
        assert(healthRes.ok && healthData.status === 'UP', 'Server is up and responding', `(Database: ${healthData.database})`);

        // Test 2: Register Citizen
        console.log('\n[2] Testing Citizen Registration...');
        const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Tejas Ghadge',
                email: testEmail,
                mobile: '9876543210',
                password: testPassword,
                confirmPassword: testPassword
            })
        });
        const regData = await regRes.json();
        assert(regRes.status === 201 && regData.success, 'Citizen registered successfully');

        // Test 3: Duplicate Email Check
        console.log('\n[3] Testing Duplicate Registration Rejection...');
        const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Tejas Duplicate',
                email: testEmail,
                mobile: '9876543210',
                password: testPassword,
                confirmPassword: testPassword
            })
        });
        assert(dupRes.status === 409, 'Duplicate email registration correctly rejected with 409 Conflict');

        // Test 4: Citizen Login & Session
        console.log('\n[4] Testing Citizen Login & Session...');
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        userCookie = loginRes.headers.get('set-cookie');
        const loginData = await loginRes.json();
        assert(loginRes.ok && loginData.success && userCookie, 'Citizen login successful and session cookie issued');

        // Test 5: Verify Session (/api/auth/me)
        console.log('\n[5] Testing Session Authentication (/api/auth/me)...');
        const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: { 'Cookie': userCookie }
        });
        const meData = await meRes.json();
        assert(meRes.ok && meData.authenticated && meData.role === 'citizen', 'Session recognized citizen identity');

        // Test 6: Create Complaint with FormData
        console.log('\n[6] Testing Complaint Submission (with sample photo)...');
        // Create small dummy png buffer (1x1 pixel)
        const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        const blob = new Blob([dummyPng], { type: 'image/png' });

        const formData = new FormData();
        formData.append('title', 'Street light broken near Main Market');
        formData.append('category', 'Street Light');
        formData.append('priority', 'High');
        formData.append('location', 'Station Road, Ward 4');
        formData.append('description', 'Pole #42 has flickering and non-operational light creating hazards at night.');
        formData.append('photo', blob, 'sample_broken_light.png');

        const compRes = await fetch(`${BASE_URL}/api/complaints`, {
            method: 'POST',
            headers: { 'Cookie': userCookie },
            body: formData
        });
        const compData = await compRes.json();
        testComplaintId = compData.complaintId;
        testNumericId = compData.complaint ? compData.complaint.id : null;
        assert(compRes.status === 201 && compData.success && testComplaintId, 'Complaint submitted with unique Complaint ID', `(${testComplaintId})`);

        // Test 7: My Complaints List
        console.log('\n[7] Testing Citizen Complaints Listing (/api/complaints/my)...');
        const myRes = await fetch(`${BASE_URL}/api/complaints/my`, {
            headers: { 'Cookie': userCookie }
        });
        const myData = await myRes.json();
        assert(myRes.ok && Array.isArray(myData.complaints) && myData.complaints.length > 0, 'My complaints retrieved successfully', `(Total: ${myData.complaints.length})`);

        // Test 8: Track Complaint
        console.log('\n[8] Testing Complaint Tracking (/api/complaints/track/:id)...');
        const trackRes = await fetch(`${BASE_URL}/api/complaints/track/${testComplaintId}`);
        const trackData = await trackRes.json();
        assert(trackRes.ok && trackData.success && trackData.complaint.complaint_id === testComplaintId, 'Complaint tracking returned accurate status and details');

        // Test 9: Admin Login
        console.log('\n[9] Testing Admin Login...');
        const adminRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin@smartcity.gov',
                password: 'admin123'
            })
        });
        adminCookie = adminRes.headers.get('set-cookie');
        const adminData = await adminRes.json();
        assert(adminRes.ok && adminData.success && adminCookie, 'Admin authenticated and session cookie received');

        // Test 10: Admin Operations Dashboard Statistics
        console.log('\n[10] Testing Admin Statistics (/api/admin/statistics)...');
        const statsRes = await fetch(`${BASE_URL}/api/admin/statistics`, {
            headers: { 'Cookie': adminCookie }
        });
        const statsData = await statsRes.json();
        assert(statsRes.ok && statsData.statistics && statsData.statistics.total >= 1, 'Admin statistics calculated correctly', `(Total: ${statsData.statistics.total}, Pending: ${statsData.statistics.pending})`);

        // Test 11: Admin Status Transition and Reply
        console.log('\n[11] Testing Admin Status Update & Official Reply...');
        const updateRes = await fetch(`${BASE_URL}/api/admin/complaints/${testNumericId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                status: 'In Progress',
                adminReply: 'Electrician dispatched to inspect pole #42 on Station Road.',
                actionDescription: 'Work order #EW-889 issued to Electrical Department.'
            })
        });
        const updateData = await updateRes.json();
        assert(updateRes.ok && updateData.success && updateData.complaint.new_status === 'In Progress', 'Admin updated status to In Progress and recorded reply');

        // Test 12: Cancellation Restriction Enforcement
        console.log('\n[12] Testing Cancellation Rules (Must fail when In Progress)...');
        const cancelRes = await fetch(`${BASE_URL}/api/complaints/${testNumericId}/cancel`, {
            method: 'POST',
            headers: { 'Cookie': userCookie }
        });
        const cancelData = await cancelRes.json();
        assert(cancelRes.status === 400 && !cancelData.success, 'Cancellation correctly rejected for non-Pending complaint', `(Message: ${cancelData.message})`);

        // Test 13: Re-verify Tracking Timeline
        console.log('\n[13] Verifying Updated Audit Trail in Citizen Tracking...');
        const reTrackRes = await fetch(`${BASE_URL}/api/complaints/track/${testComplaintId}`);
        const reTrackData = await reTrackRes.json();
        const hasProgressUpdate = reTrackData.updates && reTrackData.updates.some(u => u.new_status === 'In Progress');
        assert(reTrackRes.ok && hasProgressUpdate, 'Tracking timeline accurately reflects administrative action');

    } catch (err) {
        console.error('\n💥 Unexpected test execution error:', err);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests();

