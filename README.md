# Gista

Gista is a conversation-first social platform: a place where people come to talk, express themselves, share thoughts, stories, experiences, opinions, emotions, jokes, banter, gossip and ideas.

## MVP

Text, photo and voice posts; text and voice responses; replies; likes; saves; follows; search; notifications; categories; Gist status and Gist DNA.

Video, DMs, reposts, mute, communities and creator monetization are not part of the MVP.

## Stack

Next.js 16 + React 19 + Supabase + PostgreSQL.

## Branches and deployment

- `main` is the production source of truth and is connected to the production deployment.
- `claude-ready` is the prepared AI collaboration workspace, based on the latest `main` commit at handoff time.
- `gista-rebuild` is a historical branch that has diverged from `main`; do not use it as the current working base or merge it wholesale. Review individual changes if needed.
- Make focused feature/fix branches from the latest `main`; validate and review changes before merging.

## Development

Create a local `.env.local` from `.env.example` with the Supabase URL and publishable key, then run `npm install` and `npm run dev`.

Read [CLAUDE.md](./CLAUDE.md) before changing code. It documents product boundaries, known technical risks, validation expectations, and safe database rules.
