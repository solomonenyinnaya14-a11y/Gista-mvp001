-- Add an admin-only post removal path while keeping reports and related discussion records for audit.
alter table public.posts
  add column if not exists moderation_status text not null default 'visible';
alter table public.posts drop constraint if exists posts_moderation_status_check;
alter table public.posts add constraint posts_moderation_status_check
  check (moderation_status in ('visible', 'removed'));

drop policy if exists "posts are readable by allowed viewers" on public.posts;
create policy "posts are readable by allowed viewers"
  on public.posts for select to public
  using (
    (
      moderation_status = 'visible'
      and (
        (select auth.uid()) = author_id
        or exists (
          select 1 from public.profiles p
          where p.id = posts.author_id
            and (
              p.is_private = false
              or exists (
                select 1 from public.follows f
                where f.follower_id = (select auth.uid())
                  and f.following_id = posts.author_id
              )
            )
        )
      )
    )
    or (select private.is_gista_admin())
  );

drop policy if exists "Gista admins can moderate posts" on public.posts;
create policy "Gista admins can moderate posts"
  on public.posts for update to authenticated
  using ((select private.is_gista_admin()))
  with check ((select private.is_gista_admin()));

drop policy if exists "responses are readable by allowed viewers" on public.responses;
create policy "responses are readable by allowed viewers"
  on public.responses for select to public
  using (
    exists (
      select 1
      from public.posts p
      join public.profiles pr on pr.id = p.author_id
      where p.id = responses.post_id
        and p.moderation_status = 'visible'
        and (
          p.author_id = (select auth.uid())
          or pr.is_private = false
          or exists (
            select 1 from public.follows f
            where f.follower_id = (select auth.uid())
              and f.following_id = p.author_id
          )
        )
    )
    or (select private.is_gista_admin())
  );

drop policy if exists "replies are readable by allowed viewers" on public.replies;
create policy "replies are readable by allowed viewers"
  on public.replies for select to public
  using (
    exists (
      select 1
      from public.responses r
      join public.posts p on p.id = r.post_id
      join public.profiles pr on pr.id = p.author_id
      where r.id = replies.response_id
        and p.moderation_status = 'visible'
        and (
          p.author_id = (select auth.uid())
          or pr.is_private = false
          or exists (
            select 1 from public.follows f
            where f.follower_id = (select auth.uid())
              and f.following_id = p.author_id
          )
        )
    )
    or (select private.is_gista_admin())
  );

grant select, update on public.posts to authenticated;
