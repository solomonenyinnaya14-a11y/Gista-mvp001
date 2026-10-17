-- Fix PL/pgSQL name collision between the verification_type argument and table column.
-- Keep visible badges restricted to official/public-figure verification.
create or replace function public.admin_review_gista_verification(
  target_profile_id uuid,
  decision text,
  verification_type text default null,
  review_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  clean_notes text := left(coalesce(review_notes, ''), 3000);
  result jsonb;
begin
  if not private.is_gista_admin() then
    raise insufficient_privilege using message = 'Only authorised Gista administrators can change verification status.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise no_data_found using message = 'Gista user not found.';
  end if;

  if decision is null or decision not in ('approved', 'not_approved', 'revoked') then
    raise check_violation using message = 'Invalid verification decision.';
  end if;

  if decision = 'approved' and verification_type is distinct from 'official' then
    raise check_violation using message = 'Only public-figure verification can grant a visible badge. Use internal identity review for personal verification.';
  end if;

  if decision = 'approved' then
    insert into public.verified_profiles (profile_id, verification_type, badge_color, verified_at)
    values (target_profile_id, 'official', '#6D28D9', now())
    on conflict (profile_id) do update
      set verification_type = 'official',
          badge_color = '#6D28D9',
          verified_at = now();
  elsif decision in ('revoked', 'not_approved') then
    delete from public.verified_profiles vp
    where vp.profile_id = target_profile_id;
  end if;

  insert into public.verification_reviews (profile_id, reviewed_by, decision, verification_type, notes)
  values (
    target_profile_id,
    auth.uid(),
    decision,
    case when decision = 'approved' then 'official' else null end,
    clean_notes
  );

  select jsonb_build_object(
    'decision', decision,
    'is_verified', exists (
      select 1
      from public.verified_profiles vp
      where vp.profile_id = target_profile_id
        and vp.verification_type = 'official'
    ),
    'verification_type', (
      select vp.verification_type
      from public.verified_profiles vp
      where vp.profile_id = target_profile_id
        and vp.verification_type = 'official'
    )
  )
  into result;

  return result;
end;
$function$;
