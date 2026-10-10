# Gista — AI Engineering Handoff

## Mission
Help prepare and improve the Gista MVP safely. Work from the current code, inspect before changing it, fix root causes, and validate each change. Prefer small, reviewable improvements over broad rewrites.

## Canonical workspace
- Repository: `solomonenyinnaya14-a11y/Gista-mvp001`
- Production branch: `main`
- Production app: https://gista-mvp1.vercel.app
- Production backend: existing Supabase project referenced by the configured environment; never reset or replace it.
- This handoff branch: `claude-ready`, created from the latest `main` commit.
- Historical `gista-rebuild` branch: stale/diverged. Do not switch to it or merge it wholesale. If useful code exists only there, inspect and cherry-pick specific commits after comparing them with current `main`.

## Product rules
Gista is a conversation-first social app. MVP supports:
- Text, photo, and voice posts
- Text and voice responses, plus replies
- Likes, saves, follows, search, notifications, topic categories
- Conversation status and Gist DNA

Out of MVP: video, private DMs, reposts, mute, user-created communities, creator monetization. Do not reintroduce these without explicit product approval.

## Engineering rules
1. Inspect the relevant code, current git diff, existing schema assumptions, and latest CI/deployment state before making changes.
2. Work only on a feature/fix branch created from the latest `main` unless the founder explicitly chooses otherwise. Never commit directly to `main`.
3. Make one focused change at a time. Explain the root cause and expected behavior in the PR.
4. Run `npm run lint` and `npm run build` before requesting review. Fix blocking errors; do not spend time cleaning unrelated non-blocking warnings unless they affect behavior, security, or maintainability of the task.
5. Never claim a feature is verified based only on a successful build. Distinguish CI/build checks, database checks, and real browser end-to-end checks.
6. Do not expose secrets or put them in code, logs, issues, PRs, or docs. Use `.env.local`; never commit it.
7. Do not reset, replace, or blindly replay migrations on production. Do not invent historical migration SQL or mark missing migrations applied just to silence a discrepancy.
8. For schema/RLS/auth/storage changes, inspect the live schema and policies first; propose the smallest reversible change, test on staging, then request approval before production application.
9. Preserve user data. Avoid destructive SQL, broad policy changes, and data migrations without explicit approval and a rollback plan.
10. Avoid unrelated refactors, visual redesigns, new dependencies, or paid services unless necessary and approved.

## Known state at handoff (2026-10-10)
- Latest `main` commit when this workspace was prepared: `2a51d8a795b00d5e59a49dad79026bb3e682cb63`.
- Latest production deployment for that commit was reported READY by Vercel.
- GitHub Actions CI for that commit passed (lint and build).
- The blocking Post-detail render-purity lint error has been fixed and merged.
- Feed code caches successful feed results. Live database contains 11 posts; an authenticated RPC test returned 11 posts in two calls with different order fingerprints. The UI still needs a founder browser smoke test if feed behavior is reported broken.
- Supabase reports 41 migration ledger records while the repository has 13 tracked SQL migrations. Nine ledger names match tracked files; 32 entries have no same-named file and four tracked files have naming mismatches. This is a reproducibility gap, not permission to alter production. A schema-only dump and comparison are needed before a clean staging baseline can be created.
- Supabase security advisor previously reported leaked-password protection disabled. Treat as a launch/security follow-up, not a reason to block ordinary frontend work.
- No production runtime errors were returned by the available Vercel error query for the selected seven-day window; this is not proof of zero user-facing bugs.

## First tasks when connected
1. Confirm checkout is `claude-ready`, inspect `git status`, and read this file and README.
2. Inspect app routes/components, auth/profile flow, feed queries, storage usage, Supabase clients, and tests. Produce a short prioritized report: blocker / important / defer.
3. Re-run lint/build on the checked-out commit and inspect the actual output.
4. Smoke-test existing flows where credentials/browser tooling are available: sign-up/login, profile bootstrap/edit, create text/photo/voice post, feed tabs/refresh, likes/saves/responses, notifications, and logout.
5. Fix only reproducible important issues in focused branches/PRs. If access, credentials, or a human decision is needed, state exactly what is needed and wait rather than guessing.
6. Do not begin migration reconstruction or production database changes until a schema-only dump has been obtained and compared.

## Local setup
- Copy `.env.example` to `.env.local` and set the required Supabase URL and publishable key locally.
- Install dependencies with `npm install`.
- Start the app with `npm run dev`.
- Run `npm run lint` and `npm run build`.
- Never ask the founder to paste database passwords, service-role keys, or other secrets into chat.
