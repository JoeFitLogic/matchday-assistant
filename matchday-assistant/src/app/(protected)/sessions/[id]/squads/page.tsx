import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SquadSelector from './SquadSelector';
import type { Format } from './balance';

export default async function SquadsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const sessionId = params.id;

  // ── Fetch session ──────────────────────────────────────────────────────────
  const { data: session } = await supabase
    .from('sessions')
    .select('id, session_date, format, status, club_id, season_id')
    .eq('id', sessionId)
    .single();

  if (!session) notFound();
  if (session.status === 'completed') redirect(`/sessions/${sessionId}`);

  // ── Fetch present players (joined via attendance) ──────────────────────────
  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('player_id, players(id, first_name, last_name, ability_rating, preferred_position)')
    .eq('session_id', sessionId)
    .eq('status', 'present');

  type PlayerRow = { id: string; first_name: string; last_name: string; ability_rating: number | null; preferred_position: string | null };
  const players = (attendanceRows ?? [])
    .map(a => (Array.isArray(a.players) ? a.players[0] : a.players) as unknown as PlayerRow | null)
    .filter((p): p is PlayerRow => p !== null);

  // ── Fetch existing teams + assignments ─────────────────────────────────────
  const { data: teams } = await supabase
    .from('teams')
    .select('id, team_name, team_colour, team_players(player_id)')
    .eq('session_id', sessionId)
    .order('team_name', { ascending: true });

  return (
    <SquadSelector
      sessionId={sessionId}
      clubId={session.club_id}
      sessionDate={session.session_date}
      initialFormat={session.format as Format}
      players={players}
      initialTeams={(teams ?? []).map(t => ({
        id: t.id,
        name: t.team_name,
        colour: (t.team_colour ?? 'blue') as string,
        playerIds: (t.team_players as { player_id: string }[]).map(tp => tp.player_id),
      }))}
    />
  );
}
