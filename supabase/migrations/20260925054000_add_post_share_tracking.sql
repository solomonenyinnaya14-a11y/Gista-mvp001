create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists shares_post_id_idx on public.shares(post_id);
create index if not exists shares_user_id_idx on public.shares(user_id);

alter table public.shares enable row level security;

create policy "users can record shares"
on public.shares
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.get_post_engagement_counts(post_ids uuid[])
returns table(post_id uuid, share_count bigint, save_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as post_id,
    (select count(*) from public.shares s where s.post_id = p.id) as share_count,
    (select count(*) from public.saves s where s.post_id = p.id) as save_count
  from public.posts p
  where p.id = any(post_ids)
$$;

revoke execute on function public.get_post_engagement_counts(uuid[]) from public, anon;
grant execute on function public.get_post_engagement_counts(uuid[]) to authenticated;
grant insert on table public.shares to authenticated;
