-- ============================================================================
-- Matchday OS — Migration 002
-- Align matches.status CHECK constraint with the app's lifecycle values.
--
-- The app uses: 'scheduled' → 'in_progress' → 'completed'
-- The existing CHECK constraint was created with different allowed values,
-- so inserts with status = 'scheduled' fail.
--
-- Run once in Supabase SQL Editor.
-- ============================================================================

-- Drop the old check constraint (name follows Postgres convention).
alter table public.matches drop constraint if exists matches_status_check;

-- Add the new one matching MatchStatus in src/lib/types/database.ts.
alter table public.matches
  add constraint matches_status_check
  check (status in ('scheduled', 'in_progress', 'completed'));

-- Set a default so callers don't have to specify it — makes future inserts
-- resilient to typos and keeps existing rows valid.
alter table public.matches alter column status set default 'scheduled';

-- Normalise any pre-existing rows with an unexpected status value.
update public.matches set status = 'scheduled' where status is null;
