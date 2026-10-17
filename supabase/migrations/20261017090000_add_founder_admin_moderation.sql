-- Gista founder/admin moderation foundation.
-- The founder account is explicitly seeded as the sole initial owner.
create schema if not exists private;

create table if not exists public.gista_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.gista_admins (user_id, role)
values ('71e1acee-470a-44d1-9ce5-43f3bb4443f7', 'owner')
on conflict (user_id) do update set role = 'owner';

create or replace function private.is_gista_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gista_admins a
    where a.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_gista_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gista_admins a
    where a.user_id = (select auth.uid()) and a.role = 'owner'
  );
$$;

revoke all on function private.is_gista_admin() from public, anon;
revoke all on function private.is_gista_owner() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_gista_admin() to authenticated;
grant execute on function private.is_gista_owner() to authenticated;

alter table public.gista_admins enable row level security;
drop policy if exists "Gista admins can view admin roster" on public.gista_admins;
create policy "Gista admins can view admin roster"
  on public.gista_admins for select to authenticated
  using ((select private.is_gista_admin()));
drop policy if exists "Only owner can add admins" on public.gista_admins;
create policy "Only owner can add admins"
  on public.gista_admins for insert to authenticated
  with check ((select private.is_gista_owner()) and role = 'admin' and added_by = (select auth.uid()));
drop policy if exists "Only owner can update admins" on public.gista_admins;
create policy "Only owner can update admins"
  on public.gista_admins for update to authenticated
  using ((select private.is_gista_owner()))
  with check ((select private.is_gista_owner()) and role = 'admin');
drop policy if exists "Only owner can remove admins" on public.gista_admins;
create policy "Only owner can remove admins"
  on public.gista_admins for delete to authenticated
  using ((select private.is_gista_owner()) and role = 'admin');

alter table public.reports
  add column if not exists status text not null default 'pending',
  add column if not exists target_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists moderation_notes text;

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'reviewed', 'action_taken', 'dismissed'));

drop policy if exists "Gista admins can view reports" on public.reports;
create policy "Gista admins can view reports"
  on public.reports for select to authenticated
  using ((select private.is_gista_admin()));
drop policy if exists "Gista admins can update reports" on public.reports;
create policy "Gista admins can update reports"
  on public.reports for update to authenticated
  using ((select private.is_gista_admin()))
  with check ((select private.is_gista_admin()));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 3 and 120),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;

drop policy if exists "Users can submit own support tickets" on public.support_tickets;
create policy "Users can submit own support tickets"
  on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can view own support tickets" on public.support_tickets;
create policy "Users can view own support tickets"
  on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_gista_admin()));
drop policy if exists "Gista admins can update support tickets" on public.support_tickets;
create policy "Gista admins can update support tickets"
  on public.support_tickets for update to authenticated
  using ((select private.is_gista_admin()))
  with check ((select private.is_gista_admin()));

grant select, insert, update, delete on public.gista_admins to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.support_tickets to authenticated;

create index if not exists reports_status_created_at_idx on public.reports (status, created_at desc);
create index if not exists support_tickets_status_created_at_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_user_id_created_at_idx on public.support_tickets (user_id, created_at desc);
