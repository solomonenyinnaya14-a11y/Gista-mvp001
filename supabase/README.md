-- Gista MVP schema
-- Applied to Supabase project iybotqclrpclbyakesbr.
-- This file documents the database contract used by the application.

profiles(id, username, display_name, bio, avatar_url, created_at, updated_at)
posts(id, author_id, content_type[text|photo|voice], body, media_url, category, voice_duration_seconds, status[growing|active|trending], created_at, updated_at)
responses(id, post_id, author_id, content_type[text|voice], body, media_url, voice_duration_seconds, created_at, updated_at)
replies(id, response_id, author_id, content_type[text|voice], body, media_url, voice_duration_seconds, created_at)
likes(user_id, post_id, created_at)
saves(user_id, post_id, created_at)
follows(follower_id, following_id, created_at)
notifications(id, recipient_id, actor_id, type, post_id, response_id, read_at, created_at)
blocks(blocker_id, blocked_id, created_at)
not_interested(user_id, post_id, created_at)

MVP content intentionally excludes video, DMs, reposts, mute, communities and monetization.

Notification triggers currently create notifications for follows, likes, responses, replies, and @mentions. Mention notifications are generated from @username patterns in posts, responses, and replies. Reply notifications target the author of the response being replied to.

profile-media storage bucket: public profile images (JPG/PNG/WebP, 5MB max), uploads/deletes restricted to the authenticated user's UUID folder.


Gist lifecycle notifications: when a post status explicitly transitions to `active` or `trending`, a database trigger creates a `gist_active` or `gist_trending` notification for the Gist author. Unchanged status values do not create duplicate notifications. The lifecycle notification function is SECURITY DEFINER but EXECUTE is revoked from anon/authenticated/public; it is invoked only by the database trigger.
