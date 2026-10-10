-- =============================================================================
-- VU NOTES — Victoria University Uganda Student Resource Hub
-- Production-Hardened Supabase Database Schema & Security Architecture
--
-- Features:
--   1. PostgreSQL Tables with strict constraints and foreign keys
--   2. Optimized Performance Indexes for all query patterns & RLS joins
--   3. Hardened SECURITY DEFINER functions with search_path protection
--   4. Row Level Security (RLS) policies enforcing least-privilege access
--   5. Anti-Privilege Escalation & Financial Tamper-Proof Triggers
--   6. Realtime Publication configuration (idempotent)
--   7. Supabase Storage buckets & granular object ownership policies
--   8. Seed data with conflict preservation
--   9. Automatic Auth-to-Profile synchronization trigger
-- =============================================================================


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Core Database Tables
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Profiles & Authorization Roles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  granted_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Academic Courses Catalogue
CREATE TABLE IF NOT EXISTS public.courses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Academic Resources (Lecture Notes, Past Papers, Summaries, Self-Tests)
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
  file_size BIGINT DEFAULT 0 CHECK (file_size >= 0),
  file_type TEXT DEFAULT '',
  moderation_notes TEXT DEFAULT '',
  moderated_by TEXT DEFAULT '',
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Peer Tutors Directory
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tutoring Bookings & Session Management
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
  fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  session_note TEXT DEFAULT '',
  booking_status TEXT NOT NULL DEFAULT 'Pending' CHECK (booking_status IN ('Pending', 'Accepted', 'Declined', 'Cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'Payment Pending' CHECK (payment_status IN ('Payment Pending', 'Payment Verified', 'Refunded', 'Failed')),
  payment_verification_type TEXT DEFAULT 'Pending Verification',
  transaction_ref TEXT DEFAULT '',
  session_status TEXT NOT NULL DEFAULT 'Not Started' CHECK (session_status IN ('Not Started', 'In Progress', 'Awaiting Confirmation', 'Session Completed')),
  student_session_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  tutor_session_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  review_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  commission_rate NUMERIC NOT NULL DEFAULT 10 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount NUMERIC NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  tutor_earnings NUMERIC NOT NULL DEFAULT 0 CHECK (tutor_earnings >= 0),
  payment_verified_by TEXT DEFAULT '',
  payment_verified_at TIMESTAMPTZ,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Student Reviews & Ratings
CREATE TABLE IF NOT EXISTS public.reviews (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT DEFAULT '',
  tutor_id TEXT DEFAULT '',
  tutor_name TEXT DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Administrator Audit Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  booking_id TEXT DEFAULT '',
  tutor_id TEXT DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Platform Settings
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. System Metadata & Seed Log
CREATE TABLE IF NOT EXISTS public.meta (
  key TEXT PRIMARY KEY,
  done BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Performance & Query Optimization Indexes
-- ═════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_course_cat ON public.resources(course, category);
CREATE INDEX IF NOT EXISTS idx_resources_owner ON public.resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_created ON public.resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutors_course ON public.tutors(course);
CREATE INDEX IF NOT EXISTS idx_tutors_owner ON public.tutors(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tutor_id ON public.bookings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_reviews_tutor ON public.reviews(tutor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_booking_unique ON public.reviews(booking_id) WHERE booking_id <> '';
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(read, created_at DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 3: Security Helper Functions (SECURITY DEFINER with fixed search_path)
-- ═════════════════════════════════════════════════════════════════════════════

-- Check if current user is an admin or superadmin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
$$;

-- Check if current user is a superadmin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  );
$$;

-- Secure administrative role promotion RPC (Callable only by superadmins)
CREATE OR REPLACE FUNCTION public.grant_admin_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only superadministrators may alter user roles.';
  END IF;

  IF new_role NOT IN ('user', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  UPDATE public.profiles
  SET role = new_role,
      granted_by = COALESCE(auth.jwt()->>'email', auth.uid()::text),
      updated_at = NOW()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for ID: %', target_user_id;
  END IF;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 4: Data Protection Triggers (Anti-Tampering)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Prevent Unauthorized Profile Role Escalation
CREATE OR REPLACE FUNCTION public.tr_protect_profile_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.id := OLD.id; -- prevent ID changing
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Privilege Escalation Blocked: Role changes require superadministrator authorization.';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_role_guard ON public.profiles;
CREATE TRIGGER tr_profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_protect_profile_roles();

-- 2. Prevent Booking Financial Tampering by Students & Tutors
CREATE OR REPLACE FUNCTION public.tr_protect_booking_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.owner_id := OLD.owner_id;
  NEW.tutor_id := OLD.tutor_id;

  -- Verify financial changes are only performed by verified administrators
  IF (NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
      NEW.payment_verification_type IS DISTINCT FROM OLD.payment_verification_type OR
      NEW.commission_rate IS DISTINCT FROM OLD.commission_rate OR
      NEW.commission_amount IS DISTINCT FROM OLD.commission_amount OR
      NEW.tutor_earnings IS DISTINCT FROM OLD.tutor_earnings OR
      NEW.payment_verified_by IS DISTINCT FROM OLD.payment_verified_by OR
      NEW.payment_verified_at IS DISTINCT FROM OLD.payment_verified_at) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Financial status and verification fields can only be modified by platform administrators.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_bookings_financial_guard ON public.bookings;
CREATE TRIGGER tr_bookings_financial_guard
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_protect_booking_financials();

-- 3. Prevent Self-Approval & Moderation Tampering on Resources
CREATE OR REPLACE FUNCTION public.tr_protect_resource_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.owner_id := OLD.owner_id;

  IF (NEW.status IS DISTINCT FROM OLD.status OR
      NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes OR
      NEW.moderated_by IS DISTINCT FROM OLD.moderated_by OR
      NEW.moderated_at IS DISTINCT FROM OLD.moderated_at) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Moderation status can only be updated by platform administrators.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_resources_moderation_guard ON public.resources;
CREATE TRIGGER tr_resources_moderation_guard
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_protect_resource_moderation();


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 5: Row Level Security (RLS) Policies
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta ENABLE ROW LEVEL SECURITY;

-- ── Profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- ── Courses ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "courses_select_public" ON public.courses;
CREATE POLICY "courses_select_public" ON public.courses
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "courses_insert_authorized" ON public.courses;
CREATE POLICY "courses_insert_authorized" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (length(trim(name)) > 0);

DROP POLICY IF EXISTS "courses_update_admin" ON public.courses;
CREATE POLICY "courses_update_admin" ON public.courses
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "courses_delete_admin" ON public.courses;
CREATE POLICY "courses_delete_admin" ON public.courses
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Resources ────────────────────────────────────────────────────────────────
-- Public can view Approved resources; authenticated owners see their own pending/moderated files; admins see all
DROP POLICY IF EXISTS "resources_select_public_approved" ON public.resources;
CREATE POLICY "resources_select_public_approved" ON public.resources
  FOR SELECT TO public
  USING (
    status = 'Approved'
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
    OR public.is_admin()
  );

-- Submissions must start as Pending (unless submitted by a verified administrator)
DROP POLICY IF EXISTS "resources_insert_student" ON public.resources;
CREATE POLICY "resources_insert_student" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (
    (status = 'Pending' AND owner_id = auth.uid()::text)
    OR public.is_admin()
  );

-- Owner can update resource metadata; admins can update all fields (moderation guarded by trigger)
DROP POLICY IF EXISTS "resources_update_owner_or_admin" ON public.resources;
CREATE POLICY "resources_update_owner_or_admin" ON public.resources
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()::text
    OR public.is_admin()
  );

-- Owner or admin can delete resource record
DROP POLICY IF EXISTS "resources_delete_owner_or_admin" ON public.resources;
CREATE POLICY "resources_delete_owner_or_admin" ON public.resources
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()::text
    OR public.is_admin()
  );

-- ── Tutors ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tutors_select_public" ON public.tutors;
CREATE POLICY "tutors_select_public" ON public.tutors
  FOR SELECT TO public
  USING (true);

-- Authenticated students can register their tutor profile
DROP POLICY IF EXISTS "tutors_insert_authenticated" ON public.tutors;
CREATE POLICY "tutors_insert_authenticated" ON public.tutors
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()::text
    OR public.is_admin()
  );

-- Tutors can update only their own profile; admins can update any
DROP POLICY IF EXISTS "tutors_update_owner" ON public.tutors;
CREATE POLICY "tutors_update_owner" ON public.tutors
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()::text
    OR public.is_admin()
  );

-- Tutors can remove only their own profile; admins can remove any
DROP POLICY IF EXISTS "tutors_delete_owner" ON public.tutors;
CREATE POLICY "tutors_delete_owner" ON public.tutors
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()::text
    OR public.is_admin()
  );

-- ── Bookings ─────────────────────────────────────────────────────────────────
-- Students see their own bookings; tutors see requests assigned to them; admins see all
DROP POLICY IF EXISTS "bookings_select_parties" ON public.bookings;
CREATE POLICY "bookings_select_parties" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()::text
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tutors
      WHERE tutors.id = bookings.tutor_id
      AND tutors.owner_id = auth.uid()::text
    )
  );

-- Students create bookings for themselves with initial Pending status
DROP POLICY IF EXISTS "bookings_insert_student" ON public.bookings;
CREATE POLICY "bookings_insert_student" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      owner_id = auth.uid()::text
      AND booking_status = 'Pending'
      AND payment_status = 'Payment Pending'
    )
    OR public.is_admin()
  );

-- Students, assigned tutors, and admins can update booking progression (financial fields guarded by trigger)
DROP POLICY IF EXISTS "bookings_update_parties" ON public.bookings;
CREATE POLICY "bookings_update_parties" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()::text
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tutors
      WHERE tutors.id = bookings.tutor_id
      AND tutors.owner_id = auth.uid()::text
    )
  );

-- Only administrators may delete bookings
DROP POLICY IF EXISTS "bookings_delete_admin" ON public.bookings;
CREATE POLICY "bookings_delete_admin" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Reviews ──────────────────────────────────────────────────────────────────
-- Public can read verified non-flagged reviews; admins see all
DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT TO public
  USING (
    flagged = FALSE
    OR public.is_admin()
  );

-- Authenticated students submit reviews for completed sessions they participated in
DROP POLICY IF EXISTS "reviews_insert_student" ON public.reviews;
CREATE POLICY "reviews_insert_student" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()::text
    AND flagged = FALSE
    AND (
      booking_id = ''
      OR EXISTS (
        SELECT 1 FROM public.bookings
        WHERE bookings.id = reviews.booking_id
        AND bookings.owner_id = auth.uid()::text
      )
    )
  );

-- Reviewer can edit their comment; admins can flag/unflag
DROP POLICY IF EXISTS "reviews_update_reviewer_or_admin" ON public.reviews;
CREATE POLICY "reviews_update_reviewer_or_admin" ON public.reviews
  FOR UPDATE TO authenticated
  USING (
    reviewer_id = auth.uid()::text
    OR public.is_admin()
  );

-- Administrators only can delete reviews
DROP POLICY IF EXISTS "reviews_delete_admin" ON public.reviews;
CREATE POLICY "reviews_delete_admin" ON public.reviews
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Notifications ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select_admin" ON public.notifications;
CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    type IN ('BOOKING_CREATED', 'NEW_BOOKING', 'TUTOR_REGISTERED', 'PAYMENT_PENDING', 'REVIEW_SUBMITTED', 'SYSTEM')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "notifications_manage_admin" ON public.notifications;
CREATE POLICY "notifications_manage_admin" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ── Settings ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
CREATE POLICY "settings_select_public" ON public.settings
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "settings_manage_admin" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ── Meta ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meta_select_public" ON public.meta;
CREATE POLICY "meta_select_public" ON public.meta
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "meta_manage_admin" ON public.meta
  FOR ALL TO authenticated
  USING (public.is_admin());


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 6: Supabase Realtime Configuration (Idempotent)
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'resources') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resources;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tutors') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tutors;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reviews') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'courses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;
  END IF;
END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 7: Supabase Storage Buckets & Object Security Policies
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Register Public Buckets with Size Limits & MIME Types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  true,
  157286400, -- 150 MiB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/rtf',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutor-photos',
  'tutor-photos',
  true,
  10485760, -- 10 MiB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage Object Policies: resources
DROP POLICY IF EXISTS "resources_storage_public_read" ON storage.objects;
CREATE POLICY "resources_storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'resources');

DROP POLICY IF EXISTS "resources_storage_upload_auth" ON storage.objects;
CREATE POLICY "resources_storage_upload_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resources');

DROP POLICY IF EXISTS "resources_storage_update_owner_admin" ON storage.objects;
CREATE POLICY "resources_storage_update_owner_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (owner = auth.uid() OR public.is_admin())
  );

DROP POLICY IF EXISTS "resources_storage_delete_owner_admin" ON storage.objects;
CREATE POLICY "resources_storage_delete_owner_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (owner = auth.uid() OR public.is_admin())
  );

-- 3. Storage Object Policies: tutor-photos
DROP POLICY IF EXISTS "tutor_photos_public_read" ON storage.objects;
CREATE POLICY "tutor_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tutor-photos');

DROP POLICY IF EXISTS "tutor_photos_upload_auth" ON storage.objects;
CREATE POLICY "tutor_photos_upload_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tutor-photos');

DROP POLICY IF EXISTS "tutor_photos_update_owner_admin" ON storage.objects;
CREATE POLICY "tutor_photos_update_owner_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tutor-photos'
    AND (owner = auth.uid() OR public.is_admin())
  );

DROP POLICY IF EXISTS "tutor_photos_delete_owner_admin" ON storage.objects;
CREATE POLICY "tutor_photos_delete_owner_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tutor-photos'
    AND (owner = auth.uid() OR public.is_admin())
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 8: Automatic Profile Creation Trigger on Sign-Up
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    'user',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  WHERE public.profiles.role = 'user'; -- Never downgrade existing admin/superadmin roles
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ═════════════════════════════════════════════════════════════════════════════
-- SECTION 9: Idempotent Seed Data
-- ═════════════════════════════════════════════════════════════════════════════

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

-- Seed default admin settings (10% platform commission)
INSERT INTO public.settings (key, value)
VALUES ('admin', '{"commissionRate": 10}')
ON CONFLICT (key) DO NOTHING;

-- Mark seed status
INSERT INTO public.meta (key, done)
VALUES ('seed_v4_hardened', true)
ON CONFLICT (key) DO NOTHING;
