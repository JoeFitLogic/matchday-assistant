import AppShell from "@/components/layout/AppShell";
import CoachesView from "./CoachesView";
import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  const { clubId } = await getCoachContext();
  const supabase = createClient();
  const { data: coaches } = await supabase
    .from("coaches")
    .select("*")
    .eq("club_id", clubId)
    .order("first_name", { ascending: true });

  return (
    <AppShell title="Coaches">
      <CoachesView clubId={clubId} initialCoaches={coaches ?? []} />
    </AppShell>
  );
}
