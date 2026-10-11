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
  _syncGlobalCurrentUser();
  if (!user || !supabaseClient) {
    _supabaseAdminUser = false;
    _supabaseSuperAdminUser = false;
    _supabaseAdminRole = 'user';
    _notifySupabaseAdminCallbacks();
    return;
  }

  try {
    let role = null;

    // 1. Try self-healing RPC sync first (ensures missing profiles are provisioned)
    try {
      const { data: syncData, error: syncErr } = await supabaseClient.rpc('sync_current_user_profile');
      if (syncData && syncData.role) {
        role = syncData.role;
      }
    } catch (rpcErr) {
      // RPC may not be present before migration script is run
    }

    // 2. Direct profiles table query
    if (!role) {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('Profile role lookup error:', error.message);
      }
      if (data && data.role) {
        role = data.role;
      }
    }

    // 3. Metadata fallback (app_metadata or user_metadata)
    if (!role) {
      const metaRole = (user.app_metadata && user.app_metadata.role) ||
                       (user.user_metadata && user.user_metadata.role);
      if (metaRole === 'admin' || metaRole === 'superadmin') {
        role = metaRole;
      }
    }

    role = role || 'user';
    _supabaseAdminUser = role === 'admin' || role === 'superadmin';
    _supabaseSuperAdminUser = role === 'superadmin';
    _supabaseAdminRole = role;

    console.log('Supabase Auth UID:', user.id, '| Email:', user.email, '| Role:', role, '| Admin:', _supabaseAdminUser, '| SuperAdmin:', _supabaseSuperAdminUser);
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

  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: cleanEmail,
    password: password
  });

  if (error) {
    const errMsg = (error.message || '').toLowerCase();
    if (errMsg.includes('email not confirmed')) {
      throw new Error('⚠️ Email not confirmed. Please click the confirmation link sent to your inbox, or disable "Confirm email" in Supabase Dashboard → Authentication → Providers → Email.');
    }
    if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid credentials')) {
      throw new Error('❌ Invalid email or password. Please verify the credentials registered in Supabase Dashboard → Authentication → Users.');
    }
    throw new Error(error.message || 'Authentication failed. Please check your email and password.');
  }

  const user = data.user;
  _supabaseCurrentUser = user;
  _syncGlobalCurrentUser();

  // Self-heal and sync profile
  let role = null;
  try {
    const { data: syncData } = await supabaseClient.rpc('sync_current_user_profile');
    if (syncData && syncData.role) {
      role = syncData.role;
    }
  } catch (e) {
    // Ignore RPC missing error
  }

  // Verify that the user has admin role in profiles table
  if (!role) {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && profile.role) {
      role = profile.role;
    }
  }

  // Fallback to metadata
  if (!role) {
    const metaRole = (user.app_metadata && user.app_metadata.role) ||
                     (user.user_metadata && user.user_metadata.role);
    if (metaRole === 'admin' || metaRole === 'superadmin') {
      role = metaRole;
    }
  }

  role = role || 'user';
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    _supabaseCurrentUser = null;
    _supabaseAdminUser = false;
    _supabaseSuperAdminUser = false;
    _supabaseAdminRole = 'user';
    _notifySupabaseAdminCallbacks();
    throw new Error(`🔒 Access Denied: The account "${user.email || cleanEmail}" is authenticated, but does not possess administrator privileges in the database. Please run the SQL role assignment in your Supabase Dashboard SQL Editor.`);
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

/* ---------- Global Canonical Auth API (Universal Interface) ---------- */

var currentUser = null;

function _syncGlobalCurrentUser() {
  if (_supabaseCurrentUser) {
    currentUser = {
      id: _supabaseCurrentUser.id,
      uid: _supabaseCurrentUser.id,
      email: _supabaseCurrentUser.email || '',
      user_metadata: _supabaseCurrentUser.user_metadata || {}
    };
  } else {
    currentUser = null;
  }
}

function getCurrentUserId() {
  return getSupabaseUserId();
}

async function getCurrentUserToken() {
  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? session.access_token : null;
  }
  return null;
}

const signInAdmin = signInSupabaseAdmin;
const signOutAdmin = signOutSupabaseAdmin;
function isAdminUser() { return _supabaseAdminUser; }
function isSuperAdminUser() { return _supabaseSuperAdminUser; }
function getAdminRole() { return _supabaseAdminRole; }
const onAdminStateChanged = onSupabaseAdminStateChanged;

