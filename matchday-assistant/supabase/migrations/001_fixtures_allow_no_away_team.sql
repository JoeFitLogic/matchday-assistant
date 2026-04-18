-- ============================================================================
-- Matchday OS — Migration 001
-- Allow fixtures with no recorded away_team_id.
--
-- Why: Grassroots 5-a-side / festival format. Our club fields multiple teams
-- that play *external* opponents at the same venue. The opponent is stored
-- as free text in matches.opponent_name — we don't create a teams row for
-- them. So away_team_id must be nullable.
--
-- Run once in Supabase SQL Editor.
-- ============================================================================

alter table public.matches alter column away_team_id drop not null;

-- Defensive: home_team_id should also be nullable (we create fixture stubs
-- before assigning teams in some flows). Drop NOT NULL if present.
alter table public.matches alter column home_team_id drop not null;
