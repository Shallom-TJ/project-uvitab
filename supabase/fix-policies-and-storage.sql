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

-- Confirmation output
SELECT 
  'SUCCESS: Storage buckets and RLS policies have been fully updated for VU Notes.' AS result;
