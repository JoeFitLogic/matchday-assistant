-- ============================================================================
-- Matchday OS — Migration 004
-- First-class coaches. A team has an optional coach assignment; the same
-- coach can be on multiple teams across slots (e.g. one team at 6pm +
-- one at 7pm).
--
-- Kept deliberately light: coaches are a standalone record, no auth user
-- required. When we move to the multi-coach login model in Phase 2 we'll
-- add coaches.user_profile_id as an optional link.
--
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- 1. Coaches table
create table if not exists public.coaches (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  first_name text not null,
  last_name  text not null,
  email      text,
  phone      text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists coaches_club_active_idx
  on public.coaches (club_id, is_active);

-- 2. teams.coach_id — nullable FK, set null on coach delete so the team
--    survives with an "unassigned" state.
alter table public.teams
  add column if not exists coach_id uuid
    references public.coaches(id) on delete set null;

create index if not exists teams_coach_idx on public.teams (coach_id);

-- 3. RLS + policies (same-club gating via current_club_id() helper)
alter table public.coaches enable row level security;

drop policy if exists "club members read coaches"   on public.coaches;
drop policy if exists "club members insert coaches" on public.coaches;
drop policy if exists "club members update coaches" on public.coaches;
drop policy if exists "club members delete coaches" on public.coaches;

create policy "club members read coaches" on public.coaches
  for select to authenticated using (club_id = public.current_club_id());
create policy "club members insert coaches" on public.coaches
  for insert to authenticated with check (club_id = public.current_club_id());
create policy "club members update coaches" on public.coaches
  for update to authenticated
  using (club_id = public.current_club_id())
  with check (club_id = public.current_club_id());
create policy "club members delete coaches" on public.coaches
  for delete to authenticated using (club_id = public.current_club_id());

-- 4. Refresh PostgREST schema cache so the API picks up the new columns.
notify pgrst, 'reload schema';
