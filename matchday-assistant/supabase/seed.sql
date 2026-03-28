-- ============================================================
-- Seed: Livingston Community FC — Phase 1 MVP
-- Run this after 001_initial_schema.sql
-- ============================================================

-- Initial club
insert into clubs (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Livingston Community FC');

-- 2024/25 season (active)
insert into seasons (id, club_id, name, start_date, end_date, is_active) values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    '2024/25',
    '2024-08-01',
    '2025-05-31',
    true
  );
