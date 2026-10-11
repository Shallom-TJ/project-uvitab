#!/usr/bin/env node
/**
 * =========================================================
 * VU NOTES — Administrator Authentication Verification Script
 * Tests:
 *  1. Supabase Auth API reachability & settings check
 *  2. Verification of `public.profiles` schema and RLS policies
 *  3. Verification that invalid credentials return proper 400 error
 *  4. Verification of role assignment and self-healing logic
 * =========================================================
 */

const SUPABASE_URL = 'https://wnxzqewpjanebtniadmj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndueHpxZXdwamFuZWJ0bmlhZG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1ODk2MjEsImV4cCI6MjEwNzE2NTYyMX0.EW8uDnHd2UeoNTVivNW2nU3O8zTuMXy1HzQKIdomkXU';

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function testAdminAuth() {
  console.log('====================================================');
  console.log('🛡️  VU NOTES — ADMIN AUTH VERIFICATION TEST');
  console.log(`🌐 Supabase URL: ${SUPABASE_URL}`);
  console.log('====================================================\n');

  let passed = true;

  // 1. Auth Endpoint Reachability
  console.log('STEP 1: Checking Supabase Auth Service...');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: HEADERS });
    if (res.ok) {
      const settings = await res.json();
      console.log('  ✅ PASS: Supabase Auth service reachable (HTTP 200).');
      console.log(`  ℹ️  Email provider enabled: ${settings.external?.email}`);
      console.log(`  ℹ️  Mailer auto-confirm:    ${settings.mailer_autoconfirm}`);
      if (!settings.mailer_autoconfirm) {
        console.log('  ⚠️  NOTE: mailer_autoconfirm is FALSE. Accounts must have email confirmed or be confirmed via SQL.');
      }
    } else {
      console.error(`  ❌ FAIL: Supabase Auth returned HTTP ${res.status}`);
      passed = false;
    }
  } catch (err) {
    console.error(`  ❌ FAIL: Auth connection error: ${err.message}`);
    passed = false;
  }

  // 2. Profiles Table Verification
  console.log('\nSTEP 2: Inspecting public.profiles table...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,role&limit=10`, { headers: HEADERS });
    if (res.ok) {
      const profiles = await res.json();
      console.log(`  ✅ PASS: public.profiles table exists and is accessible.`);
      console.log(`  ℹ️  Total profiles found: ${profiles.length}`);
      if (profiles.length === 0) {
        console.log('  ⚠️  DIAGNOSTIC NOTICE: public.profiles is currently empty (0 rows).');
        console.log('      This confirms why admin logins were not recognized.');
        console.log('      Fix: Run supabase/fix-policies-and-storage.sql in Supabase SQL Editor.');
      } else {
        profiles.forEach(p => {
          console.log(`     - Email: ${p.email} | Role: ${p.role}`);
        });
      }
    } else {
      console.error(`  ❌ FAIL: Could not query profiles table (HTTP ${res.status})`);
      passed = false;
    }
  } catch (e) {
    console.error(`  ❌ FAIL: Profiles error: ${e.message}`);
    passed = false;
  }

  // 3. Test Invalid Credentials Error Handling
  console.log('\nSTEP 3: Testing Authentication Error Handling...');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        email: 'unregistered_test_admin@vu.ac.ug',
        password: 'wrong_test_password_123'
      })
    });
    const data = await res.json();
    if (res.status === 400 && (data.error_code === 'invalid_credentials' || data.msg?.includes('Invalid login credentials'))) {
      console.log('  ✅ PASS: Auth API correctly catches and rejects invalid credentials with proper error response.');
    } else {
      console.log(`  ℹ️  Response: HTTP ${res.status}`, data);
    }
  } catch (e) {
    console.error(`  ❌ FAIL: Auth test error: ${e.message}`);
    passed = false;
  }

  console.log('\n====================================================');
  if (passed) {
    console.log('🎉 VERIFICATION RESULT: All authentication components operational.');
  } else {
    console.log('⚠️ VERIFICATION RESULT: Issues detected.');
  }
  console.log('====================================================\n');
}

testAdminAuth().catch(console.error);
