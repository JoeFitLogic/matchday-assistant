-- ============================================================================
-- Matchday OS — Migration 003
-- Teams belong to a time slot (e.g. 6:00 PM / 7:00 PM). Livingston runs two
-- teams at 6pm and two at 7pm — every session with >1 team has this shape.
--
-- slot_number groups teams that play at the same time.
-- slot_label is the coach-facing display text ("6:00 PM", "Early group", …).
--
-- Siblings should play in the same slot so one car trip covers them — the
-- balancer uses pair_group to keep a sibling unit on one team, which is
-- inside one slot by definition.
--
-- Run once in Supabase SQL Editor.
-- ============================================================================

alter table public.teams
  add column if not exists slot_number smallint not null default 1,
  add column if not exists slot_label text;

-- Any teams that existed before this migration default to slot 1.
update public.teams set slot_number = 1 where slot_number is null;

-- Index for grouping / ordering by slot
create index if not exists teams_session_slot_idx
  on public.teams (session_id, slot_number);
