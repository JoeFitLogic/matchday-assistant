-- ============================================================================
-- Matchday OS — Phase 1 Row Level Security policies
-- Paste into Supabase SQL Editor and run once.
--
-- Every policy: "authenticated user must belong (via user_profiles.club_id)
-- to the same club as the row they're touching".
-- clubs, seasons, user_profiles themselves: read for members of that club,
-- writes only via service role / dashboard.
-- ============================================================================

-- Helper: the caller's club (cached per-statement by Postgres).
create or replace function public.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from public.user_profiles where id = auth.uid()
$$;

grant execute on function public.current_club_id() to authenticated;

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------
alter table public.clubs                    enable row level security;
alter table public.seasons                  enable row level security;
alter table public.user_profiles            enable row level security;
alter table public.players                  enable row level security;
alter table public.sessions                 enable row level security;
alter table public.teams                    enable row level security;
alter table public.team_players             enable row level security;
alter table public.attendance               enable row level security;
alter table public.matches                  enable row level security;
alter table public.player_match_minutes     enable row level security;
alter table public.player_development       enable row level security;
alter table public.development_reports      enable row level security;
alter table public.custom_attributes        enable row level security;
alter table public.custom_attribute_scores  enable row level security;

-- ----------------------------------------------------------------------------
-- Drop existing policies (idempotent re-runs)
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clubs','seasons','user_profiles','players','sessions','teams',
        'team_players','attendance','matches','player_match_minutes',
        'player_development','development_reports','custom_attributes',
        'custom_attribute_scores'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- clubs: read own club
-- ----------------------------------------------------------------------------
create policy "read own club" on public.clubs
  for select to authenticated
  using (id = public.current_club_id());

-- ----------------------------------------------------------------------------
-- seasons: read seasons for own club
-- ----------------------------------------------------------------------------
create policy "read own seasons" on public.seasons
  for select to authenticated
  using (club_id = public.current_club_id());

-- ----------------------------------------------------------------------------
-- user_profiles: a user can read their own profile
-- ----------------------------------------------------------------------------
create policy "read own profile" on public.user_profiles
  for select to authenticated
  using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Generic helper: "same club as me" policy family
-- ----------------------------------------------------------------------------
create policy "club members read players" on public.players
  for select to authenticated using (club_id = public.current_club_id());
create policy "club members write players" on public.players
  for insert to authenticated with check (club_id = public.current_club_id());
create policy "club members update players" on public.players
  for update to authenticated
  using (club_id = public.current_club_id())
  with check (club_id = public.current_club_id());
create policy "club members delete players" on public.players
  for delete to authenticated using (club_id = public.current_club_id());

create policy "club sessions read"   on public.sessions for select to authenticated using (club_id = public.current_club_id());
create policy "club sessions insert" on public.sessions for insert to authenticated with check (club_id = public.current_club_id());
create policy "club sessions update" on public.sessions for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club sessions delete" on public.sessions for delete to authenticated using (club_id = public.current_club_id());

create policy "club teams read"   on public.teams for select to authenticated using (club_id = public.current_club_id());
create policy "club teams insert" on public.teams for insert to authenticated with check (club_id = public.current_club_id());
create policy "club teams update" on public.teams for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club teams delete" on public.teams for delete to authenticated using (club_id = public.current_club_id());

create policy "club team_players read"   on public.team_players for select to authenticated using (club_id = public.current_club_id());
create policy "club team_players insert" on public.team_players for insert to authenticated with check (club_id = public.current_club_id());
create policy "club team_players update" on public.team_players for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club team_players delete" on public.team_players for delete to authenticated using (club_id = public.current_club_id());

create policy "club attendance read"   on public.attendance for select to authenticated using (club_id = public.current_club_id());
create policy "club attendance insert" on public.attendance for insert to authenticated with check (club_id = public.current_club_id());
create policy "club attendance update" on public.attendance for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club attendance delete" on public.attendance for delete to authenticated using (club_id = public.current_club_id());

create policy "club matches read"   on public.matches for select to authenticated using (club_id = public.current_club_id());
create policy "club matches insert" on public.matches for insert to authenticated with check (club_id = public.current_club_id());
create policy "club matches update" on public.matches for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club matches delete" on public.matches for delete to authenticated using (club_id = public.current_club_id());

create policy "club pmm read"   on public.player_match_minutes for select to authenticated using (club_id = public.current_club_id());
create policy "club pmm insert" on public.player_match_minutes for insert to authenticated with check (club_id = public.current_club_id());
create policy "club pmm update" on public.player_match_minutes for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club pmm delete" on public.player_match_minutes for delete to authenticated using (club_id = public.current_club_id());

create policy "club dev read"   on public.player_development for select to authenticated using (club_id = public.current_club_id());
create policy "club dev insert" on public.player_development for insert to authenticated with check (club_id = public.current_club_id());
create policy "club dev update" on public.player_development for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club dev delete" on public.player_development for delete to authenticated using (club_id = public.current_club_id());

create policy "club reports read"   on public.development_reports for select to authenticated using (club_id = public.current_club_id());
create policy "club reports insert" on public.development_reports for insert to authenticated with check (club_id = public.current_club_id());
create policy "club reports update" on public.development_reports for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club reports delete" on public.development_reports for delete to authenticated using (club_id = public.current_club_id());

create policy "club attrs read"   on public.custom_attributes for select to authenticated using (club_id = public.current_club_id());
create policy "club attrs insert" on public.custom_attributes for insert to authenticated with check (club_id = public.current_club_id());
create policy "club attrs update" on public.custom_attributes for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "club attrs delete" on public.custom_attributes for delete to authenticated using (club_id = public.current_club_id());

-- custom_attribute_scores has no club_id; gate through its parent development row.
create policy "club attr scores read" on public.custom_attribute_scores
  for select to authenticated
  using (exists (
    select 1 from public.player_development d
    where d.id = development_id and d.club_id = public.current_club_id()
  ));
create policy "club attr scores write" on public.custom_attribute_scores
  for all to authenticated
  using (exists (
    select 1 from public.player_development d
    where d.id = development_id and d.club_id = public.current_club_id()
  ))
  with check (exists (
    select 1 from public.player_development d
    where d.id = development_id and d.club_id = public.current_club_id()
  ));
