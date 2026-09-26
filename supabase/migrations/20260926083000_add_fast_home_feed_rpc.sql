create or replace function public.get_fast_home_feed(p_tab text default 'Discover', p_limit integer default 12, p_offset integer default 0)
returns table (
  id uuid,
  body text,
  content_type text,
  media_url text,
  category text,
  status text,
  created_at timestamptz,
  author_id uuid,
  voice_duration_seconds integer,
  display_name text,
  username text,
  avatar_url text,
  likes bigint,
  responses bigint,
  shares bigint,
  saves bigint,
  liked boolean,
  saved boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidate_posts as (
    select p.*
    from public.posts p
    where (select auth.uid()) is not null
      and not exists (
        select 1 from public.blocks b
        where b.blocker_id = (select auth.uid())
          and b.blocked_id = p.author_id
      )
      and not exists (
        select 1 from public.not_interested ni
        where ni.user_id = (select auth.uid())
          and ni.post_id = p.id
      )
      and (
        p_tab <> 'Following'
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = p.author_id
        )
      )
      and (p_tab <> 'Trending' or p.status = 'trending')
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 12), 50))
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  like_counts as (
    select l.post_id, count(*)::bigint as count
    from public.likes l
    join candidate_posts cp on cp.id = l.post_id
    group by l.post_id
  ),
  response_counts as (
    select r.post_id, count(*)::bigint as count
    from public.responses r
    join candidate_posts cp on cp.id = r.post_id
    group by r.post_id
  )
  select
    cp.id,
    cp.body,
    cp.content_type,
    cp.media_url,
    cp.category,
    cp.status,
    cp.created_at,
    cp.author_id,
    cp.voice_duration_seconds,
    pr.display_name,
    pr.username,
    pr.avatar_url,
    coalesce(lc.count, 0)::bigint as likes,
    coalesce(rc.count, 0)::bigint as responses,
    coalesce(pec.share_count, 0)::bigint as shares,
    coalesce(pec.save_count, 0)::bigint as saves,
    exists (
      select 1 from public.likes ul
      where ul.post_id = cp.id and ul.user_id = (select auth.uid())
    ) as liked,
    exists (
      select 1 from public.saves us
      where us.post_id = cp.id and us.user_id = (select auth.uid())
    ) as saved
  from candidate_posts cp
  left join public.profiles pr on pr.id = cp.author_id
  left join like_counts lc on lc.post_id = cp.id
  left join response_counts rc on rc.post_id = cp.id
  left join public.post_engagement_counts pec on pec.post_id = cp.id
  order by cp.created_at desc;
$$;

revoke all on function public.get_fast_home_feed(text, integer, integer) from public;
revoke all on function public.get_fast_home_feed(text, integer, integer) from anon;
grant execute on function public.get_fast_home_feed(text, integer, integer) to authenticated;
