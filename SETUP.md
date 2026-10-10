# VU Notes — Setup & Backend Connection Guide

VU Notes is a **real-time, cross-device shared student resource platform** for Victoria University Uganda. It supports both **Supabase** (recommended: PostgreSQL, Storage, Auth, Realtime, Row Level Security) and **Firebase**, with an automatic local fallback mode for offline preview.

---

## ⚡ Quick Supabase Setup (Recommended)

### Step 1: Run the Database Schema & Storage Setup
1. Open your [Supabase Dashboard](https://supabase.com/dashboard/project/wnxzqewpjanebtniadmj).
2. In the left navigation, open **SQL Editor** → **New query**.
3. Open the [supabase-schema.sql](file:///Users/praise/Desktop/NOTES..VU/supabase-schema.sql) file from this repository, copy its entire contents, paste it into the query editor, and click **Run**.
4. This one-click SQL script automatically creates:
   - All 9 PostgreSQL database tables (`profiles`, `courses`, `resources`, `tutors`, `bookings`, `reviews`, `notifications`, `settings`, `meta`)
   - Complete Row Level Security (RLS) policies matching strict permissions
   - Realtime publication on all key tables
   - Public storage buckets (`resources` for notes/documents and `tutor-photos` for tutor avatars)
   - Pre-seeded course catalog and platform settings (10% default commission)
   - Database trigger for automatic user profile creation

### Step 2: Configure Public Credentials
1. In your Supabase Dashboard, go to **Project Settings (⚙️ icon) → API**.
2. Copy the **Project URL** and **`anon` `public` key**.
3. Open [js/supabase-config.js](file:///Users/praise/Desktop/NOTES..VU/js/supabase-config.js) and paste the Anon key:
   ```javascript
   var SUPABASE_URL = 'https://wnxzqewpjanebtniadmj.supabase.co';
   var SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';
   ```
   > [!NOTE]
   > The `anon` key is public and safe to use in frontend JavaScript. All database access and uploads are protected by Row Level Security (RLS) policies. **NEVER** expose the `service_role` (secret) key in frontend code.

### Step 3: Enable Email Authentication & Create Admin User
1. In your Supabase Dashboard, navigate to **Authentication → Providers → Email** and ensure Email/Password provider is enabled.
2. In **Authentication → Users**, click **Add user** → **Create user** (e.g. `admin@vunotes.ac.ug`).
3. In **Table Editor → profiles**, find the newly created user's row and change `role` from `'user'` to `'admin'` or `'superadmin'`.
4. You can now log into `admin.html` with that administrator email and password!

---

## Architecture Overview: Frontend vs. Backend Separation

```
[ BROWSER CLIENT (Public) ]
  ├── index.html, notes.html, tutors.html, admin.html
  ├── js/firebase-config.js (Public Web Config: apiKey, projectId, etc.)
  ├── js/app.js, js/ai-monitor.js, js/admin-auth.js
  └── Direct secure reads/writes governed strictly by Firestore & Storage Security Rules

[ NODE.JS BACKEND (Private & Privileged) ]
  ├── server/server.js (Express API with Firebase Admin SDK)
  ├── server/.env (NEVER committed to Git — holds private credentials)
  └── Performs privileged role assignment, resource moderation & payment verification
```

---

## 1. Firebase Project Setup
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create or select your project.
2. In **Build → Authentication → Sign-in method**:
   - Enable **Email/Password** (for administrator login).
   - Enable **Anonymous** (for zero-friction student visitor session tracking).
3. In **Build → Firestore Database**:
   - Create your database.
   - Go to the **Rules** tab and paste the contents of [firestore.rules](file:///Users/praise/Desktop/NOTES..VU/firestore.rules). Click **Publish**.
4. In **Build → Storage**:
   - Enable Cloud Storage.
   - Go to the **Rules** tab and paste the contents of [storage.rules](file:///Users/praise/Desktop/NOTES..VU/storage.rules). Click **Publish**.

---

## 2. Frontend Configuration (Public Web Client)
1. On your Firebase project dashboard, click the **Web (`</>`)** icon to register your web application.
2. Copy the web config object into [js/firebase-config.js](file:///Users/praise/Desktop/NOTES..VU/js/firebase-config.js):
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   *(Note: These public web keys are safe in frontend code because all reads and writes are strictly enforced by Firestore and Storage security rules).*

---

## 3. Backend Environment Variables & Credentials Setup (Private)

All privileged secrets (service account private keys, admin API tokens) **MUST NEVER** be placed in frontend code or committed to GitHub.

### Step 3.1: Obtain Firebase Service Account Credentials
1. In Firebase Console, go to **Project Settings (⚙️ icon) → Service accounts**.
2. Under "Firebase Admin SDK", click **Generate new private key**.
3. A JSON file will download.

### Step 3.2: Configure `server/.env`
1. Navigate to the `server/` directory:
   ```bash
   cd server
   cp .env.example .env
   ```
2. Open `server/.env` in your editor and configure your credentials using **either** of these methods:

#### Method A: Direct Environment Variables (Recommended for Production & Cloud Hosts)
Open your downloaded JSON key file and copy the values into `server/.env`:
```env
PORT=5001
NODE_ENV=development

FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

ADMIN_EMAIL="admin@vunotes.ac.ug"
```

#### Method B: Local File Reference (Convenient for Local Machine Development)
Move the downloaded JSON file into `server/serviceAccountKey.json` and configure `server/.env`:
```env
PORT=5001
NODE_ENV=development

FIREBASE_SERVICE_ACCOUNT_PATH="./serviceAccountKey.json"
ADMIN_EMAIL="admin@vunotes.ac.ug"
```

> [!IMPORTANT]
> The project `.gitignore` already protects `.env`, `server/.env`, `*serviceAccountKey*.json`, `*.pem`, and all credential files from ever being tracked or committed to Git.

### Step 3.3: Install Backend Dependencies & Start Server
```bash
cd server
npm install
npm start
```
The server will start on port `5001` and log:
```
✅ Firebase Admin SDK successfully initialized.
🚀 VU Notes Backend running on port 5001
```

---

## 4. Granting Admin Access to Your Account
To log into `admin.html`, your account must have the `{ admin: true, role: 'admin' }` custom claim.

1. Create your administrator account in **Firebase Console → Authentication → Users → Add user** (e.g. `admin@vunotes.ac.ug`).
2. Run the included claim assignment script from the project root:
   ```bash
   node scripts/set-admin-claim.js admin@vunotes.ac.ug
   ```
   *(The script automatically reads credentials from `server/.env` or you can pass `./server/serviceAccountKey.json` as the first argument).*
3. The script sets the Firebase Custom User Claim and creates a verified record in `/roles/{uid}`.

---

## 5. Summary of Environment Variables

| Variable Name | Required? | Description | Where It Belongs |
|---|---|---|---|
| `PORT` | Optional | Port for the backend API (Default: `5001`) | `server/.env` |
| `NODE_ENV` | Optional | `development` or `production` | `server/.env` |
| `FIREBASE_PROJECT_ID` | Yes (Method A) | Project ID from Firebase Console | `server/.env` (Server only) |
| `FIREBASE_CLIENT_EMAIL` | Yes (Method A) | Client email from Service Account JSON | `server/.env` (Server only) |
| `FIREBASE_PRIVATE_KEY` | Yes (Method A) | RSA Private Key from Service Account JSON | `server/.env` (Server only) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes (Method B) | Local path to JSON key file (e.g. `./serviceAccountKey.json`) | `server/.env` (Server only) |
| `ADMIN_EMAIL` | Optional | Default administrator email address | `server/.env` |

---

## 6. AI Backend Service (Firebase Cloud Functions + Google Genkit)

VU Notes integrates a secure serverless AI backend powered by **Google Genkit** and **Firebase Cloud Functions (2nd Gen)** for academic chat assistance, concept explanations, and curriculum support.

### Architecture & Security
- **Cloud Function**: `chatWithAI` callable function in `functions/index.js`.
- **Server-Side Secret**: The Gemini API key is stored strictly inside **Google Cloud Secret Manager** via Firebase Secrets. It is NEVER exposed to client browsers or stored in Git.
- **Client SDK**: Frontend interacts via `AIService.sendMessage(message, context)` in `js/ai-service.js`, which uses `firebase.functions().httpsCallable('chatWithAI')` to automatically include verified user authentication.

### Step 6.1: Configure Firebase Secret
Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey) and set it securely in Firebase:
```bash
firebase functions:secrets:set GEMINI_API_KEY
```
*(When prompted, paste your Gemini API key).*

### Step 6.2: Install Functions Dependencies
```bash
cd functions
npm install
cd ..
```

### Step 6.3: Deploy AI Cloud Functions
```bash
firebase deploy --only functions
```