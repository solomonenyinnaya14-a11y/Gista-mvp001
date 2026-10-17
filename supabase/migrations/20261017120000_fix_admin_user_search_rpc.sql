-- Search registered Gista profiles for the founder's Admin Access screen.
-- This function intentionally returns no email or other private account data.
create or replace function public.search_gista_admin_users(search_query text)
returns table (id uuid, username text, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  query_text text;
begin
  if not private.is_gista_owner() then
    raise insufficient_privilege using message = 'Only the Gista owner can search users for admin access.';
  end if;

  query_text := trim(coalesce(search_query, ''));
  if length(query_text) < 1 then
    return;
  end if;

  -- Treat typed characters literally rather than as SQL LIKE wildcards.
  query_text := replace(query_text, chr(92), chr(92) || chr(92));
  query_text := replace(query_text, '%', chr(92) || '%');
  query_text := replace(query_text, '_', chr(92) || '_');

  return query
  select p.id, p.username, p.display_name
  from public.profiles p
  where coalesce(p.username, '') ilike '%' || query_text || '%' escape chr(92)
     or coalesce(p.display_name, '') ilike '%' || query_text || '%' escape chr(92)
  order by
    case
      when p.username ilike query_text || '%' escape chr(92) then 0
      when p.display_name ilike query_text || '%' escape chr(92) then 1
      else 2
    end,
    coalesce(p.display_name, p.username, '')
  limit 25;
end;
$function$;

revoke all on function public.search_gista_admin_users(text) from public;
grant execute on function public.search_gista_admin_users(text) to authenticated;
