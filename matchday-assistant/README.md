# Matchday OS

Mobile-first match night manager for grassroots youth football coaches.
Phase 1 (MVP): squad management, session creation, availability, ability-balanced teams, fixtures.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth + Postgres + RLS)
- next-pwa for installable mobile experience
- Deployed on Vercel

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and sign in with an existing Supabase auth user whose `user_profiles.club_id` is set.

## Environment

`.env.local` already points at the project Supabase instance:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Phase 1 scope

Coach can:
1. Sign in
2. Manage the squad (add/edit/deactivate, ability category, pair/separation groups)
3. Create a session (format, match length, sub interval, number of teams)
4. Mark availability for each player
5. Auto-generate ability-balanced teams (respecting pair + separation groups)
6. Two-tap swap any two players between teams
7. Remove / add players to teams manually
8. Enter opponent + pitch number for each game

See [CLAUDE.md](.claude/CLAUDE.md) for full architecture notes and [PHASE1_PROMPT.md](PHASE1_PROMPT.md) for the delivery spec.

## Regenerating Supabase types

```bash
npm run types:gen
```

(requires the Supabase CLI and the project id `vfoxpxjdtquevtazzted`.)
