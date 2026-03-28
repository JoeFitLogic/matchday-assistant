import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DevelopmentPage from './DevelopmentPage';

export type Assessment = {
  id: string;
  assessment_date: string;
  passing: number | null;
  shooting: number | null;
  dribbling: number | null;
  positioning: number | null;
  teamwork: number | null;
  attitude: number | null;
  coach_notes: string | null;
};

export type PlayerInfo = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  preferred_position: string | null;
  ability_rating: number | null;
  photo_url: string | null;
};

export default async function PlayerDevelopmentPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const playerId = params.id;

  // Player details
  const { data: player } = await supabase
    .from('players')
    .select('id, first_name, last_name, date_of_birth, preferred_position, ability_rating, photo_url')
    .eq('id', playerId)
    .single();

  if (!player) notFound();

  // Active season (fall back to most recent if none active)
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('id, name')
    .eq('is_active', true)
    .single();

  const { data: fallbackSeason } = !activeSeason
    ? await supabase
        .from('seasons')
        .select('id, name')
        .order('start_date', { ascending: false })
        .limit(1)
        .single()
    : { data: null };

  const season = activeSeason ?? fallbackSeason;

  // All assessments for this player, chronological
  const { data: assessments } = await supabase
    .from('player_development')
    .select('id, assessment_date, passing, shooting, dribbling, positioning, teamwork, attitude, coach_notes')
    .eq('player_id', playerId)
    .order('assessment_date', { ascending: true });

  // Get club_id from current user's profile
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('club_id')
    .eq('id', user!.id)
    .single();

  return (
    <DevelopmentPage
      player={player as PlayerInfo}
      assessments={(assessments ?? []) as Assessment[]}
      seasonId={season?.id ?? null}
      seasonName={season?.name ?? null}
      clubId={profile?.club_id ?? ''}
    />
  );
}
