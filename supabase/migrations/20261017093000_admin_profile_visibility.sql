-- Allow authorised Gista admins to look up account identities for moderation and access management.
drop policy if exists "Gista admins can view profiles for moderation" on public.profiles;
create policy "Gista admins can view profiles for moderation"
  on public.profiles for select to authenticated
  using ((select private.is_gista_admin()));
