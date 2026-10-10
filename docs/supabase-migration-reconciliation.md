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
- The tracked SQL filenames do not consistently match the versions in Supabase's migration table.
- A scan of the currently available repository branches did not recover the missing original feed migrations.
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
