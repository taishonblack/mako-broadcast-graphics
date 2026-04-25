-- 1. Restrict SECURITY DEFINER ownership helper functions to authenticated users only
REVOKE EXECUTE ON FUNCTION public.project_owned_by_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.poll_owned_by_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_owned_by_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.poll_owned_by_user(uuid) TO authenticated;

-- 2. Drop overly permissive public SELECT policy on backgrounds storage bucket.
-- The user-scoped policy "Users can view their own backgrounds bucket objects" remains.
DROP POLICY IF EXISTS "Background images are publicly viewable" ON storage.objects;