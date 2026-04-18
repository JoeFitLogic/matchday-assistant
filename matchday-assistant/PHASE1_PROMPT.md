# Phase 1 Prompt — Matchday OS

Read CLAUDE.md first. This is Phase 1: Core Session Flow (MVP).

## What to build

A Next.js 14 (App Router) web app with Supabase auth and database. Mobile-first design. The app manages youth football match nights for grassroots coaches.

## Setup

1. Initialise Next.js 14 with TypeScript, Tailwind CSS, App Router
2. Connect to the existing Supabase project (URL and anon key are in .env.local)
3. Set up Supabase auth with email/password login
4. Auto-generate TypeScript types from the existing Supabase schema
5. Configure next-pwa for installable mobile experience

## Pages to build

### 1. Login page (`/login`)
- Email + password login via Supabase Auth
- Simple, clean, mobile-friendly
- Redirect to dashboard on success

### 2. Dashboard (`/dashboard`)
- Shows upcoming sessions (next match night)
- Quick stats: total players in squad, next session date
- Quick actions: "New Session", "Manage Squad"
- Show recent sessions with status (Draft / Ready / Live / Completed)

### 3. Squad Management (`/players`)
- List all players in the squad
- Each player shows: first_name + last_name, ability_category (Advanced/Intermediate/Developing), is_active status
- Add new player: first_name, last_name, ability_category, date_of_birth (optional), preferred_position (optional)
- Edit player details
- Ability category is a dropdown: Advanced / Intermediate / Developing
- Also support: pair_group (text), separation_group (text) — these are used by the team balancer later
- Mobile-friendly cards, large touch targets

### 4. Create Session (`/sessions/new`)
- Form: session_date, venue (in notes field), format (5v5/7v7/9v9/11v11), match_length_minutes, sub_interval_minutes, num_teams
- Needs a season_id — use the active season for the club
- On create, auto-generate teams in the `teams` table (e.g. 3 rows: "Livingston 1", "Livingston 2", "Livingston 3")
- Redirect to session detail

### 5. Session Detail (`/session/[id]`)
This is the PREP screen. Three tabs or sections:

**Tab 1: Availability**
- Show all active squad players
- Toggle each player: Available / Unavailable (saves to `attendance` table with status 'present' or 'absent')
- Show count: "18 of 26 available"

**Tab 2: Teams**
- Show generated teams side by side (or stacked on mobile)
- "Auto-Generate Teams" button — splits available players into balanced teams:
  - Distributes ability_category evenly (each team gets mix of Advanced/Intermediate/Developing)
  - Respects pair_groups (keep paired players together)
  - Respects separation_groups (keep separated players apart)
  - Saves to `team_players` table
- **Manual swap:** Tap a player on one team, tap a player on another team — they swap. Simple two-tap swap. This must be easy and fast.
- **Remove player from team:** If a kid drops out last minute, tap and remove.
- **Add player to team:** If a kid shows up unexpectedly, add them to a team.
- Each team card shows: team_name, coach_name (editable), players with ability badge

**Tab 3: Fixtures**
- Per team, list 5 games
- Each game: match_number, opponent_name (editable), pitch_number (editable)
- Saves to `matches` table
- Simple form — coach fills in opponents and pitches before match night

## Components needed

- `PlayerCard` — shows player name, ability badge (coloured: green/amber/red for Adv/Int/Dev)
- `TeamCard` — shows team with its players, coach name
- `SessionCard` — shows session date, format, status, team count
- `AvailabilityToggle` — toggle player available/unavailable
- Two-tap player swap between teams (inline, not a modal)
- `FixtureRow` — opponent + pitch input per game

## Design guidelines

- Mobile-first: design for iPhone SE width (375px) and up
- Dark mode preferred (coaches are outside in the evening)
- Large text for readability
- Colour-coded ability badges: Advanced = green, Intermediate = amber, Developing = red
- Big tap targets (minimum 44px)
- Minimal decorative elements — function over form
- Use Tailwind utility classes, no custom CSS
- shadcn/ui components where they make sense (buttons, inputs, cards, tabs, dialogs)

## What NOT to build yet

- Rotation engine (Phase 3)
- Pitchside quick coach view (Phase 2)
- Timer / live matchday (Phase 2)
- Development reports / appraisals (Phase 4)
- White-label / club branding (Phase 5)
- Payment / Stripe (Phase 5)

## Success criteria

When Phase 1 is done, a coach should be able to:
1. Log in
2. See their squad of players
3. Create a new session for Saturday
4. Mark which players are available
5. Auto-generate 3 balanced teams from 18 available players
6. Easily swap players between teams with two taps
7. Remove/add a player if availability changes last minute
8. Add opponents and pitch numbers for each team's 5 games
9. See the session saved and ready for Phase 2 (pitchside view)
