alter table public.posts
  add column if not exists transcript text,
  add column if not exists transcript_status text not null default 'not_applicable';

alter table public.responses
  add column if not exists transcript text,
  add column if not exists transcript_status text not null default 'not_applicable';

alter table public.replies
  add column if not exists transcript text,
  add column if not exists transcript_status text not null default 'not_applicable';

update public.posts set transcript_status = 'pending' where content_type = 'voice' and transcript_status = 'not_applicable';
update public.responses set transcript_status = 'pending' where content_type = 'voice' and transcript_status = 'not_applicable';
update public.replies set transcript_status = 'pending' where content_type = 'voice' and transcript_status = 'not_applicable';

alter table public.posts add constraint posts_transcript_status_check
  check (transcript_status in ('not_applicable', 'pending', 'complete', 'failed'));
alter table public.responses add constraint responses_transcript_status_check
  check (transcript_status in ('not_applicable', 'pending', 'complete', 'failed'));
alter table public.replies add constraint replies_transcript_status_check
  check (transcript_status in ('not_applicable', 'pending', 'complete', 'failed'));
