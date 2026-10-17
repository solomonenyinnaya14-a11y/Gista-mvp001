-- Enforce the product rule at the database boundary: new visible badge rows must be official/public-figure.
-- NOT VALID keeps legacy personal rows readable until they are naturally reviewed/removed, while rejecting new personal rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'verified_profiles_public_badges_official_only'
      and conrelid = 'public.verified_profiles'::regclass
  ) then
    alter table public.verified_profiles
      add constraint verified_profiles_public_badges_official_only
      check (verification_type = 'official') not valid;
  end if;
end
$$;
