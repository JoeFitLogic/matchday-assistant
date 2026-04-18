import AppShell from "@/components/layout/AppShell";
import NewSessionForm from "./NewSessionForm";
import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function NewSessionPage() {
  const { clubId, activeSeasonId } = await getCoachContext();
  const supabase = createClient();

  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();

  return (
    <AppShell title="New session">
      <NewSessionForm
        clubId={clubId}
        seasonId={activeSeasonId}
        clubName={club?.name ?? "Team"}
      />
    </AppShell>
  );
}
