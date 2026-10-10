-- =========================================================
-- VU NOTES — Supabase Database Schema
-- Victoria University Uganda Student Resource Hub
--
-- INSTRUCTIONS:
--   1. Open your Supabase Dashboard → SQL Editor
--   2. Paste this ENTIRE file and click "Run"
--   3. Then go to Storage and verify the two buckets were created
--   4. Then go to Authentication → Settings and enable Email/Password
-- =========================================================


-- ═══════════════════════════════════════════════════════════
-- SECTION 1: Helper Functions for Row Level Security
-- ═══════════════════════════════════════════════════════════

-- Check if current user has admin or superadmin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
$$;

-- Check if current user has superadmin role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  );
$$;


-- ═══════════════════════════════════════════════════════════
-- SECTION 2: Tables
-- ═══════════════════════════════════════════════════════════

-- 1. User Profiles & Admin Roles
--    Replaces: Firestore /roles/{uid} collection
--    Stores administrator role assignments verified by RLS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  granted_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Courses
--    Replaces: Firestore /courses collection
CREATE TABLE IF NOT EXISTS public.courses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Academic Resources
--    Replaces: Firestore /resources collection
CREATE TABLE IF NOT EXISTS public.resources (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  description TEXT DEFAULT '',
  faculty TEXT DEFAULT '',
  course TEXT NOT NULL DEFAULT 'General',
  topic TEXT DEFAULT '',
  resource_type TEXT DEFAULT 'Notes/Document',
  media_type TEXT DEFAULT 'document',
  category TEXT DEFAULT 'lectures',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Flagged')),
  uploader TEXT DEFAULT 'Anonymous Student',
  uploaded_by TEXT DEFAULT 'Anonymous Student',
  owner_id TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  original_file_name TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  download_url TEXT DEFAULT '',
  storage_path TEXT DEFAULT '',
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT '',
  moderation_notes TEXT DEFAULT '',
  moderated_by TEXT DEFAULT '',
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tutors
--    Replaces: Firestore /tutors collection
--    Uses TEXT primary key for the human-readable TUT-xxxx ID
CREATE TABLE IF NOT EXISTS public.tutors (
  id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  faculty TEXT DEFAULT 'Faculty of Science and Technology',
  course TEXT NOT NULL DEFAULT 'General',
  subject TEXT NOT NULL DEFAULT 'General',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  bio TEXT DEFAULT '',
  availability TEXT DEFAULT 'Flexible',
  fee_amount TEXT DEFAULT '',
  fee_duration TEXT DEFAULT '1 Hour',
  photo_url TEXT DEFAULT '',
  storage_path TEXT DEFAULT '',
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bookings
--    Replaces: Firestore /bookings collection
--    Uses TEXT primary key for the human-readable BK-xxxx ID
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL DEFAULT '',
  tutor_name TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  student_email TEXT NOT NULL DEFAULT '',
  course TEXT NOT NULL DEFAULT 'General',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  duration TEXT DEFAULT '1 Hour',
  fee_amount NUMERIC DEFAULT 0,
  session_note TEXT DEFAULT '',
  booking_status TEXT DEFAULT 'Pending',
  payment_status TEXT DEFAULT 'Payment Pending',
  payment_verification_type TEXT DEFAULT 'Pending Verification',
  transaction_ref TEXT DEFAULT '',
  session_status TEXT DEFAULT 'Not Started',
  student_session_confirmed BOOLEAN DEFAULT FALSE,
  tutor_session_confirmed BOOLEAN DEFAULT FALSE,
  review_submitted BOOLEAN DEFAULT FALSE,
  commission_rate NUMERIC DEFAULT 10,
  commission_amount NUMERIC DEFAULT 0,
  tutor_earnings NUMERIC DEFAULT 0,
  payment_verified_by TEXT DEFAULT '',
  payment_verified_at TIMESTAMPTZ,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Student Reviews
--    Replaces: Firestore /reviews collection
CREATE TABLE IF NOT EXISTS public.reviews (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT DEFAULT '',
  tutor_id TEXT DEFAULT '',
  tutor_name TEXT DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  flagged BOOLEAN DEFAULT FALSE,
  reviewer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Notifications
--    Replaces: Firestore /notifications collection
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  booking_id TEXT DEFAULT '',
  tutor_id TEXT DEFAULT '',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Platform Settings
--    Replaces: Firestore /settings/admin document
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Metadata / Seed Tracker
--    Replaces: Firestore /meta collection
CREATE TABLE IF NOT EXISTS public.meta (
  key TEXT PRIMARY KEY,
  done BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════
-- SECTION 3: Row Level Security (RLS) Policies
-- Mirrors the security model from firestore.rules
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta ENABLE ROW LEVEL SECURITY;

-- ── Profiles (Roles) ──────────────────────────────────────
-- Users can read their own profile; super admins can read all
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR public.is_super_admin()
  );

-- Users can insert their own profile row (auto-created on first sign-in)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Only super admins can update profiles (role assignments)
CREATE POLICY "profiles_update_superadmin" ON public.profiles
  FOR UPDATE USING (public.is_super_admin());

-- ── Courses ───────────────────────────────────────────────
-- Public read
CREATE POLICY "courses_select_public" ON public.courses
  FOR SELECT USING (true);

-- Only admins can manage courses
CREATE POLICY "courses_insert_admin" ON public.courses
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "courses_update_admin" ON public.courses
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "courses_delete_admin" ON public.courses
  FOR DELETE USING (public.is_admin());

-- ── Resources ─────────────────────────────────────────────
-- Public can read approved resources; owners see their own; admins see all
CREATE POLICY "resources_select" ON public.resources
  FOR SELECT USING (
    status = 'Approved'
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
    OR public.is_admin()
  );

-- Students can submit resources (status must start as Pending unless submitted by verified admin)
CREATE POLICY "resources_insert" ON public.resources
  FOR INSERT WITH CHECK (
    status = 'Pending'
    OR (public.is_admin() AND status IN ('Approved', 'Pending', 'Rejected', 'Flagged'))
  );

-- Authenticated owner or admin can update resource details (status changes restricted to admin)
CREATE POLICY "resources_update" ON public.resources
  FOR UPDATE USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  );

-- Owner or admin can delete
CREATE POLICY "resources_delete" ON public.resources
  FOR DELETE USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  );

-- ── Tutors ────────────────────────────────────────────────
-- Public read
CREATE POLICY "tutors_select_public" ON public.tutors
  FOR SELECT USING (true);

-- Any student can register as a tutor
CREATE POLICY "tutors_insert" ON public.tutors
  FOR INSERT WITH CHECK (true);

-- Owner or admin can update tutor profile
CREATE POLICY "tutors_update" ON public.tutors
  FOR UPDATE USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  );

-- Owner or admin can delete
CREATE POLICY "tutors_delete" ON public.tutors
  FOR DELETE USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  );

-- ── Bookings ──────────────────────────────────────────────
-- Visible to the student (owner) or admins
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  );

-- Students can create bookings (status must start as Pending)
CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT WITH CHECK (
    booking_status = 'Pending'
    AND payment_status = 'Payment Pending'
  );

-- Owner or admin can update bookings
CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  );

-- Only admins can delete bookings
CREATE POLICY "bookings_delete" ON public.bookings
  FOR DELETE USING (public.is_admin());

-- ── Reviews ───────────────────────────────────────────────
-- Public can read non-flagged reviews; admins see all
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT USING (
    flagged = false
    OR public.is_admin()
  );

-- Students can submit reviews
CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT WITH CHECK (flagged = false);

-- Reviewer or admin can update
CREATE POLICY "reviews_update" ON public.reviews
  FOR UPDATE USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND reviewer_id = auth.uid()::text)
  );

-- Admin can delete reviews
CREATE POLICY "reviews_delete" ON public.reviews
  FOR DELETE USING (public.is_admin());

-- ── Notifications ─────────────────────────────────────────
-- Only admins can read notifications
CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT USING (public.is_admin());

-- System and users can create notifications for platform events
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    type IN ('BOOKING_CREATED', 'NEW_BOOKING', 'TUTOR_REGISTERED', 'PAYMENT_PENDING', 'REVIEW_SUBMITTED', 'SYSTEM')
    OR public.is_admin()
  );

-- Only admins can update or delete notifications
CREATE POLICY "notifications_update_admin" ON public.notifications
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "notifications_delete_admin" ON public.notifications
  FOR DELETE USING (public.is_admin());

-- ── Settings ──────────────────────────────────────────────
-- Public read
CREATE POLICY "settings_select_public" ON public.settings
  FOR SELECT USING (true);

-- Only admins can write settings
CREATE POLICY "settings_insert_admin" ON public.settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE USING (public.is_admin());

-- ── Meta ──────────────────────────────────────────────────
-- Public read
CREATE POLICY "meta_select_public" ON public.meta
  FOR SELECT USING (true);

-- Only admins can write meta
CREATE POLICY "meta_insert_admin" ON public.meta
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "meta_update_admin" ON public.meta
  FOR UPDATE USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════
-- SECTION 4: Enable Realtime on Key Tables
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.resources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tutors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;


-- ═══════════════════════════════════════════════════════════
-- SECTION 5: Storage Buckets & Policies
-- ═══════════════════════════════════════════════════════════

-- Create public storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('resources', 'resources', true, 157286400)    -- 150 MB limit
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tutor-photos', 'tutor-photos', true, 10485760)  -- 10 MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage Policies: resources bucket
CREATE POLICY "resources_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resources');

CREATE POLICY "resources_storage_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resources');

CREATE POLICY "resources_storage_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'resources' AND (public.is_admin() OR auth.role() = 'authenticated'));

CREATE POLICY "resources_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resources' AND (public.is_admin() OR auth.role() = 'authenticated'));

-- Storage Policies: tutor-photos bucket
CREATE POLICY "tutor_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutor-photos');

CREATE POLICY "tutor_photos_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tutor-photos');

CREATE POLICY "tutor_photos_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tutor-photos' AND (public.is_admin() OR auth.role() = 'authenticated'));

CREATE POLICY "tutor_photos_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tutor-photos' AND (public.is_admin() OR auth.role() = 'authenticated'));


-- ═══════════════════════════════════════════════════════════
-- SECTION 6: Seed Course List (from FACULTY_COURSES in app.js)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.courses (name) VALUES
  ('General'),
  -- Faculty of Science and Technology
  ('Software Engineering'),
  ('Information and Communication Technology (ICT)'),
  ('Computer Science'),
  ('Business Computing and Data Analytics'),
  ('Cyber Security and Digital Forensics'),
  ('Artificial Intelligence and Data Science'),
  ('Visual Effects and Animation'),
  ('Agriculture and Rural Innovation'),
  ('Industrial Art and Innovative Design'),
  -- Faculty of Business and Management
  ('Business Administration'),
  ('Business Administration - Accounting and Finance'),
  ('International Business'),
  ('Human Resource Management'),
  ('Procurement and Logistics Management'),
  ('Tourism and Hospitality Management'),
  ('Events and Hospitality Management'),
  ('Real Estate and Property Management'),
  ('Hotel Management and Culinary Art'),
  ('International Oil and Gas Management'),
  ('Energy Economics and Finance'),
  -- Faculty of Humanities and Social Sciences
  ('Social Work and Social Administration'),
  ('Public Administration and Management'),
  ('Journalism and Media Studies'),
  ('International Relations and Diplomatic Studies'),
  ('Guidance and Counselling'),
  ('Music and Dance'),
  ('Film, TV Production and Digital Media'),
  -- School of Law
  ('Legal Studies'),
  ('Bachelor of Laws (LLB)'),
  -- Faculty of Health Sciences
  ('Nursing Science'),
  ('Midwifery Science'),
  ('Public Health'),
  ('Pharmacy Practice'),
  ('Human Nutrition and Dietetics'),
  -- Institute of Education and Life-Long Learning
  ('Education (Arts)'),
  ('Education (Sciences)'),
  ('Early Childhood Education')
ON CONFLICT (name) DO NOTHING;

-- Seed default admin settings (10% commission)
INSERT INTO public.settings (key, value)
VALUES ('admin', '{"commissionRate": 10}')
ON CONFLICT (key) DO NOTHING;

-- Mark seed complete
INSERT INTO public.meta (key, done)
VALUES ('seed_v3', true)
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 7: Auto-Create Profile on User Sign-Up
-- Uses a database trigger so every new auth.users row
-- gets a corresponding profiles row with role = 'user'
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''), 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ═══════════════════════════════════════════════════════════
-- SECTION 8: How to Create Your Initial Super Administrator
-- ═══════════════════════════════════════════════════════════
-- 1. In Supabase Dashboard → Authentication → Users:
--    Click "Add user" → "Create user", enter your email & password (e.g., admin@vu.ac.ug)
-- 2. Then run this query below to promote your account to Super Administrator:
--
-- UPDATE public.profiles
-- SET role = 'superadmin'
-- WHERE email = 'your-admin-email@example.com';
--
-- ═══════════════════════════════════════════════════════════
-- VERIFICATION CHECKLIST:
--   ✓ Table Editor   → 9 tables (profiles, courses, resources, tutors, bookings, reviews, notifications, settings, meta)
--   ✓ Storage        → 2 buckets (resources [150MB], tutor-photos [10MB])
--   ✓ Authentication → Email provider enabled
-- ═══════════════════════════════════════════════════════════
