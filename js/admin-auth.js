/* =========================================================
   VU NOTES — Admin Authentication Gate
   Provides login UI and guards admin.html behind Supabase
   Email/Password authentication with verified profile role.
   ========================================================= */

const AdminAuthGate = (() => {
  let _dashboardContainer = null;
  let _loginContainer = null;
  let _onAuthenticatedCallback = null;

  /**
   * Initialize the admin authentication gate.
   * Call this on admin.html DOMContentLoaded.
   * @param {Object} options
   * @param {HTMLElement} options.dashboardEl - The main dashboard container to show/hide
   * @param {Function} options.onAuthenticated - Callback fired when admin auth succeeds
   */
  function init(options = {}) {
    _dashboardContainer = options.dashboardEl;
    _onAuthenticatedCallback = options.onAuthenticated;

    // Hide dashboard by default
    if (_dashboardContainer) {
      _dashboardContainer.style.display = 'none';
    }

    // Create login overlay
    _createLoginUI();

    // Listen for admin auth state changes
    if (typeof onAdminStateChanged === 'function') {
      onAdminStateChanged((isAdmin, isSuperAdmin, role) => {
        if (isAdmin) {
          _showDashboard();
        } else {
          if (typeof _supabaseCurrentUser !== 'undefined' && _supabaseCurrentUser && _supabaseCurrentUser.email) {
            _showAccessDenied(_supabaseCurrentUser.email);
          } else {
            _showLogin();
          }
        }
      });
    } else {
      // Supabase not ready
      _showLogin();
    }
  }

  function _createLoginUI() {
    _loginContainer = document.createElement('div');
    _loginContainer.id = 'adminLoginGate';
    _loginContainer.innerHTML = `
      <div class="admin-login-backdrop">
        <div class="admin-login-card">
          <div class="admin-login-header">
            <div class="admin-login-icon">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 id="adminAuthTitle">🛡️ Administrator Portal</h1>
            <p class="admin-login-sub" id="adminAuthSub">Victoria University Uganda &bull; Governance Portal</p>
            <p class="admin-login-desc" id="adminAuthDesc">Sign in with your verified administrator credentials to access platform governance, moderation, and financial audits.</p>
          </div>

          <form id="adminLoginForm" class="admin-login-form" autocomplete="on">
            <div class="admin-field">
              <label for="adminEmail">Administrator Email</label>
              <input type="email" id="adminEmail" name="email" required placeholder="admin@vu.ac.ug" autocomplete="email">
            </div>
            <div class="admin-field">
              <label for="adminPassword">Password</label>
              <input type="password" id="adminPassword" name="password" required placeholder="Enter administrator password" autocomplete="current-password">
            </div>
            <div class="admin-login-error" id="adminLoginError" style="display:none; text-align:left; line-height:1.5;"></div>
            <button type="submit" class="admin-login-btn" id="adminLoginBtn">
              <span class="admin-login-btn-text">Sign In to Dashboard</span>
              <span class="admin-login-btn-loading" style="display:none;">Verifying Administrator Claims…</span>
            </button>
            <div style="text-align:center; margin-top:6px;">
              <a href="index.html" class="admin-back-link">← Return to Homepage</a>
            </div>
          </form>

          <div id="adminDeniedContainer" style="display:none; text-align:center;">
            <div id="adminDeniedMessage" style="font-size:14px; color:#cbd5e1; line-height:1.6; margin-bottom:20px;"></div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button type="button" id="adminSwitchAccountBtn" class="admin-toggle-login-btn">
                🔑 Sign In with Another Account
              </button>
              <a href="index.html" class="admin-home-btn">
                ← Return to Homepage
              </a>
            </div>
          </div>

          <div class="admin-login-footer">
            <div style="font-size:11.5px; color:#64748B; margin-top:8px;">
              Victoria University Uganda &bull; Verified Governance Portal
            </div>
          </div>
        </div>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .admin-login-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: linear-gradient(
          135deg,
          rgba(9, 10, 15, 0.97) 0%,
          rgba(14, 18, 28, 0.95) 50%,
          rgba(9, 10, 15, 0.97) 100%
        );
        backdrop-filter: blur(30px);
      }

      .admin-login-card {
        width: 100%;
        max-width: 440px;
        background: rgba(18, 22, 32, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 22px;
        padding: 44px 36px 36px;
        box-shadow:
          0 24px 80px rgba(0, 0, 0, 0.7),
          0 0 1px rgba(255, 255, 255, 0.15),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(24px);
        animation: adminCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes adminCardIn {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .admin-login-header {
        text-align: center;
        margin-bottom: 32px;
      }

      .admin-login-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(230, 57, 70, 0.2), rgba(78, 143, 209, 0.2));
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #ff7b88;
        margin-bottom: 20px;
      }

      .admin-login-header h1 {
        font-family: "Fraunces", "Georgia", serif;
        font-size: 26px;
        font-weight: 700;
        color: #ffffff;
        margin: 0 0 6px;
        letter-spacing: -0.02em;
      }

      .admin-login-sub {
        font-family: "IBM Plex Mono", monospace;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #7dd3fc;
        margin: 0 0 14px;
        font-weight: 600;
      }

      .admin-login-desc {
        font-size: 14px;
        color: #94A3B8;
        line-height: 1.5;
        margin: 0;
        max-width: 38ch;
        margin-left: auto;
        margin-right: auto;
      }

      .admin-login-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .admin-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .admin-field label {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: 0.02em;
      }

      .admin-field input {
        width: 100%;
        padding: 13px 16px;
        font-family: "Inter", sans-serif;
        font-size: 15px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(9, 10, 15, 0.6);
        color: #ffffff;
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .admin-field input:focus {
        border-color: #4E8FD1;
        box-shadow: 0 0 0 3px rgba(78, 143, 209, 0.25);
      }

      .admin-field input::placeholder {
        color: #475569;
      }

      .admin-login-error {
        background: rgba(230, 57, 70, 0.12);
        border: 1px solid rgba(230, 57, 70, 0.35);
        border-radius: 10px;
        padding: 12px 16px;
        font-size: 13.5px;
        color: #ff7b88;
        font-weight: 600;
        text-align: center;
        animation: shakeError 0.4s ease;
      }

      @keyframes shakeError {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
      }

      .admin-login-btn {
        width: 100%;
        padding: 14px 24px;
        font-family: "Inter", sans-serif;
        font-size: 15px;
        font-weight: 700;
        color: #ffffff;
        background: linear-gradient(135deg, #E63946 0%, #C81E2C 100%);
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 4px 16px rgba(230, 57, 70, 0.35);
        margin-top: 6px;
      }

      .admin-login-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(230, 57, 70, 0.45);
        background: linear-gradient(135deg, #ff4d5d 0%, #E63946 100%);
      }

      .admin-login-btn:active {
        transform: translateY(0);
      }

      .admin-login-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .admin-home-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 13px 20px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 12px;
        color: #ffffff;
        font-weight: 700;
        font-size: 14.5px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .admin-home-btn:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
        text-decoration: none;
        transform: translateY(-1px);
      }

      .admin-toggle-login-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 13px 20px;
        background: linear-gradient(135deg, #E63946 0%, #C81E2C 100%);
        border: none;
        border-radius: 12px;
        color: #ffffff;
        font-weight: 700;
        font-size: 14.5px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 16px rgba(230, 57, 70, 0.35);
      }

      .admin-toggle-login-btn:hover {
        background: linear-gradient(135deg, #ff4d5d 0%, #E63946 100%);
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(230, 57, 70, 0.45);
      }

      .admin-login-footer {
        text-align: center;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .admin-back-link {
        font-size: 13.5px;
        color: #94A3B8;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s ease;
      }

      .admin-back-link:hover {
        color: #7dd3fc;
        text-decoration: none;
      }

      /* Sign-out button style for the dashboard header */
      .admin-signout-btn {
        background: rgba(230, 57, 70, 0.15);
        border: 1px solid rgba(230, 57, 70, 0.35);
        color: #ff7b88;
        padding: 8px 16px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .admin-signout-btn:hover {
        background: #E63946;
        color: #ffffff;
        border-color: #E63946;
      }

      @media (max-width: 480px) {
        .admin-login-card {
          padding: 32px 24px 28px;
        }
        .admin-login-header h1 {
          font-size: 22px;
        }
      }
    `;
    document.head.appendChild(style);

    // Insert at beginning of body
    document.body.prepend(_loginContainer);

    // Wire switch account button
    const switchBtn = document.getElementById('adminSwitchAccountBtn');
    if (switchBtn) {
      switchBtn.addEventListener('click', async () => {
        switchBtn.disabled = true;
        switchBtn.textContent = 'Signing out…';
        try {
          if (typeof signOutAdmin === 'function') {
            await signOutAdmin();
          }
        } catch (e) {
          console.warn('Sign out note:', e);
        } finally {
          switchBtn.disabled = false;
          switchBtn.textContent = '🔑 Sign In with Another Account';
          _showLogin();
        }
      });
    }

    // Form submit handler
    const form = document.getElementById('adminLoginForm');
    if (form) {
      form.addEventListener('submit', _handleLogin);
    }
  }

  async function _handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');
    const btn = document.getElementById('adminLoginBtn');
    const btnText = btn.querySelector('.admin-login-btn-text');
    const btnLoading = btn.querySelector('.admin-login-btn-loading');

    // Reset error
    errorEl.style.display = 'none';
    errorEl.innerHTML = '';

    // Show loading
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    try {
      if (!SUPABASE_READY) {
        throw new Error("Supabase is not configured. Please paste your Supabase Anon Key in js/supabase-config.js.");
      }
      await signInAdmin(email, password);
      // Success — onAdminStateChanged will handle showing the dashboard
    } catch (err) {
      let msg = err.message || 'Authentication failed. Please verify your email and password.';
      errorEl.innerHTML = msg.replace(/\n/g, '<br>');
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
    }
  }

  function _showDashboard() {
    if (_loginContainer) {
      _loginContainer.style.display = 'none';
    }
    if (_dashboardContainer) {
      _dashboardContainer.style.display = 'block';
    }
    if (_onAuthenticatedCallback) {
      _onAuthenticatedCallback();
    }
  }

  function _showAccessDenied(email) {
    if (_dashboardContainer) {
      _dashboardContainer.style.display = 'none';
    }
    if (_loginContainer) {
      _loginContainer.style.display = 'block';
      const title = document.getElementById('adminAuthTitle');
      const sub = document.getElementById('adminAuthSub');
      const desc = document.getElementById('adminAuthDesc');
      const form = document.getElementById('adminLoginForm');
      const denied = document.getElementById('adminDeniedContainer');
      const deniedMsg = document.getElementById('adminDeniedMessage');

      if (title) title.textContent = '🔒 Access Denied';
      if (sub) sub.textContent = 'Unauthorized Account';
      if (desc) desc.textContent = 'This account does not have platform administrator privileges.';
      if (form) form.style.display = 'none';
      if (denied) denied.style.display = 'block';
      if (deniedMsg) {
        deniedMsg.innerHTML = `You are authenticated as <strong style="color:#ffffff;">${email}</strong>.<br><br>This account is not designated as an administrator in the Supabase database. Please sign in with an authorized administrator account or assign the <code>superadmin</code> role in the Supabase SQL Editor.`;
      }
    }
  }

  function _showLogin() {
    if (_dashboardContainer) {
      _dashboardContainer.style.display = 'none';
    }
    if (_loginContainer) {
      _loginContainer.style.display = 'block';
      const title = document.getElementById('adminAuthTitle');
      const sub = document.getElementById('adminAuthSub');
      const desc = document.getElementById('adminAuthDesc');
      const form = document.getElementById('adminLoginForm');
      const denied = document.getElementById('adminDeniedContainer');
      const errorEl = document.getElementById('adminLoginError');

      if (title) title.textContent = '🛡️ Administrator Portal';
      if (sub) sub.textContent = 'Victoria University Uganda • Governance Portal';
      if (desc) desc.textContent = 'Sign in with your verified administrator credentials to access platform governance, moderation, and financial audits.';
      if (form) form.style.display = 'flex';
      if (denied) denied.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.innerHTML = '';
      }
    }
  }

  /**
   * Create a sign-out button and append it to the given container.
   */
  function createSignOutButton(container) {
    const btn = document.createElement('button');
    btn.className = 'admin-signout-btn';
    btn.innerHTML = '🔒 Sign Out';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Signing out…';
      try {
        await signOutAdmin();
      } catch (e) {
        console.error("Sign out error:", e);
      }
    });
    container.appendChild(btn);
    return btn;
  }

  return { init, createSignOutButton };
})();
