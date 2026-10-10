/* =========================================================
   VU NOTES — Centralized Firebase Configuration & Authentication
   Victoria University Uganda Student Resource Hub

   INSTRUCTIONS:
   Paste your real Firebase project credentials below from:
   Firebase Console → Project Settings → General → Web Apps
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAnqaHcCX_Qe_8JrUz0LA5n5kpYl2c3zxU",
  authDomain: "vu-notes-1264f.firebaseapp.com",
  projectId: "vu-notes-1264f",
  storageBucket: "vu-notes-1264f.firebasestorage.app",
  messagingSenderId: "1099170040274",
  appId: "1:1099170040274:web:6f6b76b5a72e118c89a00b",
  measurementId: "G-K7RB4MKQWP"
};

// Guard: Firebase SDK loaded AND real credentials pasted
const FIREBASE_READY = typeof firebase !== 'undefined' &&
  typeof firebaseConfig !== 'undefined' &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith('PASTE_');

let db = null;
let storage = null;
let auth = null;
let functions = null;
let currentUser = null;
let _isAdminUser = false;
let _isSuperAdminUser = false;
let _adminRole = 'user';
let _adminStateCallbacks = [];

if (FIREBASE_READY) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth();
    if (typeof firebase.functions === 'function') {
      functions = firebase.functions();
    }

    // Listen for auth state changes
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        try {
          // Force refresh token result to inspect latest custom claims
          // STRICT: Admin and Super Admin authorization is determined SOLELY by cryptographically
          // signed Firebase Custom Claims. A Firestore /roles document by itself never elevates privileges.
          const tokenResult = await user.getIdTokenResult(true);
          const claims = tokenResult.claims || {};
          const isAdmin = claims.admin === true;
          const isSuperAdmin = claims.admin === true && claims.superAdmin === true && claims.role === 'superadmin';
          const role = claims.role || (isAdmin ? (isSuperAdmin ? 'superadmin' : 'admin') : 'user');

          _isAdminUser = isAdmin;
          _isSuperAdminUser = isSuperAdmin;
          _adminRole = role;
        } catch (e) {
          _isAdminUser = false;
          _isSuperAdminUser = false;
          _adminRole = 'user';
        }
        console.log("Auth UID:", user.uid, "| Admin:", _isAdminUser, "| SuperAdmin:", _isSuperAdminUser, "| Anon:", user.isAnonymous);
        _notifyAdminStateCallbacks();
      } else {
        currentUser = null;
        _isAdminUser = false;
        _isSuperAdminUser = false;
        _adminRole = 'user';
        _notifyAdminStateCallbacks();
        // Auto sign-in anonymously for browsing visitors
        auth.signInAnonymously().catch((err) => {
          console.error("Firebase Anonymous Auth error:", err);
        });
      }
    });
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
}

function getCurrentUserId() {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY && typeof getSupabaseUserId === 'function') {
    return getSupabaseUserId();
  }
  if (currentUser) return currentUser.uid;
  if (auth && auth.currentUser) return auth.currentUser.uid;
  // Fallback for edge cases during auth initialization
  let localUid = localStorage.getItem('vu_local_device_uid');
  if (!localUid) {
    localUid = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('vu_local_device_uid', localUid);
  }
  return localUid;
}

/**
 * Get current user's Auth token for privileged backend requests
 */
async function getCurrentUserToken() {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY && supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? session.access_token : null;
  }
  if (auth && auth.currentUser) {
    return await auth.currentUser.getIdToken(true);
  }
  return null;
}

/* ---------- Admin Authentication API ---------- */

/**
 * Sign in as administrator using Email/Password auth.
 * Dispatches to Supabase or Firebase based on active backend.
 */
async function signInAdmin(email, password) {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY && typeof signInSupabaseAdmin === 'function') {
    return await signInSupabaseAdmin(email, password);
  }
  if (!auth) throw new Error("Firebase Auth is not initialized. Check your Firebase configuration.");
  const credential = await auth.signInWithEmailAndPassword(email, password);
  
  // Force token refresh to fetch latest verified custom claims
  const tokenResult = await credential.user.getIdTokenResult(true);
  const claims = tokenResult.claims || {};
  const isAdmin = claims.admin === true;
  const isSuperAdmin = claims.admin === true && claims.superAdmin === true && claims.role === 'superadmin';
  const role = claims.role || (isAdmin ? (isSuperAdmin ? 'superadmin' : 'admin') : 'user');

  if (!isAdmin) {
    await auth.signOut();
    throw new Error("🔒 Access Denied: This account does not possess administrator custom claims.");
  }

  currentUser = credential.user;
  _isAdminUser = true;
  _isSuperAdminUser = isSuperAdmin;
  _adminRole = role;
  _notifyAdminStateCallbacks();
  return credential.user;
}

/**
 * Sign out the current admin and revert to anonymous/public state.
 */
async function signOutAdmin() {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY && typeof signOutSupabaseAdmin === 'function') {
    return await signOutSupabaseAdmin();
  }
  if (!auth) return;
  _isAdminUser = false;
  _isSuperAdminUser = false;
  _adminRole = 'user';
  await auth.signOut();
}

/**
 * Check if the current user has the admin privilege.
 */
function isAdminUser() {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY) {
    return typeof _supabaseAdminUser !== 'undefined' ? _supabaseAdminUser : false;
  }
  return _isAdminUser;
}

/**
 * Check if the current user has the super admin privilege.
 */
function isSuperAdminUser() {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY) {
    return typeof _supabaseSuperAdminUser !== 'undefined' ? _supabaseSuperAdminUser : false;
  }
  return _isSuperAdminUser;
}

/**
 * Get current user role string ('superadmin', 'admin', 'user').
 */
function getAdminRole() {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY) {
    return typeof _supabaseAdminRole !== 'undefined' ? _supabaseAdminRole : 'user';
  }
  return _adminRole;
}

/**
 * Register a callback that fires whenever admin auth state changes.
 * Callback receives (isAdmin, isSuperAdmin, role).
 */
function onAdminStateChanged(callback) {
  if (typeof SUPABASE_READY !== 'undefined' && SUPABASE_READY && typeof onSupabaseAdminStateChanged === 'function') {
    return onSupabaseAdminStateChanged(callback);
  }
  _adminStateCallbacks.push(callback);
  // Fire immediately with current state
  callback(_isAdminUser, _isSuperAdminUser, _adminRole);
}

function _notifyAdminStateCallbacks() {
  _adminStateCallbacks.forEach(cb => {
    try { cb(_isAdminUser, _isSuperAdminUser, _adminRole); } catch(e) { console.error("Admin state callback error:", e); }
  });
}
