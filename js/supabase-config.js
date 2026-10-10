/* =========================================================
   VU NOTES — Supabase Configuration & Authentication
   Victoria University Uganda Student Resource Hub

   INSTRUCTIONS:
   1. Paste your Supabase Anon (public) key below.
      Find it at: Supabase Dashboard → Project Settings → API → Project API Keys → anon public
   2. NEVER place your service_role (secret) key here.
   ========================================================= */

var SUPABASE_URL = 'https://wnxzqewpjanebtniadmj.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndueHpxZXdwamFuZWJ0bmlhZG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1ODk2MjEsImV4cCI6MjEwNzE2NTYyMX0.EW8uDnHd2UeoNTVivNW2nU3O8zTuMXy1HzQKIdomkXU';

// Guard: Supabase SDK loaded AND real credentials pasted
var SUPABASE_READY = typeof supabase !== 'undefined' &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.startsWith('PASTE_');

var supabaseClient = null;
var _supabaseAdminUser = false;
var _supabaseSuperAdminUser = false;
var _supabaseAdminRole = 'user';
var _supabaseAdminCallbacks = [];
var _supabaseCurrentUser = null;

if (SUPABASE_READY) {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('✅ Supabase client initialized for project:', SUPABASE_URL);

    // Check initial user role on page load
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      _supabaseCurrentUser = session ? session.user : null;
      _checkSupabaseRole(_supabaseCurrentUser);
    }).catch(err => {
      console.warn('Supabase getSession note:', err);
    });

    // Listen to Supabase Auth state changes
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      _supabaseCurrentUser = session ? session.user : null;
      await _checkSupabaseRole(_supabaseCurrentUser);
    });
  } catch (err) {
    console.error('❌ Supabase initialization failed:', err);
    SUPABASE_READY = false;
  }
}

/**
 * Check if the user has an admin/superadmin role in the profiles table.
 */
async function _checkSupabaseRole(user) {
  if (!user || !supabaseClient) {
    _supabaseAdminUser = false;
    _supabaseSuperAdminUser = false;
    _supabaseAdminRole = 'user';
    _notifySupabaseAdminCallbacks();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Profile role lookup error:', error.message);
    }

    const role = (data && data.role) ? data.role : 'user';
    _supabaseAdminUser = role === 'admin' || role === 'superadmin';
    _supabaseSuperAdminUser = role === 'superadmin';
    _supabaseAdminRole = role;

    console.log('Supabase Auth UID:', user.id, '| Role:', role, '| Admin:', _supabaseAdminUser, '| SuperAdmin:', _supabaseSuperAdminUser);
  } catch (e) {
    _supabaseAdminUser = false;
    _supabaseSuperAdminUser = false;
    _supabaseAdminRole = 'user';
  }

  _notifySupabaseAdminCallbacks();
}

function _notifySupabaseAdminCallbacks() {
  _supabaseAdminCallbacks.forEach(cb => {
    try {
      cb(_supabaseAdminUser, _supabaseSuperAdminUser, _supabaseAdminRole);
    } catch (e) {
      console.error('Supabase admin callback error:', e);
    }
  });
}

/**
 * Helper to get active user ID (Supabase Auth UID or persistent local UID)
 */
function getSupabaseUserId() {
  if (_supabaseCurrentUser && _supabaseCurrentUser.id) {
    return _supabaseCurrentUser.id;
  }
  let localUid = localStorage.getItem('vu_local_device_uid');
  if (!localUid) {
    localUid = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('vu_local_device_uid', localUid);
  }
  return localUid;
}

/**
 * Sign in admin via Supabase Email/Password
 */
async function signInSupabaseAdmin(email, password) {
  if (!SUPABASE_READY || !supabaseClient) {
    throw new Error('Supabase is not configured. Please paste your Supabase Anon Key in js/supabase-config.js.');
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });

  if (error) {
    throw new Error(error.message || 'Authentication failed. Please check your email and password.');
  }

  const user = data.user;
  _supabaseCurrentUser = user;

  // Verify that the user has admin role in profiles table
  const { data: profile, error: pErr } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile && profile.role) ? profile.role : 'user';
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    _supabaseCurrentUser = null;
    _supabaseAdminUser = false;
    _supabaseSuperAdminUser = false;
    _supabaseAdminRole = 'user';
    _notifySupabaseAdminCallbacks();
    throw new Error('🔒 Access Denied: This account does not possess administrator privileges.');
  }

  _supabaseAdminUser = true;
  _supabaseSuperAdminUser = (role === 'superadmin');
  _supabaseAdminRole = role;
  _notifySupabaseAdminCallbacks();
  return user;
}

/**
 * Sign out Supabase admin
 */
async function signOutSupabaseAdmin() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  _supabaseCurrentUser = null;
  _supabaseAdminUser = false;
  _supabaseSuperAdminUser = false;
  _supabaseAdminRole = 'user';
  _notifySupabaseAdminCallbacks();
}

/**
 * Register admin state listener for Supabase
 */
function onSupabaseAdminStateChanged(callback) {
  _supabaseAdminCallbacks.push(callback);
  callback(_supabaseAdminUser, _supabaseSuperAdminUser, _supabaseAdminRole);
}
