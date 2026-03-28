-- ============================================================
-- Matchday Assistant — Initial Schema
-- Multi-tenant design: all data scoped to club_id
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

create table clubs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Links auth.users to a club with a role
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  role        text not null default 'coach'
                check (role in ('head_coach', 'coach', 'assistant')),
  created_at  timestamptz not null default now()
);

create table seasons (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,                    -- e.g. "2025/26"
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint seasons_dates_check check (end_date > start_date)
);

create table players (
  id                 uuid primary key default uuid_generate_v4(),
  club_id            uuid not null references clubs(id) on delete cascade,
  first_name         text not null,
  last_name          text not null,
  date_of_birth      date,
  ability_rating     smallint check (ability_rating between 1 and 5),
  preferred_position text,
  photo_url          text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- A Friday night event
create table sessions (
  id           uuid primary key default uuid_generate_v4(),
  club_id      uuid not null references clubs(id) on delete cascade,
  season_id    uuid not null references seasons(id) on delete cascade,
  session_date date not null,
  status       text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  notes        text,
  created_at   timestamptz not null default now()
);

-- Teams created per session
create table teams (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references sessions(id) on delete cascade,
  club_id      uuid not null references clubs(id) on delete cascade,
  team_name    text not null,
  team_colour  text
);

-- Player assigned to a team for a session
create table team_players (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references teams(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  club_id    uuid not null references clubs(id) on delete cascade,
  unique (team_id, player_id)
);

-- 5 matches per session (each between two teams)
create table matches (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references sessions(id) on delete cascade,
  club_id          uuid not null references clubs(id) on delete cascade,
  home_team_id     uuid not null references teams(id),
  away_team_id     uuid not null references teams(id),
  match_number     smallint not null,
  duration_minutes smallint not null default 10,
  home_score       smallint not null default 0,
  away_score       smallint not null default 0,
  status           text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed')),
  constraint matches_different_teams check (home_team_id <> away_team_id)
);

-- Track who played how long in each match
create table player_match_minutes (
  id                uuid primary key default uuid_generate_v4(),
  match_id          uuid not null references matches(id) on delete cascade,
  player_id         uuid not null references players(id) on delete cascade,
  team_id           uuid not null references teams(id),
  club_id           uuid not null references clubs(id) on delete cascade,
  minutes_played    smallint not null default 0,
  started           boolean not null default false,
  subbed_on_minute  smallint,
  subbed_off_minute smallint
);

-- Player attendance per session
create table attendance (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  status      text not null default 'present' check (status in ('present', 'absent', 'late')),
  arrived_at  timestamptz,
  unique (session_id, player_id)
);

-- Coach assessments of players per season
create table player_development (
  id               uuid primary key default uuid_generate_v4(),
  player_id        uuid not null references players(id) on delete cascade,
  season_id        uuid not null references seasons(id) on delete cascade,
  club_id          uuid not null references clubs(id) on delete cascade,
  assessment_date  date not null default current_date,
  passing          smallint check (passing between 1 and 5),
  shooting         smallint check (shooting between 1 and 5),
  dribbling        smallint check (dribbling between 1 and 5),
  positioning      smallint check (positioning between 1 and 5),
  teamwork         smallint check (teamwork between 1 and 5),
  attitude         smallint check (attitude between 1 and 5),
  coach_notes      text,
  assessed_by      uuid references user_profiles(id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_user_profiles_club_id      on user_profiles(club_id);
create index idx_seasons_club_id            on seasons(club_id);
create index idx_seasons_club_active        on seasons(club_id, is_active);
create index idx_players_club_id            on players(club_id);
create index idx_players_club_active        on players(club_id, is_active);
create index idx_sessions_club_id           on sessions(club_id);
create index idx_sessions_club_date         on sessions(club_id, session_date desc);
create index idx_sessions_season_id         on sessions(season_id);
create index idx_teams_session_id           on teams(session_id);
create index idx_teams_club_id              on teams(club_id);
create index idx_team_players_team_id       on team_players(team_id);
create index idx_team_players_player_id     on team_players(player_id);
create index idx_matches_session_id         on matches(session_id);
create index idx_matches_session_status     on matches(session_id, status);
create index idx_pmm_match_id               on player_match_minutes(match_id);
create index idx_pmm_player_id              on player_match_minutes(player_id);
create index idx_attendance_session_id      on attendance(session_id);
create index idx_attendance_player_id       on attendance(player_id);
create index idx_pd_player_id              on player_development(player_id);
create index idx_pd_season_id              on player_development(season_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table clubs                enable row level security;
alter table user_profiles        enable row level security;
alter table seasons              enable row level security;
alter table players              enable row level security;
alter table sessions             enable row level security;
alter table teams                enable row level security;
alter table team_players         enable row level security;
alter table matches              enable row level security;
alter table player_match_minutes enable row level security;
alter table attendance           enable row level security;
alter table player_development   enable row level security;

-- Helper: returns the club_id for the currently authenticated user
create or replace function get_my_club_id()
returns uuid
language sql
security definer
stable
as $$
  select club_id from user_profiles where id = auth.uid()
$$;

-- CLUBS: coaches can only see their own club
create policy "clubs_select_own"
  on clubs for select
  using (id = get_my_club_id());

-- USER_PROFILES: users manage their own row only
create policy "user_profiles_select_own"
  on user_profiles for select
  using (id = auth.uid());

create policy "user_profiles_insert_own"
  on user_profiles for insert
  with check (id = auth.uid());

create policy "user_profiles_update_own"
  on user_profiles for update
  using (id = auth.uid());

-- All remaining tables: full access scoped to the user's club_id

create policy "seasons_club_access"
  on seasons for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "players_club_access"
  on players for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "sessions_club_access"
  on sessions for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "teams_club_access"
  on teams for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "team_players_club_access"
  on team_players for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "matches_club_access"
  on matches for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "player_match_minutes_club_access"
  on player_match_minutes for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "attendance_club_access"
  on attendance for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "player_development_club_access"
  on player_development for all
  using (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());
