import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MatchdayDashboard from './MatchdayDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayerData = {
  id: string;
  first_name: string;
  last_name: string;
  ability_rating: number | null;
  preferred_position: string | null;
};

export type TeamData = {
  id: string;
  name: string;
  colour: string;
  players: PlayerData[]; // ordered: field players first, subs after
};

export type MatchData = {
  id: string;
  match_number: number;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: 'upcoming' | 'live' | 'completed';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round-robin schedule: all unique pairs, repeated to fill count. */
function generateSchedule(teamIds: string[], count: number): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  if (!pairs.length) return [];
  return Array.from({ length: count }, (_, i) => pairs[i % pairs.length]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processTeams(raw: any[]): TeamData[] {
  return raw.map(t => ({
    id: t.id,
    name: t.team_name,
    colour: t.team_colour ?? 'blue',
    players: (t.team_players ?? [])
      .map((tp: { players: unknown }) => {
        const p = Array.isArray(tp.players) ? tp.players[0] : tp.players;
        return p as PlayerData | null;
      })
      .filter(Boolean) as PlayerData[],
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MatchdayPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const sessionId = params.id;

  const { data: session } = await supabase
    .from('sessions')
    .select('id, session_date, format, status, club_id')
    .eq('id', sessionId)
    .single();

  if (!session) notFound();

  // Teams + ordered players (team_players inserted in squad-order)
  const { data: rawTeams } = await supabase
    .from('teams')
    .select(`
      id, team_name, team_colour,
      team_players(
        player_id,
        players(id, first_name, last_name, ability_rating, preferred_position)
      )
    `)
    .eq('session_id', sessionId)
    .order('team_name');

  const teams = processTeams(rawTeams ?? []);

  // Fetch or generate matches
  let { data: rawMatches } = await supabase
    .from('matches')
    .select('id, match_number, home_team_id, away_team_id, home_score, away_score, status')
    .eq('session_id', sessionId)
    .order('match_number');

  if (!rawMatches?.length && teams.length >= 2) {
    const schedule = generateSchedule(teams.map(t => t.id), 5);
    const inserts = schedule.map((pair, i) => ({
      session_id: sessionId,
      club_id: session.club_id,
      home_team_id: pair[0],
      away_team_id: pair[1],
      match_number: i + 1,
      status: 'upcoming' as const,
    }));
    const { data: created } = await supabase
      .from('matches')
      .insert(inserts)
      .select('id, match_number, home_team_id, away_team_id, home_score, away_score, status');
    rawMatches = created;
  }

  const matches = (rawMatches ?? []) as MatchData[];

  // Cumulative minutes from already-completed matches
  const completedMatchIds = matches.filter(m => m.status === 'completed').map(m => m.id);
  let completedMinutes: Record<string, number> = {};
  if (completedMatchIds.length) {
    const { data: minuteRows } = await supabase
      .from('player_match_minutes')
      .select('player_id, minutes_played')
      .in('match_id', completedMatchIds);
    (minuteRows ?? []).forEach(r => {
      completedMinutes[r.player_id] = (completedMinutes[r.player_id] ?? 0) + r.minutes_played;
    });
  }

  return (
    <MatchdayDashboard
      sessionId={sessionId}
      clubId={session.club_id}
      sessionDate={session.session_date}
      format={session.format as number}
      teams={teams}
      matches={matches}
      completedMinutes={completedMinutes}
    />
  );
}
