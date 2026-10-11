#!/usr/bin/env node
/* =========================================================
   VU NOTES — Supabase Admin / Super Admin Role Script
   Victoria University Uganda Student Resource Platform
   
   PURPOSE:
   Safely assigns 'admin' or 'superadmin' role to a registered user
   in the Supabase `public.profiles` table using the Service Role Key.
   
   USAGE:
   SUPABASE_SERVICE_ROLE_KEY="ey..." node scripts/set-admin-role.js <user-email> [role]
   
   Roles: 'admin', 'superadmin', 'user' (default: 'superadmin')
   ========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wnxzqewpjanebtniadmj.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const targetEmail = process.argv[2];
const targetRole = (process.argv[3] || 'superadmin').toLowerCase();

if (!targetEmail) {
  console.log('\n❌ Usage:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" node scripts/set-admin-role.js <email> [role]');
  console.log('\nExample:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY="ey..." node scripts/set-admin-role.js admin@vu.ac.ug superadmin\n');
  process.exit(1);
}

if (!['user', 'admin', 'superadmin'].includes(targetRole)) {
  console.error(`\n❌ Invalid role: '${targetRole}'. Allowed roles: 'user', 'admin', 'superadmin'\n`);
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  console.error('   The service role key is required for administrative role updates.');
  console.error('   Find it in: Supabase Dashboard → Project Settings → API → Project API Keys → service_role (secret)');
  console.error('\nAlternatively, you can run this SQL query directly in your Supabase SQL Editor:');
  console.error(`   UPDATE public.profiles SET role = '${targetRole}' WHERE email = '${targetEmail}';\n`);
  process.exit(1);
}

async function setAdminRole() {
  console.log('====================================================');
  console.log('🛡️  VU NOTES — SUPABASE ADMIN ROLE ASSIGNMENT');
  console.log(`🌐 Target Project: ${SUPABASE_URL}`);
  console.log(`👤 Target Email:   ${targetEmail}`);
  console.log(`🔑 Requested Role:  ${targetRole}`);
  console.log('====================================================\n');

  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. Look up user profile by email
    const queryRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(targetEmail)}&select=*`, {
      headers
    });

    if (!queryRes.ok) {
      const errText = await queryRes.text();
      console.error(`❌ Failed to query profiles table: HTTP ${queryRes.status}`, errText);
      process.exit(1);
    }

    const profiles = await queryRes.json();

    if (!profiles || profiles.length === 0) {
      console.error(`\n❌ User '${targetEmail}' was not found in the public.profiles table.`);
      console.error('   Ensure the user has registered in the Victoria University Notes app or via Supabase Auth first.');
      process.exit(1);
    }

    const profile = profiles[0];
    console.log(`✅ Found profile: ID ${profile.id} (Current role: ${profile.role || 'user'})`);

    // 2. Update role
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        role: targetRole,
        updated_at: new Date().toISOString()
      })
    });

    if (!updateRes.ok) {
      const updateErr = await updateRes.text();
      console.error(`❌ Failed to update role: HTTP ${updateRes.status}`, updateErr);
      process.exit(1);
    }

    const updated = await updateRes.json();
    console.log(`\n🎉 SUCCESS: User '${targetEmail}' has been granted the '${targetRole}' role!`);
    console.log(`   Updated record:`, updated[0] || updated);
    console.log('\nNow the user can sign in to admin.html and access the Protected Governance Dashboard.\n');
  } catch (err) {
    console.error(`❌ Network or unexpected error:`, err.message);
    process.exit(1);
  }
}

setAdminRole();
