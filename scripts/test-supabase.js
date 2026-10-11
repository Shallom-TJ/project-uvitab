#!/usr/bin/env node
/**
 * =========================================================
 * VU NOTES — Supabase Integration Verification Test Script
 * Tests:
 *  1. Supabase API & Auth connectivity
 *  2. Verification of all 9 required database tables
 *  3. Verification of required Supabase Storage buckets
 *  4. Real data insertion test (Tutor profile)
 *  5. Real data retrieval and persistence verification
 *  6. Real data insertion test (Tutor booking)
 *  7. Clean teardown of test data
 * =========================================================
 */

const SUPABASE_URL = 'https://wnxzqewpjanebtniadmj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndueHpxZXdwamFuZWJ0bmlhZG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1ODk2MjEsImV4cCI6MjEwNzE2NTYyMX0.EW8uDnHd2UeoNTVivNW2nU3O8zTuMXy1HzQKIdomkXU';

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function runTests() {
  console.log('====================================================');
  console.log('🧪 VU NOTES — SUPABASE AUTOMATED INTEGRATION TESTS');
  console.log(`🌐 Project URL: ${SUPABASE_URL}`);
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Connectivity Test
  console.log('STEP 1: Testing Supabase Connectivity & Auth API...');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: HEADERS });
    if (res.ok) {
      console.log('  ✅ PASS: Supabase Auth API is reachable and responding (HTTP 200).');
    } else {
      console.error(`  ❌ FAIL: Supabase Auth endpoint returned HTTP ${res.status}`);
      allPassed = false;
    }
  } catch (err) {
    console.error(`  ❌ FAIL: Network connection error: ${err.message}`);
    allPassed = false;
  }

  // 2. Database Tables Verification
  console.log('\nSTEP 2: Verifying Required Database Tables...');
  const tables = ['profiles', 'courses', 'resources', 'tutors', 'bookings', 'reviews', 'notifications', 'settings', 'meta'];
  let tablesReady = true;

  for (const tbl of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${tbl}?select=*&limit=1`, { headers: HEADERS });
      const text = await res.text();
      if (res.ok) {
        console.log(`  ✅ Table '${tbl}': Exists and queryable.`);
      } else {
        console.error(`  ❌ Table '${tbl}': NOT FOUND or error (HTTP ${res.status}): ${text.substring(0, 100)}`);
        tablesReady = false;
        allPassed = false;
      }
    } catch (e) {
      console.error(`  ❌ Table '${tbl}': Error querying table: ${e.message}`);
      tablesReady = false;
      allPassed = false;
    }
  }

  // 3. Storage Buckets Verification
  console.log('\nSTEP 3: Verifying Supabase Storage Buckets...');
  let storageReady = true;
  const reqBuckets = ['resources', 'tutor-photos'];
  for (const reqB of reqBuckets) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${reqB}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ prefix: '', limit: 1 })
      });
      if (res.ok) {
        console.log(`  ✅ Bucket '${reqB}': Exists and accessible in Supabase Storage.`);
      } else {
        const errText = await res.text();
        console.error(`  ❌ Bucket '${reqB}': Error accessing bucket (HTTP ${res.status}): ${errText}`);
        storageReady = false;
        allPassed = false;
      }
    } catch (e) {
      console.error(`  ❌ Bucket '${reqB}': Network error: ${e.message}`);
      storageReady = false;
      allPassed = false;
    }
  }

  if (!tablesReady) {
    console.log('\n⚠️  SUMMARY: Database tables have not yet been created in this Supabase project.');
    console.log('   Action Required: Please copy supabase/schema.sql and execute it in Supabase Dashboard → SQL Editor.');
    return;
  }

  // 4. Test Tutor Registration
  console.log('\nSTEP 4: Testing Tutor Registration Form Submission...');
  const testTutorId = `TEST-TUT-${Math.floor(1000 + Math.random() * 9000)}`;
  const testTutor = {
    id: testTutorId,
    tutor_id: testTutorId,
    name: 'Automated Test Tutor',
    faculty: 'Faculty of Science and Technology',
    course: 'Software Engineering',
    subject: 'Software Engineering',
    phone: '+256700000000',
    email: 'test.tutor@example.com',
    bio: 'Test tutor profile generated for verification.',
    availability: 'Flexible',
    fee_amount: '20000',
    fee_duration: '1 Hour',
    owner_id: 'test_automated_runner'
  };

  try {
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/tutors`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(testTutor)
    });

    if (postRes.ok) {
      console.log(`  ✅ PASS: Tutor record created successfully (${testTutorId}).`);
    } else {
      const errText = await postRes.text();
      console.error(`  ❌ FAIL: Tutor insertion failed (HTTP ${postRes.status}): ${errText}`);
      allPassed = false;
    }

    // 5. Test Tutor Retrieval
    console.log('\nSTEP 5: Testing Tutor Record Persistence & Retrieval...');
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/tutors?id=eq.${testTutorId}&select=*`, { headers: HEADERS });
    if (getRes.ok) {
      const data = await getRes.json();
      if (data && data.length && data[0].id === testTutorId) {
        console.log(`  ✅ PASS: Retrieved persisted tutor record from Supabase: ${data[0].name} (${data[0].course}).`);
      } else {
        console.error('  ❌ FAIL: Record not found upon retrieval.');
        allPassed = false;
      }
    } else {
      console.error(`  ❌ FAIL: Tutor retrieval query failed (HTTP ${getRes.status})`);
      allPassed = false;
    }

    // 6. Test Booking Submission
    console.log('\nSTEP 6: Testing Tutor Booking Submission...');
    const testBookingId = `TEST-BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const testBooking = {
      id: testBookingId,
      tutor_id: testTutorId,
      tutor_name: 'Automated Test Tutor',
      student_name: 'Automated Test Student',
      student_email: 'test.student@example.com',
      course: 'Software Engineering',
      date: '2026-10-15',
      time: '14:00',
      duration: '1 Hour',
      fee_amount: 20000,
      session_note: 'Automated test booking verification.',
      booking_status: 'Pending',
      payment_status: 'Payment Pending',
      session_status: 'Not Started',
      commission_rate: 10,
      commission_amount: 2000,
      tutor_earnings: 18000,
      owner_id: 'test_automated_runner'
    };

    const bRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(testBooking)
    });

    if (bRes.ok) {
      console.log(`  ✅ PASS: Booking record created successfully (${testBookingId}).`);
      // Verify retrieval
      const getB = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${testBookingId}&select=*`, { headers: HEADERS });
      const bData = await getB.json();
      if (bData && bData.length && bData[0].id === testBookingId) {
        console.log(`  ✅ PASS: Retrieved persisted booking record: #${bData[0].id} for ${bData[0].student_name}.`);
      }
    } else {
      const bErr = await bRes.text();
      console.error(`  ❌ FAIL: Booking submission failed (HTTP ${bRes.status}): ${bErr}`);
      allPassed = false;
    }

    // 7. Cleanup
    console.log('\nSTEP 7: Cleaning up test records...');
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${testBookingId}`, { method: 'DELETE', headers: HEADERS });
    await fetch(`${SUPABASE_URL}/rest/v1/tutors?id=eq.${testTutorId}`, { method: 'DELETE', headers: HEADERS });
    console.log('  🧹 Cleaned up test booking and tutor records.');

  } catch (err) {
    console.error(`  ❌ Error during submission test: ${err.message}`);
    allPassed = false;
  }

  console.log('\n====================================================');
  console.log(allPassed ? '🎉 ALL TESTS PASSED SUCCESSFULLY!' : '⚠️ SOME TESTS FAILED OR ARE BLOCKED.');
  console.log('====================================================');
}

runTests();
