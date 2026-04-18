import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import SessionDetail from "./SessionDetail";
import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/club";
import { formatUKDate } from "@/lib/utils";
import type {
  Attendance,
  Match,
  Player,
  Session,
  Team,
  TeamPlayer,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({ params }: { params: { id: string } }) {
  const { clubId } = await getCoachContext();
  const supabase = createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!session) notFound();

  const [playersRes, teamsRes, teamPlayersRes, attendanceRes, matchesRes] =
    await Promise.all([
      supabase.from("players").select("*").eq("club_id", clubId).eq("is_active", true),
      supabase
        .from("teams")
        .select("*")
        .eq("session_id", session.id)
        .order("slot_number", { ascending: true })
        .order("team_name", { ascending: true }),
      supabase.from("team_players").select("*").eq("club_id", clubId),
      supabase.from("attendance").select("*").eq("session_id", session.id),
      supabase.from("matches").select("*").eq("session_id", session.id),
    ]);

  const teams = (teamsRes.data ?? []) as Team[];
  const teamIds = new Set(teams.map((t) => t.id));
  const teamPlayers = ((teamPlayersRes.data ?? []) as TeamPlayer[]).filter((tp) =>
    teamIds.has(tp.team_id)
  );

  return (
    <AppShell title={formatUKDate(session.session_date)}>
      <SessionDetail
        clubId={clubId}
        session={session as Session}
        initialPlayers={(playersRes.data ?? []) as Player[]}
        initialTeams={teams}
        initialTeamPlayers={teamPlayers}
        initialAttendance={(attendanceRes.data ?? []) as Attendance[]}
        initialMatches={(matchesRes.data ?? []) as Match[]}
      />
    </AppShell>
  );
}
