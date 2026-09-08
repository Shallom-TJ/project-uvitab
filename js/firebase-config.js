/* =========================================================
   VU NOTES — Centralized Firebase Configuration & Authentication
   ========================================================= */

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// Guard check for Firebase SDK availability and credentials
const FIREBASE_READY = typeof firebase !== 'undefined' &&
  typeof firebaseConfig !== 'undefined' &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith('PASTE_');

let db = null;
let storage = null;
let auth = null;
let currentUser = null;

if (FIREBASE_READY) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth();

    // Sign in anonymously for secure device UID ownership tracking
    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        console.log("Authenticated with Firebase UID:", user.uid);
      } else {
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
  if (currentUser) return currentUser.uid;
  if (auth && auth.currentUser) return auth.currentUser.uid;
  let localUid = localStorage.getItem('vu_local_device_uid');
  if (!localUid) {
    localUid = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('vu_local_device_uid', localUid);
  }
  return localUid;
}
