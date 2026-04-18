"use client";

import { useMemo, useState } from "react";
import { Shuffle, UserPlus, X, AlertTriangle, Clock } from "lucide-react";
import AbilityBadge from "@/components/ui/AbilityBadge";
import GoalkeeperBadge from "@/components/ui/GoalkeeperBadge";
import SiblingBadge from "@/components/ui/SiblingBadge";
import { createClient } from "@/lib/supabase/client";
import { balanceTeams, isGoalkeeper } from "@/lib/engines/teamBalancer";
import type { Attendance, Coach, Player, Team, TeamPlayer } from "@/lib/types/database";

type Props = {
  clubId: string;
  sessionId: string;
  numTeams: number;
  players: Player[];
  attendance: Attendance[];
  teams: Team[];
  teamPlayers: TeamPlayer[];
  coaches: Coach[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  setTeamPlayers: React.Dispatch<React.SetStateAction<TeamPlayer[]>>;
  readOnly?: boolean;
};

type SelectedSlot = { teamId: string; playerId: string };

export default function TeamsTab({
  clubId,
  sessionId,
  players,
  attendance,
  teams,
  teamPlayers,
  coaches,
  setTeams,
  setTeamPlayers,
  readOnly = false,
}: Props) {
  const supabase = createClient();
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<{ teamId: string } | null>(null);

  const availablePlayers = useMemo(() => {
    const ids = new Set(
      attendance.filter((a) => a.status === "present").map((a) => a.player_id)
    );
    return players.filter((p) => ids.has(p.id));
  }, [players, attendance]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const byTeam = useMemo(() => {
    const map = new Map<string, Player[]>();
    for (const t of teams) map.set(t.id, []);
    for (const tp of teamPlayers) {
      const p = playerById.get(tp.player_id);
      if (!p) continue;
      map.get(tp.team_id)?.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.first_name.localeCompare(b.first_name));
    }
    return map;
  }, [teams, teamPlayers, playerById]);

  const unassigned = useMemo(() => {
    const assigned = new Set(teamPlayers.map((tp) => tp.player_id));
    return availablePlayers.filter((p) => !assigned.has(p.id));
  }, [availablePlayers, teamPlayers]);

  async function autoGenerate() {
    if (readOnly) return;
    if (availablePlayers.length === 0) {
      alert("Mark some players available first.");
      return;
    }
    if (
      teamPlayers.length > 0 &&
      !confirm("Replace existing team assignments with a fresh auto-balance?")
    ) {
      return;
    }
    setBusy(true);
    const balanced = balanceTeams(availablePlayers, teams);

    await supabase.from("team_players").delete().in(
      "team_id",
      teams.map((t) => t.id)
    );

    const rows: { team_id: string; player_id: string; club_id: string }[] = [];
    balanced.forEach((teamPlayersList, teamId) => {
      for (const p of teamPlayersList) {
        rows.push({ team_id: teamId, player_id: p.id, club_id: clubId });
      }
    });
    const { data } = await supabase.from("team_players").insert(rows).select("*");
    setTeamPlayers((data ?? []) as TeamPlayer[]);
    setBusy(false);
    setSelected(null);
  }

  async function swap(a: SelectedSlot, b: SelectedSlot) {
    const rowA = teamPlayers.find(
      (tp) => tp.team_id === a.teamId && tp.player_id === a.playerId
    );
    const rowB = teamPlayers.find(
      (tp) => tp.team_id === b.teamId && tp.player_id === b.playerId
    );
    if (!rowA || !rowB) return;

    setTeamPlayers((list) =>
      list.map((tp) => {
        if (tp.id === rowA.id) return { ...tp, team_id: b.teamId };
        if (tp.id === rowB.id) return { ...tp, team_id: a.teamId };
        return tp;
      })
    );
    setSelected(null);

    await Promise.all([
      supabase.from("team_players").update({ team_id: b.teamId }).eq("id", rowA.id),
      supabase.from("team_players").update({ team_id: a.teamId }).eq("id", rowB.id),
    ]);
  }

  async function removeFromTeam(slot: SelectedSlot) {
    const row = teamPlayers.find(
      (tp) => tp.team_id === slot.teamId && tp.player_id === slot.playerId
    );
    if (!row) return;
    setTeamPlayers((list) => list.filter((tp) => tp.id !== row.id));
    setSelected(null);
    await supabase.from("team_players").delete().eq("id", row.id);
  }

  async function addToTeam(teamId: string, player: Player) {
    const { data } = await supabase
      .from("team_players")
      .insert({ team_id: teamId, player_id: player.id, club_id: clubId })
      .select("*")
      .single();
    if (data) setTeamPlayers((list) => [...list, data as TeamPlayer]);
    setAdding(null);
  }

  function onSlotTap(slot: SelectedSlot) {
    if (readOnly) return;
    if (!selected) {
      setSelected(slot);
      return;
    }
    if (selected.teamId === slot.teamId && selected.playerId === slot.playerId) {
      setSelected(null);
      return;
    }
    if (selected.teamId === slot.teamId) {
      setSelected(slot); // re-pick within same team
      return;
    }
    swap(selected, slot);
  }

  async function updateTeam(teamId: string, patch: Partial<Team>) {
    if (readOnly) return;
    setTeams((list) => list.map((t) => (t.id === teamId ? { ...t, ...patch } : t)));
    await supabase.from("teams").update(patch).eq("id", teamId);
  }

  if (teams.length === 0) {
    return (
      <div className="card text-sm text-slate-400">
        No teams on this session yet.
      </div>
    );
  }

  const totalGks = availablePlayers.filter(isGoalkeeper).length;

  return (
    <>
      {!readOnly && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={autoGenerate}
            disabled={busy || availablePlayers.length === 0}
            className="btn-primary flex-1"
          >
            <Shuffle className="w-5 h-5" />
            {busy ? "Balancing…" : "Auto-generate"}
          </button>
        </div>
      )}
      {!readOnly && totalGks > 0 && totalGks < teams.length && (
        <div className="card mb-4 border-amber-500/40 bg-amber-500/5 flex items-start gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Only {totalGks} goalkeeper{totalGks === 1 ? "" : "s"} available for{" "}
            {teams.length} teams. Some teams will need an outfield player to go in
            goal.
          </div>
        </div>
      )}

      {selected && (
        <div className="sticky top-[116px] z-10 mb-3 card border-emerald-500/40 bg-emerald-500/10">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-emerald-300">
              Selected: {playerById.get(selected.playerId)?.first_name}{" "}
              {playerById.get(selected.playerId)?.last_name}. Tap another player to
              swap.
            </span>
            <button
              onClick={() => removeFromTeam(selected)}
              className="btn-danger h-9 min-h-0 px-3 text-xs"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="card mb-4 border-amber-500/30">
          <div className="text-xs text-amber-300 font-semibold uppercase tracking-wide mb-2">
            Unassigned ({unassigned.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <span
                key={p.id}
                className="chip border bg-bg-elevated border-border text-slate-200"
              >
                {p.first_name} {p.last_name[0]}.
              </span>
            ))}
          </div>
        </div>
      )}

      {(() => {
        // Group teams by slot_number, in slot order
        const slotMap = new Map<number, Team[]>();
        for (const t of teams) {
          const s = t.slot_number ?? 1;
          if (!slotMap.has(s)) slotMap.set(s, []);
          slotMap.get(s)!.push(t);
        }
        const slotEntries = Array.from(slotMap.entries()).sort(([a], [b]) => a - b);

        async function updateSlotLabel(slot: number, label: string) {
          if (readOnly) return;
          // Update every team in this slot with the new label
          setTeams((list) =>
            list.map((t) =>
              (t.slot_number ?? 1) === slot ? { ...t, slot_label: label } : t
            )
          );
          await supabase
            .from("teams")
            .update({ slot_label: label })
            .eq("session_id", sessionId)
            .eq("slot_number", slot);
        }

        return slotEntries.map(([slotNumber, slotTeams]) => {
          const label = slotTeams[0]?.slot_label ?? `Slot ${slotNumber}`;
          const slotPlayerCount = slotTeams.reduce(
            (n, t) => n + (byTeam.get(t.id)?.length ?? 0),
            0
          );
          return (
            <section key={slotNumber} className="mb-5">
              {slotEntries.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    disabled={readOnly}
                    className="bg-transparent text-sm font-semibold text-slate-200 border-b border-transparent focus:border-border-strong focus:outline-none flex-1 min-w-0 disabled:opacity-100 disabled:cursor-default"
                    value={label}
                    onChange={(e) => updateSlotLabel(slotNumber, e.target.value)}
                  />
                  <span className="text-xs text-slate-500 shrink-0">
                    {slotTeams.length} team{slotTeams.length === 1 ? "" : "s"} ·{" "}
                    {slotPlayerCount} player{slotPlayerCount === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {slotTeams.map((team) => {
                  const teamPlayersList = byTeam.get(team.id) ?? [];
                  const hasGk = teamPlayersList.some(isGoalkeeper);
                  const counts = {
                    Advanced: teamPlayersList.filter((p) => p.ability_category === "Advanced").length,
                    Intermediate: teamPlayersList.filter((p) => p.ability_category === "Intermediate").length,
                    Developing: teamPlayersList.filter((p) => p.ability_category === "Developing").length,
                  };
                  return (
                    <div key={team.id} className="card">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: team.team_colour ?? "#64748b" }}
                        />
                        <input
                          disabled={readOnly}
                          className="bg-transparent border-b border-transparent focus:border-border-strong focus:outline-none font-bold text-base flex-1 min-w-0 disabled:opacity-100 disabled:cursor-default"
                          value={team.team_name}
                          onChange={(e) => updateTeam(team.id, { team_name: e.target.value })}
                        />
                        <span className="text-xs text-slate-400 shrink-0">
                          {teamPlayersList.length}
                        </span>
                      </div>
                      <select
                        disabled={readOnly}
                        className="input h-9 min-h-0 text-sm mb-2 disabled:opacity-100"
                        value={team.coach_id ?? ""}
                        onChange={(e) =>
                          updateTeam(team.id, {
                            coach_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">No coach assigned</option>
                        {coaches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.first_name} {c.last_name}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
                        <span>Adv {counts.Advanced}</span>
                        <span>·</span>
                        <span>Int {counts.Intermediate}</span>
                        <span>·</span>
                        <span>Dev {counts.Developing}</span>
                      </div>
                      {teamPlayersList.length > 0 && !hasGk && (
                        <div className="mb-2 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          No goalkeeper assigned
                        </div>
                      )}
                      {teamPlayersList.length === 0 ? (
                        <div className="text-xs text-slate-500 text-center py-3">
                          No players assigned yet.
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          {teamPlayersList.map((p) => {
                            const isSelected =
                              selected?.teamId === team.id && selected?.playerId === p.id;
                            const gk = isGoalkeeper(p);
                            return (
                              <li key={p.id}>
                                <button
                                  disabled={readOnly}
                                  onClick={() =>
                                    onSlotTap({ teamId: team.id, playerId: p.id })
                                  }
                                  className={`w-full min-h-tap flex items-center justify-between gap-2 rounded-lg px-3 border text-left disabled:cursor-default ${
                                    isSelected
                                      ? "bg-emerald-500/20 border-emerald-500/40"
                                      : gk
                                      ? "bg-sky-500/10 border-sky-500/30 hover:border-sky-500/50"
                                      : "bg-bg-elevated border-border hover:border-border-strong"
                                  }`}
                                >
                                  <span className="truncate text-sm font-medium flex items-center gap-1.5 min-w-0">
                                    {gk && <GoalkeeperBadge compact />}
                                    <span className="truncate">
                                      {p.first_name} {p.last_name}
                                    </span>
                                    {p.pair_group && <SiblingBadge group={p.pair_group} />}
                                  </span>
                                  <AbilityBadge category={p.ability_category} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => setAdding({ teamId: team.id })}
                          className="btn-ghost w-full mt-2 h-9 min-h-0 text-sm"
                        >
                          <UserPlus className="w-4 h-4" /> Add player
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        });
      })()}

      {adding && (
        <AddPlayerDialog
          availablePlayers={players.filter(
            (p) => !teamPlayers.some((tp) => tp.player_id === p.id)
          )}
          onPick={(p) => addToTeam(adding.teamId, p)}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  );
}

function AddPlayerDialog({
  availablePlayers,
  onPick,
  onClose,
}: {
  availablePlayers: Player[];
  onPick: (p: Player) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Add player to team</h3>
          <button onClick={onClose} className="btn-ghost w-tap h-tap p-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {availablePlayers.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Every active player is already on a team.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {availablePlayers.map((p) => {
              const gk = isGoalkeeper(p);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onPick(p)}
                    className={`w-full min-h-tap flex items-center justify-between gap-2 rounded-lg px-3 border text-left hover:border-border-strong ${
                      gk
                        ? "bg-sky-500/10 border-sky-500/30"
                        : "bg-bg-elevated border-border"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {gk && <GoalkeeperBadge compact />}
                      <span className="truncate">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.pair_group && <SiblingBadge group={p.pair_group} />}
                    </span>
                    <AbilityBadge category={p.ability_category} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
