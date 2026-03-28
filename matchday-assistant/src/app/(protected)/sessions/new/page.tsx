import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NewSessionFlow from './NewSessionFlow';

export default async function NewSessionPage() {
  const supabase = createClient();

  // Fetch active season
  const { data: season } = await supabase
    .from('seasons')
    .select('id, name')
    .eq('is_active', true)
    .single();

  if (!season) {
    redirect('/sessions?error=no_active_season');
  }

  // Fetch all active players, sorted by first name
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name', { ascending: true })
    .order('last_name',  { ascending: true });

  if (!players || players.length < 2) {
    redirect('/sessions?error=no_players');
  }

  return (
    <NewSessionFlow
      players={players}
      seasonId={season.id}
      seasonName={season.name}
    />
  );
}
