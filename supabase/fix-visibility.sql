-- Run ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- 1) Make everything already uploaded visible to every visitor
UPDATE public.resources SET status = 'Approved' WHERE status = 'Pending';

-- 2) Let new uploads from signed-in/guest visitors appear immediately
DROP POLICY IF EXISTS "resources_insert_student" ON public.resources;
CREATE POLICY "resources_insert_student" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid())::text AND status IN ('Pending','Approved'));
