# VU Notes — Setup & Supabase Backend Deployment Guide

Victoria University Notes (**VU NOTES**) is a real-time, responsive student academic resource platform built with standard HTML5, CSS3, vanilla JavaScript, and backed completely by **Supabase** (PostgreSQL database, Supabase Auth, Supabase Storage, Realtime subscriptions, and Row Level Security).

---

## 🚀 Live Backend Credentials

The client-side connection is already pre-configured in [js/supabase-config.js](file:///Users/praise/Desktop/NOTES..VU/js/supabase-config.js):

- **Supabase Project URL**: `https://wnxzqewpjanebtniadmj.supabase.co`
- **Publishable Key (`anon`)**: Pre-configured in `js/supabase-config.js`
- **Frontend Architecture**: Zero dependencies required; standard ES6 JavaScript interacting directly and securely with Supabase REST and Storage APIs via `@supabase/supabase-js`.

> [!NOTE]
> The `anon` key is public by design and safe for frontend client code. All database tables and file storage buckets are strictly protected by PostgreSQL Row Level Security (RLS) policies. Privileged operations are restricted to verified administrators.

---

## 📋 One-Time Supabase Dashboard Setup

To complete backend initialization for your Supabase project:

### Step 1: Run the Database Schema & Storage Setup
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard/project/wnxzqewpjanebtniadmj).
2. In the left sidebar, click **SQL Editor** → **New query**.
3. Open [supabase/schema.sql](file:///Users/praise/Desktop/NOTES..VU/supabase/schema.sql) (or [supabase-schema.sql](file:///Users/praise/Desktop/NOTES..VU/supabase-schema.sql)) from this repository, copy its entire contents, paste it into the editor, and click **Run**.
4. This script executes idempotently and automatically provisions:
   - **9 PostgreSQL Database Tables**:
     - `profiles`: User accounts, administrator and superadmin role assignments
     - `courses`: Academic courses and programs catalogue
     - `resources`: Academic notes, past papers, lecture slides, syllabus documents
     - `tutors`: Peer tutor directory and contact details
     - `bookings`: Student session bookings, payment references, and earnings calculations
     - `reviews`: Student star ratings and verified feedback
     - `notifications`: Real-time administrative activity feed
     - `settings`: Platform configuration (default 10% commission rate)
     - `meta`: Seed execution tracker
   - **Row Level Security (RLS)**: Enforces public access rules, restricts file deletion and moderation to administrators, and ensures student private data is protected.
   - **Realtime Subscriptions**: Enables instant multi-device live updates across all interactive tables.
   - **Storage Buckets**: Idempotently registers `resources` (150 MB file limit) and `tutor-photos` (10 MB image limit) with public read permissions.
   - **Database Triggers**: Automatically syncs newly registered authentication users into `public.profiles`.

---

### Step 2: Enable Email Authentication & Create Your Administrator Account
1. In your Supabase Dashboard, go to **Authentication** → **Providers** → **Email**:
   - Ensure the **Email** provider is toggled **ON**.
   - Ensure **Confirm email** is set according to your preference (for instant admin login during school demonstrations, you can turn off "Confirm email").
2. Go to **Authentication** → **Users** → click **Add user** → **Create user**:
   - Enter your administrator email (e.g. `admin@vu.ac.ug`).
   - Enter a secure password.
3. In **SQL Editor**, run the following query to promote this account to Super Administrator:
   ```sql
   UPDATE public.profiles
   SET role = 'superadmin'
   WHERE email = 'admin@vu.ac.ug';
   ```
4. You can now open `admin.html` and sign in through the verified Administrator Authentication Gate!

---

## 💻 Running the Website Locally

Since VU Notes is built with modern vanilla HTML, CSS, and JavaScript, no build step or node package compilation is required:

### Option A: Using Python (macOS built-in)
```bash
cd "/Users/praise/Desktop/NOTES..VU"
python3 -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your web browser.

### Option B: Using Node.js / npx
```bash
npx -y serve . -p 8080
```

### Option C: Direct Browser Opening
Double-click `index.html` to open it in Chrome, Safari, or Edge.

---

## 🌐 Website Pages & Capabilities

| Page | Description | Supabase Services Used |
|---|---|---|
| [index.html](file:///Users/praise/Desktop/NOTES..VU/index.html) | Main Landing Page, hero section, statistics, quick search, featured notes | Supabase Client initialization, real-time metrics |
| [notes.html](file:///Users/praise/Desktop/NOTES..VU/notes.html) | Academic resource repository with category tabs, search, faculty & course filters, and file upload modal | `resources` table, Supabase Storage (`resources` bucket), Realtime sync |
| [tutors.html](file:///Users/praise/Desktop/NOTES..VU/tutors.html) | Peer tutor directory, tutor registration form with photo upload, tutor booking modal, and personal student workspace | `tutors`, `bookings`, `reviews` tables, Supabase Storage (`tutor-photos` bucket) |
| [admin.html](file:///Users/praise/Desktop/NOTES..VU/admin.html) | Restricted Administrator Governance Portal with resource moderation queue, booking verification, tutor management, platform settings, and superadmin role delegations | Supabase Auth (`signInWithPassword`), `profiles` role check, RLS administrative actions |

---

## 🚢 Deploying to Production

You can deploy Victoria University Notes to any static hosting provider for free:

### Deploy to GitHub Pages
1. Push your repository to GitHub (`main` branch).
2. Go to repository **Settings** → **Pages**.
3. Under **Branch**, select `main` and `/ (root)`, then click **Save**.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

### Deploy to Vercel
```bash
npx vercel --prod
```

### Deploy to Netlify
```bash
npx netlify deploy --prod --dir=.
```

---

## 🔒 Security Summary

- **No Exposed Secrets**: No Supabase `service_role` key, database master password, or private credentials are in frontend JavaScript.
- **Row Level Security**: Non-admin visitors can only insert pending resources and bookings. Only verified administrators with `role = 'admin'` or `'superadmin'` can approve submissions, update platform settings, or grant admin permissions.
- **Data Persistence**: All student notes, past papers, bookings, and reviews persist in PostgreSQL on Supabase Cloud.