/* =========================================================
   VU NOTES — Secure Privileged Backend API
   Victoria University Uganda Student Resource Platform
   
   PURPOSE:
   Executes privileged administrator operations using the
   Firebase Admin SDK. Strictly isolated from client-side code.
   ========================================================= */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: true }));
app.use(express.json());

/* ---------- Initialize Firebase Admin SDK ---------- */
let adminInitialized = false;

try {
  let credential = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccountObj = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccountObj);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const keyPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(keyPath)) {
      const serviceAccount = require(keyPath);
      credential = admin.credential.cert(serviceAccount);
    }
  }

  if (credential) {
    admin.initializeApp({ credential });
    adminInitialized = true;
    console.log('✅ Firebase Admin SDK successfully initialized.');
  } else {
    // Default Google Cloud environment / App Engine fallback
    try {
      admin.initializeApp();
      adminInitialized = true;
      console.log('✅ Firebase Admin SDK initialized with default application credentials.');
    } catch (e) {
      console.warn('⚠️ Firebase Admin SDK not initialized: Service account credentials not provided in .env');
    }
  }
} catch (err) {
  console.error('❌ Error initializing Firebase Admin SDK:', err.message);
}

const db = adminInitialized ? admin.firestore() : null;
const auth = adminInitialized ? admin.auth() : null;

/* ---------- Authentication & Authorization Middleware ---------- */
async function authenticateAdmin(req, res, next) {
  if (!adminInitialized) {
    return res.status(503).json({ error: 'Firebase Admin SDK is not initialized on the server.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token.' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // STRICT: Authorization relies SOLELY on verified cryptographic custom claims.
    // A Firestore /roles document by itself NEVER grants administrative access.
    const isAdmin = decodedToken.admin === true;
    const isSuperAdmin = (decodedToken.admin === true) && (decodedToken.superAdmin === true) && (decodedToken.role === 'superadmin');

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Access Denied: You do not possess verified administrator custom claims.'
      });
    }

    decodedToken.admin = isAdmin;
    decodedToken.superAdmin = isSuperAdmin;
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.', details: err.message });
  }
}

/* ---------- Public Health Check ---------- */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'VU Notes Privileged Backend',
    firebaseAdminReady: adminInitialized,
    timestamp: new Date().toISOString()
  });
});

/* ---------- Super Admin: Get All Administrator Roles ---------- */
app.get('/api/admin/roles', authenticateAdmin, async (req, res) => {
  // STRICT: Only verified Super Admin can view administrator roles
  if (!req.user.superAdmin || req.user.role !== 'superadmin' || req.user.admin !== true) {
    return res.status(403).json({
      error: 'Forbidden: Only verified Super Admins (admin: true, superAdmin: true, role: "superadmin") can view administrator roles.'
    });
  }

  try {
    const rolesSnap = await db.collection('roles').get();
    const roles = rolesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    res.json({
      roles,
      currentUserUid: req.user.uid,
      currentUserRole: 'superadmin',
      isSuperAdmin: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch administrator roles.', details: err.message });
  }
});

/* ---------- Super Admin Endpoint: Set / Revoke Role ---------- */
/* STRICT REQUIREMENT: Only the SUPER ADMIN (admin: true, superAdmin: true, role: 'superadmin') can promote or demote administrators */
app.post('/api/admin/set-role', authenticateAdmin, async (req, res) => {
  // Enforce Super Admin authorization: ordinary admins must NOT be able to promote/revoke administrators
  if (!req.user.superAdmin || req.user.role !== 'superadmin' || req.user.admin !== true) {
    return res.status(403).json({
      error: 'Forbidden: Only verified Super Admins (admin: true, superAdmin: true, role: "superadmin") are authorized to promote or remove administrators.'
    });
  }

  const { targetEmail, targetUid, role = 'admin', action = 'set' } = req.body;

  try {
    let userRecord = null;
    if (targetUid) {
      userRecord = await auth.getUser(targetUid);
    } else if (targetEmail) {
      userRecord = await auth.getUserByEmail(targetEmail);
    } else {
      return res.status(400).json({ error: 'Please provide targetEmail or targetUid.' });
    }

    // Handle removal of admin role
    if (action === 'remove' || role === 'user') {
      const normalUserClaims = {
        admin: false,
        superAdmin: false,
        role: 'user'
      };

      await auth.setCustomUserClaims(userRecord.uid, normalUserClaims);

      await db.collection('roles').doc(userRecord.uid).set({
        email: userRecord.email,
        role: 'user',
        admin: false,
        superAdmin: false,
        revokedBy: req.user.email || req.user.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.json({
        success: true,
        message: `Administrator privileges successfully revoked for ${userRecord.email}.`,
        claims: normalUserClaims
      });
    }

    // Promote to Admin (or Super Admin)
    const isTargetSuperAdmin = (role === 'superadmin');
    const newClaims = {
      admin: true,
      superAdmin: isTargetSuperAdmin,
      role: isTargetSuperAdmin ? 'superadmin' : 'admin'
    };

    await auth.setCustomUserClaims(userRecord.uid, newClaims);

    // Persist in Firestore roles collection for audit and rule reference
    await db.collection('roles').doc(userRecord.uid).set({
      email: userRecord.email,
      role: newClaims.role,
      admin: true,
      superAdmin: newClaims.superAdmin,
      grantedBy: req.user.email || req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `Role "${newClaims.role}" successfully assigned to user ${userRecord.email} (${userRecord.uid}).`,
      claims: newClaims
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign role.', details: err.message });
  }
});

/* ---------- Admin Endpoint: Moderate Resource ---------- */
app.post('/api/admin/moderate-resource', authenticateAdmin, async (req, res) => {
  const { resourceId, action, rejectionReason = '' } = req.body;

  if (!resourceId || !['APPROVE', 'REJECT', 'FLAG'].includes(action)) {
    return res.status(400).json({ error: 'Invalid resourceId or action (APPROVE, REJECT, FLAG).' });
  }

  try {
    const statusMap = {
      APPROVE: 'Approved',
      REJECT: 'Rejected',
      FLAG: 'Flagged'
    };

    const newStatus = statusMap[action];

    await db.collection('resources').doc(resourceId).update({
      status: newStatus,
      moderatedBy: req.user.email || req.user.uid,
      moderationNotes: rejectionReason,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      resourceId,
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Moderation action failed.', details: err.message });
  }
});

/* ---------- Admin Endpoint: Verify Booking Payment ---------- */
app.post('/api/admin/verify-payment', authenticateAdmin, async (req, res) => {
  const { bookingDocId, paymentStatus, transactionRef = '' } = req.body;

  if (!bookingDocId || !['Payment Confirmed', 'Payment Failed', 'Disputed'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'Invalid bookingDocId or paymentStatus.' });
  }

  try {
    await db.collection('bookings').doc(bookingDocId).update({
      paymentStatus: paymentStatus,
      transactionRef: transactionRef,
      paymentVerifiedBy: req.user.email || req.user.uid,
      paymentVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      bookingDocId,
      paymentStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Payment verification failed.', details: err.message });
  }
});

/* ---------- Admin Endpoint: Genuine System Statistics ---------- */
app.get('/api/admin/system-stats', authenticateAdmin, async (req, res) => {
  try {
    const [tutorsSnap, bookingsSnap, resourcesSnap, reviewsSnap] = await Promise.all([
      db.collection('tutors').get(),
      db.collection('bookings').get(),
      db.collection('resources').get(),
      db.collection('reviews').get()
    ]);

    const bookings = bookingsSnap.docs.map(d => d.data());
    const totalFees = bookings.reduce((sum, b) => sum + (Number(b.feeAmount) || 0), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + (Number(b.commissionAmount) || 0), 0);
    const confirmedPayments = bookings
      .filter(b => b.paymentStatus === 'Payment Confirmed')
      .reduce((sum, b) => sum + (Number(b.feeAmount) || 0), 0);

    res.json({
      totalTutors: tutorsSnap.size,
      totalBookings: bookingsSnap.size,
      totalResources: resourcesSnap.size,
      totalReviews: reviewsSnap.size,
      totalFeesGenerated: totalFees,
      totalCommissionEarned: totalCommission,
      confirmedPayments: confirmedPayments,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to aggregate statistics.', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 VU Notes Backend running on port ${PORT}`);
});
