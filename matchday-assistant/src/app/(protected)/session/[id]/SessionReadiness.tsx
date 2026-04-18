"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, Lock, Unlock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isGoalkeeper } from "@/lib/engines/teamBalancer";
import type { Match, Player, Team, TeamPlayer, SessionStatus } from "@/lib/types/database";

type CheckSeverity = "pass" | "warn" | "fail";
type Check = { key: string; label: string; severity: CheckSeverity };

export default function SessionReadiness({
  sessionId,
  status,
  teams,
  teamPlayers,
  players,
  matches,
}: {
  sessionId: string;
  status: SessionStatus;
  teams: Team[];
  teamPlayers: TeamPlayer[];
  players: Player[];
  matches: Match[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const checks: Check[] = [];

  // Every team has at least 4 players
  const emptyTeams = teams.filter(
    (t) => teamPlayers.filter((tp) => tp.team_id === t.id).length < 4
  );
  checks.push({
    key: "teams-size",
    label:
      emptyTeams.length === 0
        ? `All ${teams.length} teams have 4+ players`
        : `${emptyTeams.length} team${emptyTeams.length === 1 ? "" : "s"} need more players`,
    severity: emptyTeams.length === 0 ? "pass" : "fail",
  });

  // Every team has a goalkeeper
  const teamsWithoutGk = teams.filter((t) => {
    const tpList = teamPlayers.filter((tp) => tp.team_id === t.id);
    return !tpList.some((tp) => {
      const p = playerById.get(tp.player_id);
      return p && isGoalkeeper(p);
    });
  });
  checks.push({
    key: "gk-every-team",
    label:
      teamsWithoutGk.length === 0
        ? "Every team has a goalkeeper"
        : `${teamsWithoutGk.length} team${teamsWithoutGk.length === 1 ? "" : "s"} without a goalkeeper`,
    severity: teamsWithoutGk.length === 0 ? "pass" : "warn",
  });

  // Every match has an opponent
  const matchesWithoutOpponent = matches.filter(
    (m) => !m.opponent_name || m.opponent_name.trim() === ""
  );
  checks.push({
    key: "fixtures",
    label:
      matches.length === 0
        ? "No fixtures added yet"
        : matchesWithoutOpponent.length === 0
        ? `All ${matches.length} fixtures have an opponent`
        : `${matchesWithoutOpponent.length} fixture${matchesWithoutOpponent.length === 1 ? "" : "s"} need an opponent`,
    severity:
      matches.length === 0
        ? "fail"
        : matchesWithoutOpponent.length === 0
        ? "pass"
        : "warn",
  });

  const canMarkReady = !checks.some((c) => c.severity === "fail");

  async function markReady() {
    setBusy(true);
    await supabase.from("sessions").update({ status: "ready" }).eq("id", sessionId);
    setBusy(false);
    router.refresh();
  }

  async function unlock() {
    setBusy(true);
    await supabase.from("sessions").update({ status: "draft" }).eq("id", sessionId);
    setBusy(false);
    router.refresh();
  }

  if (status === "ready") {
    return (
      <div className="mt-6 card border-emerald-500/40 bg-emerald-500/10">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-emerald-200">Session is ready to play</div>
            <div className="text-xs text-emerald-300/80 mt-0.5">
              Teams and fixtures are locked. Unlock if you need to make a change.
            </div>
          </div>
          <button
            onClick={unlock}
            disabled={busy}
            className="btn-secondary h-9 min-h-0 px-3 text-sm shrink-0"
          >
            <Unlock className="w-4 h-4" /> Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Ready to play?
      </h2>
      <div className="card space-y-2">
        {checks.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-sm">
            {c.severity === "pass" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : c.severity === "warn" ? (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-500 shrink-0" />
            )}
            <span
              className={
                c.severity === "pass"
                  ? "text-slate-200"
                  : c.severity === "warn"
                  ? "text-amber-200"
                  : "text-slate-400"
              }
            >
              {c.label}
            </span>
          </div>
        ))}
        <button
          onClick={markReady}
          disabled={!canMarkReady || busy}
          className="btn-primary w-full mt-3"
        >
          <Lock className="w-5 h-5" />
          {busy ? "Saving…" : canMarkReady ? "Mark session as ready" : "Resolve the issues above"}
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          Ready sessions are locked from edits until you unlock them.
        </p>
      </div>
    </section>
  );
}
