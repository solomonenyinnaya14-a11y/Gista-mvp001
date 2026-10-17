create table if not exists public.user_identity_reviews (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','not_confirmed','needs_info')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 3000),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_moderation_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','banned')),
  reason text not null default '' check (char_length(reason) <= 3000),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.account_moderation_actions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('suspend','ban','restore')),
  reason text not null check (char_length(reason) between 1 and 3000),
  created_at timestamptz not null default now()
);

alter table public.user_identity_reviews enable row level security;
alter table public.account_moderation_state enable row level security;
alter table public.account_moderation_actions enable row level security;

revoke all on public.user_identity_reviews from anon, authenticated;
revoke all on public.account_moderation_state from anon, authenticated;
revoke all on public.account_moderation_actions from anon, authenticated;
grant all on public.user_identity_reviews to service_role;
grant all on public.account_moderation_state to service_role;
grant all on public.account_moderation_actions to service_role;

create or replace function public.admin_list_user_management(
  search_query text default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  identity_status text,
  identity_notes text,
  account_status text,
  account_reason text,
  report_count bigint,
  pending_report_count bigint,
  latest_report_reason text,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare q text := trim(coalesce(search_query, ''));
begin
  if not private.is_gista_admin() then
    raise insufficient_privilege using message = 'Only authorised Gista administrators can view user management.';
  end if;

  return query
  with filtered as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.created_at
    from public.profiles p
    where q = ''
       or coalesce(p.username, '') ilike '%' || q || '%'
       or coalesce(p.display_name, '') ilike '%' || replace(replace(q, '%', '\\%'), '_', '\\_') || '%'
  )
  select f.id, f.username, f.display_name, f.avatar_url, f.bio, f.created_at,
    coalesce(ir.status, 'pending'),
    coalesce(ir.notes, ''),
    coalesce(ms.status, 'active'),
    coalesce(ms.reason, ''),
    (select count(*) from public.reports r
      left join public.posts ps on ps.id = r.post_id
      left join public.responses rs on rs.id = r.response_id
      left join public.replies rp on rp.id = r.reply_id
      where r.target_user_id = f.id or ps.author_id = f.id or rs.author_id = f.id or rp.author_id = f.id),
    (select count(*) from public.reports r
      left join public.posts ps on ps.id = r.post_id
      left join public.responses rs on rs.id = r.response_id
      left join public.replies rp on rp.id = r.reply_id
      where (r.target_user_id = f.id or ps.author_id = f.id or rs.author_id = f.id or rp.author_id = f.id)
        and r.status = 'pending'),
    (select r.reason from public.reports r
      where r.target_user_id = f.id
      order by r.created_at desc limit 1),
    count(*) over()
  from filtered f
  left join public.user_identity_reviews ir on ir.profile_id = f.id
  left join public.account_moderation_state ms on ms.profile_id = f.id
  order by f.created_at desc
  limit greatest(1, least(coalesce(result_limit, 50), 100))
  offset greatest(coalesce(result_offset, 0), 0);
end;
$function$;

create or replace function public.admin_record_personal_identity_review(
  target_profile_id uuid,
  review_decision text,
  review_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare clean_notes text := left(trim(coalesce(review_notes, '')), 3000);
begin
  if not private.is_gista_admin() then
    raise insufficient_privilege using message = 'Only authorised Gista administrators can review account identity.';
  end if;
  if review_decision not in ('confirmed','not_confirmed','needs_info') then
    raise check_violation using message = 'Choose a valid identity review decision.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise no_data_found using message = 'Gista user not found.';
  end if;

  insert into public.user_identity_reviews(profile_id,status,reviewed_by,reviewed_at,notes,updated_at)
  values (target_profile_id,review_decision,auth.uid(),now(),clean_notes,now())
  on conflict (profile_id) do update
    set status = excluded.status, reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at, notes = excluded.notes, updated_at = now();

  return jsonb_build_object('profile_id', target_profile_id, 'status', review_decision);
end;
$function$;

revoke all on function public.admin_list_user_management(text,integer,integer) from public, anon;
revoke all on function public.admin_record_personal_identity_review(uuid,text,text) from public, anon;
grant execute on function public.admin_list_user_management(text,integer,integer) to authenticated;
grant execute on function public.admin_record_personal_identity_review(uuid,text,text) to authenticated;

-- Existing personal verification was previously stored in the public badge table.
-- Preserve the internal review result, then remove the public badge for those accounts.
insert into public.user_identity_reviews(profile_id, status, reviewed_at, notes, updated_at)
select vp.profile_id, 'confirmed', vp.verified_at,
       'Migrated from the previous personal-verification flow. Internal-only; no public badge.',
       now()
from public.verified_profiles vp
where vp.verification_type = 'personal'
on conflict (profile_id) do update
set status = 'confirmed',
    reviewed_at = coalesce(public.user_identity_reviews.reviewed_at, excluded.reviewed_at),
    notes = case when public.user_identity_reviews.notes = '' then excluded.notes else public.user_identity_reviews.notes end,
    updated_at = now();

delete from public.verified_profiles where verification_type = 'personal';

-- Public badges are reserved for approved public-figure/official accounts.
create or replace function public.admin_review_gista_verification(
  target_profile_id uuid, decision text, verification_type text default null, review_notes text default ''
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare clean_notes text := left(coalesce(review_notes, ''), 3000); result jsonb;
begin
  if not private.is_gista_admin() then
    raise insufficient_privilege using message = 'Only authorised Gista administrators can change verification status.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise no_data_found using message = 'Gista user not found.';
  end if;
  if decision is null or decision not in ('approved','not_approved','revoked') then
    raise check_violation using message = 'Invalid verification decision.';
  end if;
  if decision = 'approved' and verification_type is distinct from 'official' then
    raise check_violation using message = 'Only public-figure verification can grant a visible badge. Use internal identity review for personal verification.';
  end if;

  if decision = 'approved' then
    insert into public.verified_profiles(profile_id,verification_type,badge_color,verified_at)
    values (target_profile_id,'official','#6D28D9',now())
    on conflict (profile_id) do update set verification_type='official',badge_color='#6D28D9',verified_at=now();
  elsif decision in ('revoked','not_approved') then
    delete from public.verified_profiles where profile_id=target_profile_id;
  end if;

  insert into public.verification_reviews(profile_id,reviewed_by,decision,verification_type,notes)
  values (target_profile_id,auth.uid(),decision,case when decision='approved' then 'official' else null end,clean_notes);
  select jsonb_build_object('decision',decision,
    'is_verified',exists(select 1 from public.verified_profiles where profile_id=target_profile_id and verification_type='official'),
    'verification_type',(select vp.verification_type from public.verified_profiles vp where vp.profile_id=target_profile_id and vp.verification_type='official'))
  into result;
  return result;
end;
$function$;

revoke all on function public.admin_review_gista_verification(uuid,text,text,text) from public, anon;
grant execute on function public.admin_review_gista_verification(uuid,text,text,text) to authenticated;
