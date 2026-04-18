"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Match, Team } from "@/lib/types/database";

const DEFAULT_GAMES_PER_TEAM = 5;

export default function FixturesTab({
  clubId,
  sessionId,
  teams,
  matches,
  setMatches,
}: {
  clubId: string;
  sessionId: string;
  teams: Team[];
  matches: Match[];
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  const byTeam = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const t of teams) map.set(t.id, []);
    for (const m of matches) {
      if (m.home_team_id && map.has(m.home_team_id)) {
        map.get(m.home_team_id)!.push(m);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.match_number - b.match_number);
    }
    return map;
  }, [teams, matches]);

  async function ensureDefaultFixtures(team: Team) {
    setBusy(team.id);
    const existing = byTeam.get(team.id) ?? [];
    const existingNumbers = new Set(existing.map((m) => m.match_number));
    const rows = [];
    for (let n = 1; n <= DEFAULT_GAMES_PER_TEAM; n++) {
      if (existingNumbers.has(n)) continue;
      rows.push({
        session_id: sessionId,
        club_id: clubId,
        home_team_id: team.id,
        match_number: n,
        status: "scheduled" as const,
      });
    }
    if (rows.length === 0) {
      setBusy(null);
      return;
    }
    const { data } = await supabase.from("matches").insert(rows).select("*");
    if (data) setMatches((list) => [...list, ...(data as Match[])]);
    setBusy(null);
  }

  async function updateMatch(match: Match, patch: Partial<Match>) {
    setMatches((list) => list.map((m) => (m.id === match.id ? { ...m, ...patch } : m)));
    await supabase.from("matches").update(patch).eq("id", match.id);
  }

  async function deleteMatch(match: Match) {
    setMatches((list) => list.filter((m) => m.id !== match.id));
    await supabase.from("matches").delete().eq("id", match.id);
  }

  async function addMatch(team: Team) {
    const existing = byTeam.get(team.id) ?? [];
    const nextNum = (existing.at(-1)?.match_number ?? 0) + 1;
    const { data } = await supabase
      .from("matches")
      .insert({
        session_id: sessionId,
        club_id: clubId,
        home_team_id: team.id,
        match_number: nextNum,
        status: "scheduled",
      })
      .select("*")
      .single();
    if (data) setMatches((list) => [...list, data as Match]);
  }

  return (
    <div className="space-y-4">
      {teams.map((team) => {
        const teamMatches = byTeam.get(team.id) ?? [];
        return (
          <div key={team.id} className="card">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: team.team_colour ?? "#64748b" }}
              />
              <div className="font-bold flex-1 truncate">{team.team_name}</div>
              {teamMatches.length === 0 && (
                <button
                  onClick={() => ensureDefaultFixtures(team)}
                  disabled={busy === team.id}
                  className="btn-primary h-9 min-h-0 px-3 text-sm"
                >
                  {busy === team.id ? "…" : "Add 5 games"}
                </button>
              )}
            </div>
            {teamMatches.length === 0 ? (
              <p className="text-xs text-slate-500">No fixtures yet.</p>
            ) : (
              <ul className="space-y-2">
                {teamMatches.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-sm font-bold text-slate-300 shrink-0">
                      {m.match_number}
                    </div>
                    <input
                      placeholder="Opponent"
                      value={m.opponent_name ?? ""}
                      onChange={(e) =>
                        updateMatch(m, { opponent_name: e.target.value || null })
                      }
                      className="input h-10 min-h-0 text-sm flex-1"
                    />
                    <input
                      type="number"
                      placeholder="Pitch"
                      min={1}
                      value={m.pitch_number ?? ""}
                      onChange={(e) =>
                        updateMatch(m, {
                          pitch_number: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="input h-10 min-h-0 text-sm w-16 text-center"
                    />
                    <button
                      onClick={() => deleteMatch(m)}
                      className="btn-ghost w-tap h-tap p-0 text-slate-500"
                      aria-label="Delete fixture"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => addMatch(team)}
                    className="btn-ghost w-full h-9 min-h-0 text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add another game
                  </button>
                </li>
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
