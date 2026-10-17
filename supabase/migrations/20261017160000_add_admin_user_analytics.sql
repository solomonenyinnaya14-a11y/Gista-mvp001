create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('page_view','feed_view','gist_create','response_create','reply_create','like','follow','share','save','search','voice_play','profile_view')),
  path text not null default '/',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_path_length check (char_length(path) <= 500),
  constraint analytics_events_metadata_size check (pg_column_size(metadata) <= 4096)
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_user_created_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_path_created_idx on public.analytics_events (path, created_at desc);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to authenticated;
grant usage, select on sequence public.analytics_events_id_seq to authenticated;

drop policy if exists "Users can record their own analytics events" on public.analytics_events;
create policy "Users can record their own analytics events"
on public.analytics_events for insert to authenticated
with check (
  user_id = (select auth.uid())
  and event_name in ('page_view','feed_view','gist_create','response_create','reply_create','like','follow','share','save','search','voice_play','profile_view')
  and char_length(path) <= 500
  and pg_column_size(metadata) <= 4096
);

create or replace function public.get_gista_admin_analytics(days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_days integer := greatest(7, least(coalesce(days, 30), 365));
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.gista_admins a
    where a.user_id = auth.uid() and a.role in ('owner', 'admin')
  ) then
    raise exception 'Not authorised to view Gista analytics' using errcode = '42501';
  end if;

  with activity as (
    select e.user_id, e.created_at from public.analytics_events e
    union all select p.author_id, p.created_at from public.posts p
    union all select r.author_id, r.created_at from public.responses r
    union all select rr.author_id, rr.created_at from public.replies rr
    union all select l.user_id, l.created_at from public.likes l
    union all select f.follower_id, f.created_at from public.follows f
    union all select s.user_id, s.created_at from public.saves s
    union all select sh.user_id, sh.created_at from public.shares sh
  ),
  summary as (
    select
      (select count(*) from auth.users) as total_users,
      (select count(distinct user_id) from activity where (created_at at time zone 'Africa/Lagos')::date = v_today) as dau,
      (select count(distinct user_id) from activity where created_at >= now() - interval '30 days') as mau,
      (select count(distinct user_id) from activity where created_at >= now() - interval '365 days') as yau,
      (select count(*) from auth.users where created_at >= now() - make_interval(days => v_days)) as registrations_period,
      (select count(*) from public.posts where created_at >= now() - make_interval(days => v_days)) as gists_period,
      (select count(*) from public.responses where created_at >= now() - make_interval(days => v_days)) as responses_period,
      (select count(*) from public.replies where created_at >= now() - make_interval(days => v_days)) as replies_period,
      (select count(*) from public.likes where created_at >= now() - make_interval(days => v_days)) as likes_period,
      (select count(*) from public.follows where created_at >= now() - make_interval(days => v_days)) as follows_period,
      (select count(*) from public.saves where created_at >= now() - make_interval(days => v_days)) as saves_period,
      (select count(*) from public.shares where created_at >= now() - make_interval(days => v_days)) as shares_period
  ),
  dates as (
    select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as day
  ),
  trend as (
    select d.day,
      (select count(distinct a.user_id) from activity a where (a.created_at at time zone 'Africa/Lagos')::date = d.day) as active_users,
      (select count(*) from auth.users u where (u.created_at at time zone 'Africa/Lagos')::date = d.day) as registrations,
      (select count(*) from public.posts p where (p.created_at at time zone 'Africa/Lagos')::date = d.day) as gists,
      (select count(*) from public.responses r where (r.created_at at time zone 'Africa/Lagos')::date = d.day) as responses
    from dates d
    order by d.day
  ),
  pages as (
    select e.path, count(*) as views, count(distinct e.user_id) as unique_users
    from public.analytics_events e
    where e.event_name = 'page_view' and e.created_at >= now() - make_interval(days => v_days)
    group by e.path order by views desc, e.path asc limit 10
  ),
  events as (
    select e.event_name, count(*) as total
    from public.analytics_events e
    where e.created_at >= now() - make_interval(days => v_days)
    group by e.event_name order by total desc
  ),
  formats as (
    select p.content_type as format, count(*) as total
    from public.posts p
    where p.created_at >= now() - make_interval(days => v_days)
    group by p.content_type order by total desc
  )
  select jsonb_build_object(
    'period_days', v_days,
    'timezone', 'Africa/Lagos',
    'summary', (select to_jsonb(s) from summary s),
    'trend', coalesce((select jsonb_agg(to_jsonb(t)) from trend t), '[]'::jsonb),
    'top_pages', coalesce((select jsonb_agg(to_jsonb(p)) from pages p), '[]'::jsonb),
    'event_breakdown', coalesce((select jsonb_agg(to_jsonb(e)) from events e), '[]'::jsonb),
    'post_formats', coalesce((select jsonb_agg(to_jsonb(f)) from formats f), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_gista_admin_analytics(integer) from public, anon;
grant execute on function public.get_gista_admin_analytics(integer) to authenticated;
