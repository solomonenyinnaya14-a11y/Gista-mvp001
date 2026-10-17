-- Legacy personal verification was reviewed internally before the new workflow.
-- Preserve that status in the private review table; it is not a public badge.
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

-- The admin search screen must treat only official/public-figure rows as badge-verified.
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
  left join public.verified_profiles vp on vp.profile_id = p.id and vp.verification_type = 'official'
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
    'verification', (select to_jsonb(vp) from public.verified_profiles vp where vp.profile_id = target_profile_id and vp.verification_type = 'official'),
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

revoke all on function public.admin_search_verification_users(text) from public, anon;
revoke all on function public.admin_get_verification_review(uuid) from public, anon;
grant execute on function public.admin_search_verification_users(text) to authenticated;
grant execute on function public.admin_get_verification_review(uuid) to authenticated;
