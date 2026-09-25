create or replace function public.get_profile_stats(target_profile_id uuid)
returns table(gists bigint, followers bigint, following bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.posts where author_id = target_profile_id),
    (select count(*) from public.follows where following_id = target_profile_id),
    (select count(*) from public.follows where follower_id = target_profile_id);
$$;

create or replace function public.get_profile_followers(target_profile_id uuid)
returns table(id uuid, username text, display_name text, avatar_url text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.following_id = target_profile_id
    and (
      exists (
        select 1 from public.profiles target
        where target.id = target_profile_id and target.is_private = false
      )
      or target_profile_id = (select auth.uid())
      or exists (
        select 1 from public.follows viewer_follow
        where viewer_follow.follower_id = (select auth.uid())
          and viewer_follow.following_id = target_profile_id
      )
    )
  order by f.created_at desc;
$$;

create or replace function public.get_profile_following(target_profile_id uuid)
returns table(id uuid, username text, display_name text, avatar_url text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.follows f
  join public.profiles p on p.id = f.following_id
  join public.profiles target on target.id = target_profile_id
  where f.follower_id = target_profile_id
    and (
      target_profile_id = (select auth.uid())
      or (target.following_private = false and (
        target.is_private = false
        or exists (
          select 1 from public.follows viewer_follow
          where viewer_follow.follower_id = (select auth.uid())
            and viewer_follow.following_id = target_profile_id
        )
      ))
    )
  order by f.created_at desc;
$$;
