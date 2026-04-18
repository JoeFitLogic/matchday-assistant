-- ============================================================================
-- Matchday OS — Phase 1 seed data
-- Paste into Supabase SQL Editor and run once.
--
-- Before running:
--   1. Create an auth user in Supabase Dashboard → Authentication → Users
--      (tick "Auto Confirm User")
--   2. Copy that user's UUID
--   3. Replace PASTE_YOUR_USER_UUID_HERE below with it
-- ============================================================================

-- 1. Club
insert into clubs (name, slug, primary_colour, secondary_colour)
values ('Livingston Community FC', 'livingston-community-fc', '#10b981', '#0b0f1a')
on conflict (slug) do nothing;

-- 2. Active season
insert into seasons (club_id, name, start_date, end_date, is_active)
select id, '2025/26', '2025-08-01', '2026-06-30', true
from clubs
where slug = 'livingston-community-fc'
on conflict do nothing;

-- 3. Link your auth user to the club as a coach
-- >>> REPLACE THE UUID ON THE NEXT LINE <<<
insert into user_profiles (id, club_id, role, display_name)
select 'PASTE_YOUR_USER_UUID_HERE'::uuid, id, 'coach', 'Head Coach'
from clubs
where slug = 'livingston-community-fc'
on conflict (id) do update set club_id = excluded.club_id, role = excluded.role;

-- 4. Sample squad (15 players, mixed ability)
insert into players (club_id, first_name, last_name, ability_category, preferred_position, is_active)
select id, first_name, last_name, ability_category::text, preferred_position, true
from clubs,
     (values
        ('Oliver',  'Campbell',  'Advanced',     'ST'),
        ('Harris',  'MacLeod',   'Advanced',     'CM'),
        ('Finlay',  'Stewart',   'Advanced',     'CB'),
        ('Jack',    'Wallace',   'Advanced',     'RM'),
        ('Lewis',   'Murray',    'Intermediate', 'LM'),
        ('Archie',  'Robertson', 'Intermediate', 'CM'),
        ('Rory',    'Fraser',    'Intermediate', 'CB'),
        ('Callum',  'Sinclair',  'Intermediate', 'GK'),
        ('Fergus',  'Douglas',   'Intermediate', 'ST'),
        ('Struan',  'Kerr',      'Intermediate', 'LB'),
        ('Hamish',  'Ferguson',  'Developing',   'CB'),
        ('Blair',   'Henderson', 'Developing',   'RM'),
        ('Cameron', 'Reid',      'Developing',   'LM'),
        ('Angus',   'Watson',    'Developing',   'ST'),
        ('Duncan',  'Black',     'Developing',   'GK')
     ) as players_data(first_name, last_name, ability_category, preferred_position)
where clubs.slug = 'livingston-community-fc'
on conflict do nothing;
