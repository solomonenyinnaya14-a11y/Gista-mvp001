drop function if exists public.get_post_engagement_counts(uuid[]);

create table if not exists public.post_engagement_counts (
  post_id uuid primary key references public.posts(id) on delete cascade,
  share_count bigint not null default 0,
  save_count bigint not null default 0
);

alter table public.post_engagement_counts enable row level security;

grant select on table public.post_engagement_counts to authenticated;

create policy "engagement counts are readable"
on public.post_engagement_counts
for select
to authenticated
using (true);

insert into public.post_engagement_counts (post_id, share_count, save_count)
select
  p.id,
  coalesce((select count(*) from public.shares s where s.post_id = p.id), 0),
  coalesce((select count(*) from public.saves s where s.post_id = p.id), 0)
from public.posts p
on conflict (post_id) do update
set share_count = excluded.share_count,
    save_count = excluded.save_count;

create or replace function private.sync_post_save_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.post_engagement_counts (post_id, save_count)
    values (new.post_id, 1)
    on conflict (post_id) do update
      set save_count = public.post_engagement_counts.save_count + 1;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.post_engagement_counts
    set save_count = greatest(save_count - 1, 0)
    where post_id = old.post_id;
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.sync_post_share_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.post_engagement_counts (post_id, share_count)
    values (new.post_id, 1)
    on conflict (post_id) do update
      set share_count = public.post_engagement_counts.share_count + 1;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.post_engagement_counts
    set share_count = greatest(share_count - 1, 0)
    where post_id = old.post_id;
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.sync_post_save_count() from public, anon, authenticated;
revoke execute on function private.sync_post_share_count() from public, anon, authenticated;

 drop trigger if exists sync_post_save_count on public.saves;
create trigger sync_post_save_count
after insert or delete on public.saves
for each row execute function private.sync_post_save_count();

 drop trigger if exists sync_post_share_count on public.shares;
create trigger sync_post_share_count
after insert or delete on public.shares
for each row execute function private.sync_post_share_count();
