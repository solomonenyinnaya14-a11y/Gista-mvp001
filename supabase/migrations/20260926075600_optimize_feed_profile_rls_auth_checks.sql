-- Optimize auth.uid() evaluation in frequently-read feed/profile RLS policies.
-- Wrapping auth.uid() in a SELECT lets Postgres treat it as an init plan
-- instead of re-evaluating it for every row.

ALTER POLICY "users can create their profile" ON public.profiles WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "users can update their profile" ON public.profiles USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "profiles are readable by allowed viewers" ON public.profiles USING (((select auth.uid()) = id) OR (is_private = false) OR (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = (select auth.uid()) AND f.following_id = profiles.id)));
ALTER POLICY "users can create posts" ON public.posts WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY "users can update own posts" ON public.posts USING ((select auth.uid()) = author_id) WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY "users can delete own posts" ON public.posts USING ((select auth.uid()) = author_id);
ALTER POLICY "posts are readable by allowed viewers" ON public.posts USING (((select auth.uid()) = author_id) OR (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = posts.author_id AND ((p.is_private = false) OR (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = (select auth.uid()) AND f.following_id = posts.author_id))))));
ALTER POLICY "users can like" ON public.likes WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "users can unlike" ON public.likes USING ((select auth.uid()) = user_id);
ALTER POLICY "users can save" ON public.saves WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "users can unsave" ON public.saves USING ((select auth.uid()) = user_id);
ALTER POLICY "saves are private to owner" ON public.saves USING ((select auth.uid()) = user_id);
ALTER POLICY "users can follow" ON public.follows WITH CHECK ((select auth.uid()) = follower_id);
ALTER POLICY "users can unfollow" ON public.follows USING ((select auth.uid()) = follower_id);
ALTER POLICY "users read own blocks" ON public.blocks USING ((select auth.uid()) = blocker_id);
ALTER POLICY "users create own blocks" ON public.blocks WITH CHECK ((select auth.uid()) = blocker_id);
ALTER POLICY "users delete own blocks" ON public.blocks USING ((select auth.uid()) = blocker_id);
ALTER POLICY "Users can add not interested items" ON public.not_interested WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can mark posts not interested" ON public.not_interested WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can remove not interested items" ON public.not_interested USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can remove not interested marks" ON public.not_interested USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can view their not interested items" ON public.not_interested USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can view their not interested posts" ON public.not_interested USING ((select auth.uid()) = user_id);
ALTER POLICY "users can mark own notifications read" ON public.notifications USING ((select auth.uid()) = recipient_id) WITH CHECK ((select auth.uid()) = recipient_id);
ALTER POLICY "users can read own notifications" ON public.notifications USING ((select auth.uid()) = recipient_id);
ALTER POLICY "users can create responses" ON public.responses WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY "users can delete own responses" ON public.responses USING ((select auth.uid()) = author_id);
ALTER POLICY "users can update own responses" ON public.responses USING ((select auth.uid()) = author_id) WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY "responses are readable by allowed viewers" ON public.responses USING ((EXISTS (SELECT 1 FROM public.posts p JOIN public.profiles pr ON pr.id = p.author_id WHERE p.id = responses.post_id AND ((p.author_id = (select auth.uid())) OR (pr.is_private = false) OR (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = (select auth.uid()) AND f.following_id = p.author_id))))));
