#!/usr/bin/env node
/* =========================================================
   VU NOTES — Super Admin / Admin Bootstrap Script
   Victoria University Uganda Student Resource Platform
   
   PURPOSE:
   Safely bootstraps the initial SUPER ADMIN or sets an ADMIN
   claim using the Firebase Admin SDK.
   
   SECURITY GUARANTEE:
   - Must be executed directly by the server operator/developer in terminal.
   - Cannot be accessed, invoked, or spoofed by browser clients or normal users.
   - Sets privileged Firebase Auth Custom Claims:
       Super Admin: { admin: true, superAdmin: true, role: 'superadmin' }
       Admin:       { admin: true, superAdmin: false, role: 'admin' }
   - Also records the role in Firestore `/roles/{uid}` for audit logging
     and multi-layer security.
   ========================================================= */

const path = require('path');
const fs = require('fs');

// Attempt to load environment variables from server/.env or root .env
try {
  const serverEnv = path.resolve(__dirname, '../server/.env');
  const rootEnv = path.resolve(__dirname, '../.env');
  if (fs.existsSync(serverEnv)) {
    require('dotenv').config({ path: serverEnv });
  } else if (fs.existsSync(rootEnv)) {
    require('dotenv').config({ path: rootEnv });
  } else {
    require('dotenv').config();
  }
} catch (e) {
  // dotenv is optional if environment variables are already set in shell
}

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('\n❌ Missing dependency: firebase-admin');
  console.error('   Please run: npm install firebase-admin');
  console.error('   Or inside server directory: cd server && npm install\n');
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
let isSuperAdmin = true; // Default bootstrap creates SUPER ADMIN
let targetEmail = null;
let serviceAccountPath = null;

// Parse flags and arguments
const positionalArgs = [];
for (const arg of rawArgs) {
  if (arg === '--admin') {
    isSuperAdmin = false;
  } else if (arg === '--superadmin') {
    isSuperAdmin = true;
  } else {
    positionalArgs.push(arg);
  }
}

if (positionalArgs.length >= 2) {
  serviceAccountPath = positionalArgs[0];
  targetEmail = positionalArgs[1];
} else if (positionalArgs.length === 1) {
  if (positionalArgs[0].endsWith('.json')) {
    serviceAccountPath = positionalArgs[0];
    targetEmail = process.env.ADMIN_EMAIL;
  } else {
    targetEmail = positionalArgs[0];
  }
} else {
  targetEmail = process.env.ADMIN_EMAIL;
}

if (!targetEmail) {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║        VU NOTES — Super Admin & Admin Privileged Setup Script           ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  USAGE:                                                                  ║
║    node scripts/set-admin-claim.js [key.json] <target-email> [options]   ║
║                                                                          ║
║  OPTIONS:                                                                ║
║    --superadmin   (Default) Grants full SUPER ADMIN privileges:         ║
║                   { admin: true, superAdmin: true, role: 'superadmin' } ║
║                   Can promote other users to Admin via the portal.       ║
║                                                                          ║
║    --admin        Grants ordinary ADMIN privileges:                     ║
║                   { admin: true, superAdmin: false, role: 'admin' }     ║
║                   Cannot promote or revoke administrators.               ║
║                                                                          ║
║  EXAMPLES:                                                               ║
║    1. Bootstrap Initial Super Admin with credentials in server/.env:     ║
║       node scripts/set-admin-claim.js admin@vu.ac.ug                     ║
║                                                                          ║
║    2. Bootstrap using downloaded serviceAccountKey.json:                 ║
║       node scripts/set-admin-claim.js ./serviceAccountKey.json admin@vu.ac.ug
║                                                                          ║
║    3. Create an ordinary Admin:                                          ║
║       node scripts/set-admin-claim.js tutor@vu.ac.ug --admin             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

async function bootstrapAdmin() {
  try {
    let credential = null;

    if (serviceAccountPath) {
      const resolvedPath = path.resolve(serviceAccountPath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Service account key file not found at: ${resolvedPath}`);
      }
      credential = admin.credential.cert(require(resolvedPath));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const resolvedPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      credential = admin.credential.cert(require(resolvedPath));
    }

    if (!credential) {
      throw new Error(
        "Could not load Firebase Admin credentials.\n" +
        "Please provide your service account JSON file path:\n" +
        "  node scripts/set-admin-claim.js ./serviceAccountKey.json " + targetEmail + "\n" +
        "Or configure server/.env with FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
      );
    }

    admin.initializeApp({ credential });

    console.log(`\n🔍 Looking up user in Firebase Auth: ${targetEmail}...`);
    const user = await admin.auth().getUserByEmail(targetEmail);
    console.log(`✅ Found account: UID ${user.uid} (${user.email})`);

    const roleName = isSuperAdmin ? 'superadmin' : 'admin';
    const customClaims = {
      admin: true,
      superAdmin: isSuperAdmin,
      role: roleName
    };

    console.log(`⚙️  Applying privileged custom claims...`);
    await admin.auth().setCustomUserClaims(user.uid, customClaims);
    console.log(`✅ Auth custom claims updated:`, JSON.stringify(customClaims));

    // Audit record in Firestore roles collection
    try {
      await admin.firestore().collection('roles').doc(user.uid).set({
        email: user.email,
        role: roleName,
        admin: true,
        superAdmin: isSuperAdmin,
        grantedBy: 'cli_bootstrap_script',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`✅ Firestore audit record created: /roles/${user.uid}`);
    } catch (fsErr) {
      console.warn(`⚠️  Firestore role record warning: ${fsErr.message}`);
    }

    // Verify written claims
    const verifiedUser = await admin.auth().getUser(user.uid);
    console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
    if (isSuperAdmin) {
      console.log(`║  🛡️  SUPER ADMIN INITIALIZATION SUCCESSFUL                       ║`);
    } else {
      console.log(`║  🔑  ADMIN PRIVILEGES GRANTED SUCCESSFUL                         ║`);
    }
    console.log(`╠══════════════════════════════════════════════════════════════════╣`);
    console.log(`║  User:   ${verifiedUser.email.padEnd(54)}  ║`);
    console.log(`║  UID:    ${verifiedUser.uid.padEnd(54)}  ║`);
    console.log(`║  Role:   ${roleName.toUpperCase().padEnd(54)}  ║`);
    console.log(`║  Claims: ${JSON.stringify(verifiedUser.customClaims).padEnd(54)}  ║`);
    console.log(`╠══════════════════════════════════════════════════════════════════╣`);
    console.log(`║  NEXT STEPS:                                                     ║`);
    console.log(`║  1. Sign in with ${verifiedUser.email} on admin.html.             ║`);
    console.log(`║  2. If already logged in, sign out and sign back in to refresh.  ║`);
    if (isSuperAdmin) {
      console.log(`║  3. As Super Admin, you can now promote new admins in the portal ║`);
      console.log(`║     without needing to re-run this script!                       ║`);
    }
    console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

    process.exit(0);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`\n❌ Error: User with email "${targetEmail}" was not found in Firebase Authentication.`);
      console.error(`   → Please create this user first in Firebase Console:`);
      console.error(`     Authentication → Users → Add user (Email/Password)\n`);
    } else {
      console.error(`\n❌ Execution Error:`, err.message || err);
    }
    process.exit(1);
  }
}

bootstrapAdmin();
