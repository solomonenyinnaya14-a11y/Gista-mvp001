create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists follows_following_idx on public.follows (following_id);
create index if not exists notifications_recipient_read_idx on public.notifications (recipient_id, read_at);
create index if not exists posts_status_created_at_idx on public.posts (status, created_at desc);
create index if not exists posts_author_created_at_idx on public.posts (author_id, created_at desc);
