# Supabase migration reconciliation audit

**Status: investigation in progress — do not treat the checked-in migration folder as a complete rebuild history.**

Audited on 2026-10-10 against Supabase project `iybotqclrpclbyakesbr` and GitHub `main`.

## Findings

- Supabase reports **41 applied migration records** in `supabase_migrations.schema_migrations`.
- The `main` branch contains **13 SQL files** under `supabase/migrations/`.
- The tracked SQL filenames use timestamps that do not consistently match the versions in Supabase's migration table. Several early database migrations (including the initial schema, storage, moderation, notifications, privacy, and profile bootstrap work) have no matching checked-in SQL file.
- The five feed migrations applied on 2026-10-08 are recorded in Supabase but are not checked into the repository:
  - `20261008205056 rank_discover_feed`
  - `20261008210345 personalize_discover_feed`
  - `20261008210957 personalize_following_feed`
  - `20261008212124 freshen_home_feed_refresh`
  - `20261008212515 shuffle_full_feed_pool_on_refresh`
- The two security clean-up migrations from 2026-10-10 are now present in the repository:
  - `20261010093000_revoke_public_growth_status_rpc_execution.sql`
  - `20261010093500_deduplicate_not_interested_policies.sql`

## Safety rule

**Do not blindly replay the checked-in migrations against production, and do not create empty placeholder files for the missing historical versions.** The migration ledger records version and name, not the SQL text. Reconstructing the original historical SQL from that ledger alone is not possible and guessing could alter production behavior.

## Required reconciliation procedure

1. Treat the current production database as the live reference until a verified schema-only dump is captured.
2. Capture a schema-only dump from the intended Supabase project using the Supabase CLI / database connection. Include public tables, columns, constraints, indexes, functions, triggers, RLS policies, grants, and storage configuration relevant to Gista. Keep secrets and user data out of the dump.
3. Recover original migration SQL from version control/backups if available. Compare it against the live schema and the dump before deciding what can be restored.
4. For any unrecoverable history, document that fact and establish a deliberate baseline/rebuild procedure for a **new empty environment**. Do not mark historical migrations as applied or run a baseline against production without a reviewed plan.
5. Verify a clean development/staging rebuild and run feed, authentication, profile, media, and engagement smoke tests before Claude or another agent makes backend changes.

## Verified live fixes already applied

- Client roles `anon` and `authenticated` no longer have EXECUTE permission on the internal growth-status functions `refresh_post_growth_status(uuid)` and `sync_post_growth_status_from_engagement()`. Trigger-driven internal use remains.
- Duplicate `not_interested` policies were removed.
- These changes are represented by the two migration files listed above and merged to `main`.

## Other known setup items

- Vercel preview environment now has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured. A fresh preview build is required to verify the fix.
- Supabase's security advisor still reports leaked-password protection disabled. This must be enabled in the Supabase Auth settings/dashboard; the available connected Supabase tools do not expose an Auth security-setting update operation.
- Do not commit service-role keys, database passwords, access tokens, or production user data into this repository.
