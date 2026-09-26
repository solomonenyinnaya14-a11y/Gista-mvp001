-- Reduce latency for profile, Gist detail, notification, and response flows.
-- These indexes cover foreign-key lookups used by RLS, joins, and relationship queries.

create index if not exists not_interested_post_id_idx on public.not_interested (post_id);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists notifications_post_id_idx on public.notifications (post_id);
create index if not exists notifications_response_id_idx on public.notifications (response_id);
create index if not exists replies_author_id_idx on public.replies (author_id);
create index if not exists reports_post_id_idx on public.reports (post_id);
create index if not exists reports_reply_id_idx on public.reports (reply_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_response_id_idx on public.reports (response_id);
create index if not exists response_saves_response_id_idx on public.response_saves (response_id);
create index if not exists responses_author_id_idx on public.responses (author_id);
create index if not exists saves_post_id_idx on public.saves (post_id);

-- Avoid re-evaluating auth.uid() once per row in frequently-used response/report policies.
alter policy "replies are readable by allowed viewers" on public.replies
  using ((exists (
    select 1
    from public.responses r
    join public.posts p on p.id = r.post_id
    join public.profiles pr on pr.id = p.author_id
    where r.id = replies.response_id
      and (
        p.author_id = (select auth.uid())
        or pr.is_private = false
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = p.author_id
        )
      )
  )));

alter policy "users can create replies" on public.replies
  with check ((select auth.uid()) = author_id);
alter policy "users can delete own replies" on public.replies
  using ((select auth.uid()) = author_id);
alter policy "users can update own replies" on public.replies
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

alter policy "users create reports" on public.reports
  with check ((select auth.uid()) = reporter_id);
alter policy "users read own reports" on public.reports
  using ((select auth.uid()) = reporter_id);

alter policy "Users can save responses" on public.response_saves
  with check ((select auth.uid()) = user_id);
alter policy "Users can unsave responses" on public.response_saves
  using ((select auth.uid()) = user_id);
alter policy "Users can view own response saves" on public.response_saves
  using ((select auth.uid()) = user_id);
