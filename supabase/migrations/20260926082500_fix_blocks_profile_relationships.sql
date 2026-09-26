alter table public.blocks drop constraint if exists blocks_blocker_id_fkey;
alter table public.blocks drop constraint if exists blocks_blocked_id_fkey;

create index if not exists blocks_blocker_id_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);
