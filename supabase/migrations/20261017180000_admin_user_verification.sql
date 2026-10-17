create table if not exists public.verification_reviews (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_by uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','not_approved','revoked')),
  verification_type text check (verification_type in ('personal','official')),
  notes text not null default '' check (char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  constraint verification_reviews_decision_type_check
    check ((decision = 'approved' and verification_type is not null) or decision <> 'approved')
);
alter table public.verification_reviews enable row level security;
drop policy if exists "Gista admins can view verification review history" on public.verification_reviews;
create policy "Gista admins can view verification review history"
  on public.verification_reviews for select to authenticated
  using ((select private.is_gista_admin()));
revoke all on public.verification_reviews from anon, authenticated;
grant select on public.verification_reviews to authenticated;

create or replace function public.admin_search_verification_users(search_query text)
returns table (
  id uuid, username text, display_name text, bio text, avatar_url text, created_at timestamptz,
  is_verified boolean, verification_type text, gist_count bigint, response_count bigint, reply_count bigint,
  report_count bigint, pending_report_count bigint
)
language plpgsql stable security definer set search_path = ''
as $function$
declare query_text text;
begin
  if not private.is_gista_admin() then
    raise insufficient_privilege using message = 'Only authorised Gista administrators can review verification candidates.';
  end if;
  query_text := regexp_replace(trim(coalesce(search_query, '')), '^@+', '');
  if length(query_text) < 1 then return; end if;
  query_text := replace(query_text, chr(92), chr(92) || chr(92));
  query_text := replace(query_text, '%', chr(92) || '%');
  query_text := replace(query_text, '_', chr(92) || '_');
  return query
  select p.id, p.username, p.display_name, p.bio, p.avatar_url, p.created_at,
    (vp.profile_id is not null), vp.verification_type,
    (select count(*) from public.posts ps where ps.author_id = p.id),
    (select count(*) from public.responses rs where rs.author_id = p.id),
    (select count(*) from public.replies rp where rp.author_id = p.id),
    (select count(*) from public.reports r
      left join public.posts ps on ps.id = r.post_id
      left join public.responses rs on rs.id = r.response_id
      left join public.replies rp on rp.id = r.reply_id
      where r.target_user_id = p.id or ps.author_id = p.id or rs.author_id = p.id or rp.author_id = p.id),
    (select count(*) from public.reports r
      left join public.posts ps on ps.id = r.post_id
      left join public.responses rs on rs.id = r.response_id
      left join public.replies rp on rp.id = r.reply_id
      where (r.target_user_id = p.id or ps.author_id = p.id or rs.author_id = p.id or rp.author_id = p.id)
        and r.status = 'pending')
  from public.profiles p
  left join public.verified_profiles vp on vp.profile_id = p.id
  where coalesce(p.username, '') ilike '%' || query_text || '%' escape chr(92)
     or coalesce(p.display_name, '') ilike '%' || query_text || '%' escape chr(92)
  order by case when p.username ilike query_text || '%' escape chr(92) then 0
                when p.display_name ilike query_text || '%' escape chr(92) then 1 else 2 end,
           coalesce(p.display_name, p.username, '')
  limit 25;
end;
$function$;

create or replace function public.admin_get_verification_review(target_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare result jsonb;
begin
  if not private.is_gista_admin() then
    raise insufficient_privilege using message = 'Only authorised Gista administrators can review verification candidates.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise no_data_found using message = 'Gista user not found.';
  end if;
  select jsonb_build_object(
    'profile', (select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,
      'avatar_url',p.avatar_url,'cover_url',p.cover_url,'created_at',p.created_at,'is_private',p.is_private)
      from public.profiles p where p.id = target_profile_id),
    'verification', (select to_jsonb(vp) from public.verified_profiles vp where vp.profile_id = target_profile_id),
    'gists', coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
      select jsonb_build_object('id',p.id,'body',p.body,'content_type',p.content_type,'category',p.category,
        'status',p.status,'moderation_status',p.moderation_status,'created_at',p.created_at,'media_url',p.media_url) as item,p.created_at
      from public.posts p where p.author_id = target_profile_id order by p.created_at desc limit 12
    ) x), '[]'::jsonb),
    'responses', coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
      select jsonb_build_object('id',r.id,'body',r.body,'content_type',r.content_type,'created_at',r.created_at,'media_url',r.media_url) as item,r.created_at
      from public.responses r where r.author_id = target_profile_id order by r.created_at desc limit 12
    ) x), '[]'::jsonb),
    'replies', coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
      select jsonb_build_object('id',r.id,'body',r.body,'content_type',r.content_type,'created_at',r.created_at,'media_url',r.media_url) as item,r.created_at
      from public.replies r where r.author_id = target_profile_id order by r.created_at desc limit 8
    ) x), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
      select jsonb_build_object('id',r.id,'reason',r.reason,'details',r.details,'status',r.status,'created_at',r.created_at,
        'content_type',case when r.target_user_id = target_profile_id then 'profile' when r.post_id is not null then 'gist' when r.response_id is not null then 'response' else 'reply' end,
        'content_preview',coalesce(ps.body,rs.body,rp.body)) as item,r.created_at
      from public.reports r left join public.posts ps on ps.id=r.post_id
      left join public.responses rs on rs.id=r.response_id left join public.replies rp on rp.id=r.reply_id
      where r.target_user_id = target_profile_id or ps.author_id = target_profile_id or rs.author_id = target_profile_id or rp.author_id = target_profile_id
      order by r.created_at desc limit 25
    ) x), '[]'::jsonb),
    'review_history', coalesce((select jsonb_agg(to_jsonb(vr) order by vr.created_at desc) from (
      select id,decision,verification_type,notes,created_at,reviewed_by from public.verification_reviews
      where profile_id = target_profile_id order by created_at desc limit 10
    ) vr), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

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
  if decision = 'approved' and (verification_type is null or verification_type not in ('personal','official')) then
    raise check_violation using message = 'Choose personal or official verification before approving.';
  end if;
  if decision = 'approved' then
    insert into public.verified_profiles(profile_id,verification_type,badge_color,verified_at)
    values (target_profile_id,verification_type,'#6D28D9',now())
    on conflict (profile_id) do update set verification_type=excluded.verification_type,badge_color='#6D28D9',verified_at=now();
  elsif decision = 'revoked' then
    delete from public.verified_profiles where profile_id=target_profile_id;
  end if;
  insert into public.verification_reviews(profile_id,reviewed_by,decision,verification_type,notes)
  values (target_profile_id,auth.uid(),decision,case when decision='approved' then verification_type else null end,clean_notes);
  select jsonb_build_object('decision',decision,
    'is_verified',exists(select 1 from public.verified_profiles where profile_id=target_profile_id),
    'verification_type',(select vp.verification_type from public.verified_profiles vp where vp.profile_id=target_profile_id))
  into result;
  return result;
end;
$function$;

revoke all on function public.admin_search_verification_users(text) from public,anon;
revoke all on function public.admin_get_verification_review(uuid) from public,anon;
revoke all on function public.admin_review_gista_verification(uuid,text,text,text) from public,anon;
grant execute on function public.admin_search_verification_users(text) to authenticated;
grant execute on function public.admin_get_verification_review(uuid) to authenticated;
grant execute on function public.admin_review_gista_verification(uuid,text,text,text) to authenticated;