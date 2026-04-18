import AppShell from "@/components/layout/AppShell";
import PlayersView from "./PlayersView";
import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const { clubId } = await getCoachContext();
  const supabase = createClient();
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("club_id", clubId)
    .order("first_name", { ascending: true });

  return (
    <AppShell title="Squad">
      <PlayersView clubId={clubId} initialPlayers={players ?? []} />
    </AppShell>
  );
}
