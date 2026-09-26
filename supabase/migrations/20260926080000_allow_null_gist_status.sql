-- A Gist with no engagement should have no status.
-- The engagement trigger clears `posts.status` when the last engagement is removed,
-- so the column must allow NULL.
alter table public.posts
  alter column status drop not null;
