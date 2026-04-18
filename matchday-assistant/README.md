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

## Database setup (one-time)

Before the app can do anything you need a club, an active season, an auth user,
and RLS policies. Two SQL files do the lot:

1. **Create an auth user** — Supabase Dashboard → Authentication → Users → Add
   user → tick "Auto Confirm User". Copy the UUID.
2. **Open [`supabase/seed.sql`](supabase/seed.sql)** — replace
   `PASTE_YOUR_USER_UUID_HERE` with that UUID — paste the whole file into
   Supabase SQL Editor and run.
3. **Open [`supabase/policies.sql`](supabase/policies.sql)** — paste and run.
   This enables RLS and adds "same-club" policies across every Phase 1 table.

## Deploying to Vercel

1. https://vercel.com/new → import `JoeFitLogic/matchday-assistant`
2. **Root Directory:** `matchday-assistant`
3. **Environment variables** (Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. In Supabase → Authentication → URL Configuration, set **Site URL** to the
   Vercel URL and add it to **Redirect URLs**.

## Regenerating Supabase types

```bash
npm run types:gen
```

(requires the Supabase CLI and the project id `vfoxpxjdtquevtazzted`.)
