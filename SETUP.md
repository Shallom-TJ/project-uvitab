# Connecting VU Notes to Firebase (Shared Cloud Mode)

VU Notes works as a **real-time, cross-device shared online student platform**. Everything uploaded or registered (lecture notes, past papers, summaries, self-test questions, and tutor profiles) is stored live in **Firebase Cloud Storage** and **Cloud Firestore**, making it instantly accessible to every student on any device.

---

## 1. Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and sign in with your Google account.
2. Click **Add project**, name it `vu-notes` (or your preferred name), and complete the wizard.

## 2. Register Your Web App & Add Config
1. On the project dashboard, click the **`</>` (Web)** icon.
2. Register your app nickname (e.g. `vu-notes-web`).
3. Copy your six configuration values from the Firebase SDK snippet:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "vu-notes-xxxxx.firebaseapp.com",
     projectId: "vu-notes-xxxxx",
     storageBucket: "vu-notes-xxxxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
4. Open [js/firebase-config.js](file:///Users/praise/Desktop/NOTES..VU/js/firebase-config.js) and paste those 6 values into the `firebaseConfig` object, replacing the `PASTE_...` placeholders.

## 3. Enable Cloud Firestore (Database)
1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database** and start in **Test mode** (or production mode).
3. Select your preferred database location and click **Enable**.

## 4. Enable Firebase Storage (File & Photo Uploads)
1. In the left sidebar, click **Build → Storage**.
2. Click **Get started**, accept the default location, and click **Done**.

## 5. Enable Anonymous Authentication (Ownership & Security)
1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started**, select **Sign-in method**, choose **Anonymous**, and click **Enable**.
3. *Why?* This automatically assigns every student visitor a secure Firebase User ID (`uid`) so they can delete/edit their own uploads and tutor listings without completing registration forms.

## 6. Deploy Security Rules
Copy the rules from the included project files into your Firebase Console:

- **Firestore Rules**: Copy contents of [firestore.rules](file:///Users/praise/Desktop/NOTES..VU/firestore.rules) into **Firestore Database → Rules**.
- **Storage Rules**: Copy contents of [storage.rules](file:///Users/praise/Desktop/NOTES..VU/storage.rules) into **Storage → Rules**.

---

## Deploying to GitHub Pages
1. Push your repository to GitHub.
2. Go to **Settings → Pages** in your GitHub repo and select the `main` branch root (`/`).
3. All asset paths (like background images) use relative path syntax (`./images/hero-bg.png`) with CSS color fallbacks for high performance on GitHub Pages and mobile devices.