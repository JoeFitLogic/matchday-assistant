"use client";

import { useMemo, useState } from "react";
import AvailabilityTab from "./AvailabilityTab";
import TeamsTab from "./TeamsTab";
import FixturesTab from "./FixturesTab";
import SessionReadiness from "./SessionReadiness";
import DeleteSessionButton from "./DeleteSessionButton";
import type {
  Attendance,
  Coach,
  Match,
  Player,
  Session,
  Team,
  TeamPlayer,
} from "@/lib/types/database";

type Tab = "availability" | "teams" | "fixtures";

export default function SessionDetail({
  clubId,
  session,
  initialPlayers,
  initialTeams,
  initialTeamPlayers,
  initialAttendance,
  initialMatches,
  coaches,
}: {
  clubId: string;
  session: Session;
  initialPlayers: Player[];
  initialTeams: Team[];
  initialTeamPlayers: TeamPlayer[];
  initialAttendance: Attendance[];
  initialMatches: Match[];
  coaches: Coach[];
}) {
  const [tab, setTab] = useState<Tab>("availability");
  const [players] = useState<Player[]>(initialPlayers);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>(initialTeamPlayers);
  const [attendance, setAttendance] = useState<Attendance[]>(initialAttendance);
  const [matches, setMatches] = useState<Match[]>(initialMatches);

  const readOnly = session.status === "ready" || session.status === "live";

  const availableCount = useMemo(
    () => attendance.filter((a) => a.status === "present").length,
    [attendance]
  );

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: "availability", label: "Availability", badge: `${availableCount}/${players.length}` },
    { key: "teams", label: "Teams" },
    { key: "fixtures", label: "Fixtures" },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <span className="uppercase font-semibold text-slate-300">{session.format}</span>
        <span>·</span>
        <span>{session.match_length_minutes}m matches</span>
        <span>·</span>
        <span>{session.num_teams} teams</span>
      </div>

      <div className="sticky top-14 z-20 -mx-4 px-4 bg-bg-base/95 backdrop-blur border-b border-border mb-4">
        <div className="grid grid-cols-3 gap-1 py-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`min-h-tap rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${
                tab === t.key
                  ? "bg-bg-elevated text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {t.label}
              {t.badge && (
                <span className="text-xs font-normal text-slate-500">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "availability" && (
        <AvailabilityTab
          clubId={clubId}
          sessionId={session.id}
          players={players}
          attendance={attendance}
          setAttendance={setAttendance}
          readOnly={readOnly}
        />
      )}

      {tab === "teams" && (
        <TeamsTab
          clubId={clubId}
          sessionId={session.id}
          numTeams={session.num_teams}
          players={players}
          attendance={attendance}
          teams={teams}
          teamPlayers={teamPlayers}
          coaches={coaches}
          setTeams={setTeams}
          setTeamPlayers={setTeamPlayers}
          readOnly={readOnly}
        />
      )}

      {tab === "fixtures" && (
        <FixturesTab
          clubId={clubId}
          sessionId={session.id}
          teams={teams}
          matches={matches}
          matchLengthMinutes={session.match_length_minutes}
          setMatches={setMatches}
          readOnly={readOnly}
        />
      )}

      <SessionReadiness
        sessionId={session.id}
        status={session.status}
        teams={teams}
        teamPlayers={teamPlayers}
        players={players}
        matches={matches}
      />

      <div className="mt-6 pt-6 border-t border-border">
        <DeleteSessionButton sessionId={session.id} teamIds={teams.map((t) => t.id)} />
      </div>
    </>
  );
}
