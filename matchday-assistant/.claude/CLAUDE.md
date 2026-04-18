# Matchday OS — Claude Code Instructions

## Project Overview
Matchday OS is a mobile-first web app for managing youth football match nights and player development. Built for volunteer grassroots coaches who manage squads of 15-30 players, split into multiple teams each week.

**Primary use case:** A coach has 26 players. 18 are available this Saturday. The app splits them into 3 ability-balanced teams of 6, generates rotation plans with fair sub timing, and gives each of the 5 coaches a clean pitchside view on their phone. After the session, minutes are logged and development reports are produced every 6 weeks.

**Product goal:** Sellable SaaS for individual volunteer coaches. Free/cheap entry, club upgrade later.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (Auth, Database, Realtime, Storage)
- **Deployment:** Vercel
- **PWA:** next-pwa for installable mobile experience
- **Real-time:** Supabase Realtime subscriptions (5 coaches viewing same session simultaneously)

## Architecture Principles
1. **Mobile-first.** Coaches use this pitchside on phones in the rain. Large touch targets, big text, minimal scrolling. Every interaction must work with cold thumbs on a wet phone.
2. **Three-mode workflow:** PREP (at home) → PITCHSIDE (match night) → REVIEW (after).
3. **Format-aware.** Every feature adapts to format: 5v5, 7v7, 9v9, 11v11. Each has different fairness rules.
4. **Multi-coach real-time.** Up to 5 coaches logged in simultaneously, all seeing the same session. Supabase Realtime for live updates.
5. **Manual control first.** Auto-generate suggestions, but always let the coach override with easy manual swaps. Kids are unpredictable.
6. **Offline-resilient.** Matchday state persists to localStorage. Phone lock must not kill the session.
7. **UK English throughout.** Colour, favourite, organisation.

## Format Rules Engine

### 5v5 (U7/U8)
- **Equal game time enforced** — every player plays the same minutes
- 5 players on pitch, typically 1 GK + 4 outfield
- Positions: GK, D, RM, LM, ST
- Rolling subs

### 7v7 (U9/U10)
- **Fair game time** — everyone plays, flag significant imbalance
- 7 players on pitch
- Coach has flexibility but app warns if someone is underplayed

### 9v9 (U11/U12)
- **Fair game time** — same as 7v7
- 9 players on pitch

### 11v11 (U13+)
- **Competitive but fair** — coach picks team, app tracks and encourages fairness
- Full squad management

## Sub Interval Logic
- **1-2 subs available:** All subs at midpoint (e.g. 5 mins in a 10-min game)
- **3+ subs available:** Staggered — 1 sub every 3 minutes to minimise disruption to team dynamics

## Ability-Balanced Team Generation
- Players have blind ability categories: Advanced / Intermediate / Developing
- When auto-generating teams, pair Advanced + Developing players
- Teams on pitch should always be balanced — no game where one team is stacked
- When generating subs, never have all strong players on the bench at the same time
- Teams are **mixed weekly** — all players play with all players over the course of a season

## Weekly Workflow

### 1. PREP (at home, before match night)
- Create session: pick format, set match length, sub interval
- Add fixtures: opponents, pitch numbers per game
- Mark player availability from the full squad (e.g. 18 of 26 available)
- Auto-split into balanced teams (e.g. 3 teams of 6)
- Auto-generate rotations per team (ability-paired, staggered if 3+ subs)
- Manual override: drag kids between teams, swap positions — rotations recalculate
- Last-minute dropout: remove player, manually reassign, app adjusts

### 2. PITCHSIDE (match night — the Quick Coach View)
- One screen per team, swipe between games
- Each game shows: opponent, pitch number, starting lineup with positions, sub timing, who comes on, who comes off
- Simple countdown timer per game — alerts when sub is due
- Tap to confirm sub happened
- Tap to make last-minute manual swap — view updates instantly for all coaches
- **Minimal UI.** Coach has 1 minute between games to move pitch and set up kids.

### 3. REVIEW (after match night)
- Minutes auto-logged from rotation plan + confirmed subs
- Retrospective edits if something was missed on the night
- Fairness dashboard: minutes spread across the season per player
- Flag players who are consistently getting less time

### 4. DEVELOPMENT (every 6 weeks)
- Flexible attribute player assessment (core + custom attributes like GK skills)
- Core attributes: passing, shooting, dribbling, positioning, teamwork, attitude
- Custom attributes configurable per club (e.g. shot stopping, distribution for GKs)
- Generate PDF development reports for parents using AI (Claude API)
- Coach reviews and edits AI draft before approving
- **Always positively framed** — parents may show kids
- Language: "developing well in...", "next focus area...", "showing great progress in..."
- Never negative, never comparative to other players

## Multi-Coach Model
- 5 coaches can be logged in simultaneously
- All see the same session data in real-time
- One coach (admin) creates the session and generates teams
- Other coaches view their assigned team's quick coach view
- Any coach can make a manual swap — updates propagate to all

## Key Conventions
- Components in `/src/components`, organised by feature
- Database types auto-generated from Supabase
- Use server components by default, client components only when needed
- Tailwind for all styling — no CSS modules
- All times stored in UTC, displayed in UK timezone
- Supabase RLS on every table for multi-tenant isolation

## File Structure
```
/src
  /app              — Next.js App Router pages
    /dashboard       — Home/overview
    /sessions        — Session CRUD + list
    /session/[id]    — Session detail + team management
    /pitchside/[id]  — Quick coach view (the matchday screen)
    /players         — Squad management
    /development     — Appraisals + reports
    /settings        — Club/coach settings
  /components
    /ui              — Shared UI primitives
    /layout          — Shell, nav, sidebar
    /sessions        — Session-related components
    /teams           — Team generation, manual swap UI
    /matchday        — Pitchside view, timer, sub alerts
    /players         — Player cards, availability
    /development     — Appraisal forms, report generator
    /shared          — Reusable app components
  /lib
    /supabase.ts     — Supabase client
    /engines         — Rotation engine, team balancer, fairness calculator
    /utils           — Display helpers, formatters
    /types           — Auto-generated + custom types
  /hooks             — Custom React hooks
/supabase
  /migrations        — Database migrations
  /seed              — Seed data
/public              — Static assets, PWA manifest
```

## Build Phases

### Phase 1: Core Session Flow (MVP)
- Auth (Supabase, coach login)
- Squad management (add/edit/remove players, ability categories)
- Create session, mark availability
- Auto-generate balanced teams
- Manual team editing (swap players between teams easily)
- Basic fixture list per team

### Phase 2: Pitchside View
- Quick coach view per team
- Game-by-game rotation display
- Countdown timer with sub alerts
- Manual swap during live session
- Real-time sync across coaches

### Phase 3: Rotation Engine
- Auto-generate rotations based on format rules
- Ability-paired subs
- Staggered sub intervals for 3+ subs
- Minutes tracking (auto from plan + manual override)
- Fairness dashboard

### Phase 4: Development & Reports
- Flexible attribute player appraisals (core + custom)
- 6-week block structure
- AI-generated report drafts (Claude API)
- Coach review and edit before approval
- PDF report generation (positively framed)
- Blind rankings (coaches only)

### Phase 5: Polish & Sellable
- PWA install
- Club branding / white-label
- Onboarding flow for new coaches
- Pricing / Stripe integration

## Current Phase
Phase 1: Single-club MVP for Livingston Community FC
