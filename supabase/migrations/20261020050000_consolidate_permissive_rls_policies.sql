-- Consolidate equivalent permissive policies without changing who can access rows.
-- Preserve public-profile/feed reads and author-owned post updates, while retaining
-- the administrator override through the existing private authorization helper.

DROP POLICY IF EXISTS "Gista admins can moderate posts" ON public.posts;
DROP POLICY IF EXISTS "users can update own posts" ON public.posts;
CREATE POLICY "authors and admins can update posts"
ON public.posts
FOR UPDATE
TO public
USING ((SELECT auth.uid()) = author_id OR (SELECT private.is_gista_admin()))
WITH CHECK ((SELECT auth.uid()) = author_id OR (SELECT private.is_gista_admin()));

DROP POLICY IF EXISTS "Gista admins can view profiles for moderation" ON public.profiles;
DROP POLICY IF EXISTS "profiles are readable by allowed viewers" ON public.profiles;
CREATE POLICY "profiles are readable by allowed viewers"
ON public.profiles
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) = id
  OR is_private = false
  OR EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = (SELECT auth.uid())
      AND f.following_id = profiles.id
  )
  OR (SELECT private.is_gista_admin())
);

DROP POLICY IF EXISTS "Gista admins can view reports" ON public.reports;
DROP POLICY IF EXISTS "users read own reports" ON public.reports;
CREATE POLICY "users and admins can view reports"
ON public.reports
FOR SELECT
TO public
USING (
  (SELECT auth.uid()) = reporter_id
  OR (SELECT private.is_gista_admin())
);
