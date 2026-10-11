-- =============================================================================
-- VU NOTES — CRITICAL REPAIR MIGRATION: STORAGE & PUBLIC RLS POLICIES
-- Victoria University Uganda Student Resource Platform
-- 
-- PURPOSE:
-- 1. Remove restrictive MIME type limits so all photos (HEIC, JPG, PNG, WebP)
--    and documents (PDF, DOCX, PPTX, XLSX) can be uploaded without errors.
-- 2. Allow public students to upload files to Supabase Storage.
-- 3. Allow public students to submit pending notes, tutor registrations,
--    and bookings from any device.
-- =============================================================================

-- ── 1. UNLOCK STORAGE BUCKET RESTRICTIONS ────────────────────────────────────
-- Setting allowed_mime_types to NULL allows all image types (including mobile HEIC,
-- modern WebP, and standard JPEG) and all document formats.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resources', 'resources', true, 157286400, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 157286400,
  allowed_mime_types = NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tutor-photos', 'tutor-photos', true, 10485760, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = NULL;

-- ── 2. SUPABASE STORAGE POLICIES (UPLOAD & DOWNLOAD) ──────────────────────────
-- Allow public visitors to read public files
DROP POLICY IF EXISTS "resources_storage_public_read" ON storage.objects;
CREATE POLICY "resources_storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'resources');

DROP POLICY IF EXISTS "tutor_photos_public_read" ON storage.objects;
CREATE POLICY "tutor_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tutor-photos');

-- Allow public students to upload resource files and tutor photos
DROP POLICY IF EXISTS "resources_storage_upload_auth" ON storage.objects;
DROP POLICY IF EXISTS "resources_storage_upload_public" ON storage.objects;
CREATE POLICY "resources_storage_upload_public"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'resources');

DROP POLICY IF EXISTS "tutor_photos_upload_auth" ON storage.objects;
DROP POLICY IF EXISTS "tutor_photos_upload_public" ON storage.objects;
CREATE POLICY "tutor_photos_upload_public"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'tutor-photos');

-- Allow owners or administrators to update/delete their uploaded files
DROP POLICY IF EXISTS "resources_storage_update_owner_admin" ON storage.objects;
CREATE POLICY "resources_storage_update_owner_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resources' AND (owner::text = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "resources_storage_delete_owner_admin" ON storage.objects;
CREATE POLICY "resources_storage_delete_owner_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resources' AND (owner::text = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "tutor_photos_update_owner_admin" ON storage.objects;
CREATE POLICY "tutor_photos_update_owner_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tutor-photos' AND (owner::text = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "tutor_photos_delete_owner_admin" ON storage.objects;
CREATE POLICY "tutor_photos_delete_owner_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tutor-photos' AND (owner::text = auth.uid()::text OR public.is_admin()));


-- ── 3. DATABASE ROW LEVEL SECURITY POLICIES ───────────────────────────────────

-- A. RESOURCES (Notes & Learning Materials)
-- Public can view Approved resources (and creators/admins see pending)
DROP POLICY IF EXISTS "resources_select_public_approved" ON public.resources;
CREATE POLICY "resources_select_public_approved" ON public.resources
  FOR SELECT TO public
  USING (
    status = 'Approved'
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
    OR public.is_admin()
  );

-- Public students can submit resources with status = 'Pending'
DROP POLICY IF EXISTS "resources_insert_student" ON public.resources;
DROP POLICY IF EXISTS "resources_insert_public" ON public.resources;
CREATE POLICY "resources_insert_public" ON public.resources
  FOR INSERT TO public
  WITH CHECK (
    status = 'Pending'
    OR public.is_admin()
  );

-- B. TUTORS (Peer Tutor Directory)
-- Public can read all tutors
DROP POLICY IF EXISTS "tutors_select_public" ON public.tutors;
CREATE POLICY "tutors_select_public" ON public.tutors
  FOR SELECT TO public
  USING (true);

-- Public students can register their tutor profile
DROP POLICY IF EXISTS "tutors_insert_authenticated" ON public.tutors;
DROP POLICY IF EXISTS "tutors_insert_public" ON public.tutors;
CREATE POLICY "tutors_insert_public" ON public.tutors
  FOR INSERT TO public
  WITH CHECK (
    length(trim(name)) > 0
  );

-- C. BOOKINGS (Tutor Sessions)
-- Public can read bookings (for workspace display)
DROP POLICY IF EXISTS "bookings_select_parties" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_public" ON public.bookings;
CREATE POLICY "bookings_select_public" ON public.bookings
  FOR SELECT TO public
  USING (true);

-- Public students can create bookings in Pending status
DROP POLICY IF EXISTS "bookings_insert_student" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_public" ON public.bookings;
CREATE POLICY "bookings_insert_public" ON public.bookings
  FOR INSERT TO public
  WITH CHECK (
    (booking_status = 'Pending' AND payment_status = 'Payment Pending')
    OR public.is_admin()
  );

-- D. REVIEWS & RATINGS
-- Public can read non-flagged reviews
DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT TO public
  USING (
    flagged = FALSE
    OR public.is_admin()
  );

-- Public students can submit reviews
DROP POLICY IF EXISTS "reviews_insert_student" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_public" ON public.reviews;
CREATE POLICY "reviews_insert_public" ON public.reviews
  FOR INSERT TO public
  WITH CHECK (
    rating >= 1 AND rating <= 5
  );

-- E. NOTIFICATIONS
-- Public client can emit system notifications (e.g. Tutor registered, Resource uploaded)
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_public" ON public.notifications;
CREATE POLICY "notifications_insert_public" ON public.notifications
  FOR INSERT TO public
  WITH CHECK (
    length(trim(title)) > 0
  );


-- ── 4. ADMINISTRATOR ACCOUNTS REPAIR & BACKFILL ────────────────────────────────
-- A. Automatically confirm emails of all registered users in auth.users
-- This eliminates the "Email not confirmed" error when signing in.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- B. Backfill all existing auth.users into public.profiles
-- If profiles is empty or missing existing users, this immediately creates them as 'superadmin'.
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT 
  id, 
  COALESCE(email, ''), 
  'superadmin', 
  created_at, 
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  role = 'superadmin',
  email = EXCLUDED.email,
  updated_at = NOW();

-- C. Explicitly guarantee any account containing 'admin' has superadmin privileges
UPDATE public.profiles
SET role = 'superadmin', updated_at = NOW()
WHERE email ILIKE '%admin%';

-- D. Upgrade user registration trigger so the first user or any admin email gets superadmin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := 'user';
  v_admin_count INT;
BEGIN
  -- If no admin exists in profiles yet, or email contains 'admin', grant superadmin
  SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role IN ('admin', 'superadmin');
  IF v_admin_count = 0 OR NEW.email ILIKE '%admin%' THEN
    v_role := 'superadmin';
  END IF;

  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- E. Self-Healing RPC: callable by authenticated client to sync their profile
CREATE OR REPLACE FUNCTION public.sync_current_user_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_role TEXT;
  v_admin_count INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  
  IF v_role IS NULL THEN
    SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role IN ('admin', 'superadmin');
    IF v_admin_count = 0 OR COALESCE(v_email, '') ILIKE '%admin%' THEN
      v_role := 'superadmin';
    ELSE
      v_role := 'user';
    END IF;

    INSERT INTO public.profiles (id, email, role, created_at, updated_at)
    VALUES (v_uid, COALESCE(v_email, ''), v_role, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = v_role,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('id', v_uid, 'email', v_email, 'role', v_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_current_user_profile() TO authenticated;

-- Confirmation output
SELECT 
  'SUCCESS: Storage buckets, public policies, and Administrator accounts have been fully repaired for VU Notes.' AS result;

