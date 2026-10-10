# Supabase migration reconciliation and database selection

**Decision recorded: 2026-10-10**

## Selected source of truth

- **Production database:** Supabase project `iybotqclrpclbyakesbr` (Gista's connected live project).
- **Application code and future migration changes:** GitHub repository `solomonenyinnaya14-a11y/Gista-mvp001`, branch `main`.
- **Deployment:** Vercel project `gista-mvp1`; production alias `https://gista-mvp1.vercel.app`.

Until a verified schema-only dump is available, the live Supabase schema is the reference for what is currently running. GitHub `main` is the canonical place for future reviewed database changes, but its migration folder is **not** a complete rebuild history.

## Audit findings

- Supabase reports **41 applied migration records** in `supabase_migrations.schema_migrations`.
- GitHub `main` contains **13 SQL files** under `supabase/migrations/`.
- Comparing migration names (ignoring timestamp prefixes) finds only **9 ledger entries with a same-named tracked SQL file**. The other **32 of 41 applied ledger entries have no same-named SQL file in the current tracked migration folder**. This does not prove all 32 SQL definitions are unrecoverable; it means the repository cannot currently reproduce the full migration history.
- Four tracked SQL files also use names that differ from their live ledger entries, so they need manual reconciliation rather than automatic filename matching:
  - `add_following_privacy_and_profile_relationships` (file) vs `add_following_privacy_and_profile_relationship_functions` (ledger).
  - `use_invoker_for_profile_relationships` (file) vs `use_invoker_for_profile_relationship_functions` (ledger).
  - `optimize_feed_profile_rls_auth_checks` (file) vs `optimize_feed_profile_rls_auth_checks_v2` (ledger).
  - `optimize_remaining_relationship_indexes` (file) vs `optimize_remaining_feed_relationships` (ledger).
- The ledger entries with no same-named tracked SQL file are:
  - `initial_gista_mvp_schema` (`20260924074036`)
  - `gist_audio_storage` (`20260924080439`)
  - `gist_media_storage` (`20260924080556`)
  - `follow_notifications` (`20260924080844`)
  - `activity_notifications` (`20260924080947`)
  - `safety_moderation` (`20260924081821`)
  - `profile_privacy` (`20260924082107`)
  - `reply_notifications` (`20260924084347`)
  - `not_interested_filtering` (`20260924084832`)
  - `not_interested` (`20260924084840`)
  - `profile_media_storage` (`20260924085105`)
  - `add_response_saves` (`20260924090404`)
  - `enable_notifications_realtime` (`20260924091223`)
  - `add_mention_notifications` (`20260924091435`)
  - `lock_down_internal_security_definer_functions` (`20260924091836`)
  - `add_gist_lifecycle_notifications` (`20260924092835`)
  - `enforce_private_accounts` (`20260924093004`)
  - `restore_api_table_grants` (`20260924154510`)
  - `repair_profile_bootstrap_and_user_trigger` (`20260924165332`)
  - `add_following_privacy_and_profile_relationship_functions` (`20260925041556`)
  - `use_invoker_for_profile_relationship_functions` (`20260925042045`)
  - `add_verified_profiles` (`20260925094441`)
  - `fix_profile_defaults_and_bio` (`20260925100506`)
  - `engagement_based_growing_status` (`20260926070529`)
  - `optimize_feed_profile_rls_auth_checks_v2` (`20260926075630`)
  - `fix_blocks_profiles_relationships` (`20260926082109`)
  - `optimize_remaining_feed_relationships` (`20260926194029`)
  - `rank_discover_feed` (`20261008205056`)
  - `personalize_discover_feed` (`20261008210345`)
  - `personalize_following_feed` (`20261008210957`)
  - `freshen_home_feed_refresh` (`20261008212124`)
  - `shuffle_full_feed_pool_on_refresh` (`20261008212515`)
- The current `gista-rebuild` branch is **not a safe drop-in replacement for `main`**: comparing branches shows 332 commits on `main` not on `gista-rebuild`, and 4 commits on `gista-rebuild` not on `main` (two tagline changes and two auth callback/verification changes). The rebuild branch is stale relative to production and should not be switched to or merged wholesale without reviewing those four unique commits against the newer main implementation. The production app currently follows `main`.
- A scan of the currently available repository branches did not recover the original SQL for the missing feed migrations.
- Live metadata inventory (read-only, 2026-10-10): **17 public tables, 13 public functions, 20 public triggers, 46 public RLS policies, 49 public indexes, and 5 installed extensions**.
- The live database currently has 11 rows in `public.posts`; a feed request limited to 12 cannot display more eligible posts than exist. This is a content-volume limitation, not evidence that the feed RPC is returning only two posts.
- The five feed migrations applied on 2026-10-08 are recorded in Supabase but are not checked into the repository:
  - `20261008205056 rank_discover_feed`
  - `20261008210345 personalize_discover_feed`
  - `20261008210957 personalize_following_feed`
  - `20261008212124 freshen_home_feed_refresh`
  - `20261008212515 shuffle_full_feed_pool_on_refresh`
- The two security clean-up changes from 2026-10-10 are checked into `main`:
  - `20261010093000_revoke_public_growth_status_rpc_execution.sql`
  - `20261010093500_deduplicate_not_interested_policies.sql`

## Migration/database plan selected

1. **Do not reset, replace, or blindly replay migrations against production.** The production database has live app data and a working schema.
2. Keep the current production Supabase project as the live reference; do not create or switch to a second production database as part of this repair.
3. Obtain a genuine schema-only dump from the project using Supabase CLI/pg_dump with a database connection. Include public and relevant private schema objects, table definitions, constraints, indexes, functions, triggers, grants, RLS policies, extensions, and storage buckets/policies. Exclude user rows and secrets.
4. Recover original migration SQL from source control/backups if possible. The migration ledger contains version/name metadata, not the historical SQL text; guessed files are not acceptable substitutes.
5. Compare the dump to checked-in SQL and make a reviewed, reproducible **baseline for a new empty development/staging environment**. Do not run that baseline on production. Preserve the original migration ledger as audit history; don't mark missing historical versions as applied merely to silence the discrepancy.
6. Rebuild a clean staging environment from the baseline, then run smoke tests for sign-up/login, profile bootstrap/editing, text/photo/voice post creation, feed tabs and refresh, likes/saves/responses, notifications, RLS/privacy, and media storage.
7. Only after the clean rebuild and tests pass should Claude or another agent be invited to make further backend/database changes.

## Verified live fixes

- Client roles `anon` and `authenticated` no longer have EXECUTE permission on the internal growth-status functions `refresh_post_growth_status(uuid)` and `sync_post_growth_status_from_engagement()`. Trigger-driven internal use remains.
- Duplicate `not_interested` policies were removed.
- These changes are represented by the two migration files listed above and merged to `main`.
- The feed code now caches a successfully loaded feed in session storage. The latest production deployment for commit `ca99f3731ddea57858e3da7b399a5771f7e78dd6` is **READY**. That confirms deployment/build status, not a full authenticated browser end-to-end test.

## Remaining items

- **Schema dump/rebuild:** cannot be completed safely with the currently exposed Supabase connector alone; it does not provide a native `pg_dump` or full schema-dump action. Use Supabase CLI/pg_dump with a database connection, then commit the verified baseline only after comparison.
- **Leaked-password protection:** Supabase's security advisor still reports this disabled. The connected Supabase tools do not expose an Auth security-setting update operation. Enable it in the Supabase dashboard under Authentication security/password protection before treating the security checklist as complete.
- Do not commit service-role keys, database passwords, access tokens, or production user data to this repository.
