"use client";

import { useMemo, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import AbilityBadge from "@/components/ui/AbilityBadge";
import GoalkeeperBadge from "@/components/ui/GoalkeeperBadge";
import PlayerFormDialog from "./PlayerFormDialog";
import { createClient } from "@/lib/supabase/client";
import type { Player } from "@/lib/types/database";

export default function PlayersView({
  clubId,
  initialPlayers,
}: {
  clubId: string;
  initialPlayers: Player[];
}) {
  const supabase = createClient();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [editing, setEditing] = useState<Player | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");

  const filtered = useMemo(() => {
    if (filter === "all") return players;
    return players.filter((p) => (filter === "active" ? p.is_active : !p.is_active));
  }, [players, filter]);

  async function toggleActive(p: Player) {
    const next = !p.is_active;
    setPlayers((list) =>
      list.map((x) => (x.id === p.id ? { ...x, is_active: next } : x))
    );
    await supabase.from("players").update({ is_active: next }).eq("id", p.id);
  }

  function upsertLocal(player: Player) {
    setPlayers((list) => {
      const idx = list.findIndex((p) => p.id === player.id);
      if (idx === -1) return [...list, player].sort((a, b) => a.first_name.localeCompare(b.first_name));
      const copy = [...list];
      copy[idx] = player;
      return copy;
    });
  }

  const activeCount = players.filter((p) => p.is_active).length;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-400">
          <span className="text-slate-100 font-semibold">{activeCount}</span> active ·{" "}
          {players.length} total
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary h-9 min-h-0 px-3 text-sm">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {(["active", "inactive", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip border capitalize ${
              filter === f
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-bg-surface text-slate-400 border-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-slate-400 mb-3">No players in this view.</p>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <UserPlus className="w-5 h-5" /> Add first player
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li key={p.id} className="card flex items-center justify-between gap-3">
              <button
                onClick={() => setEditing(p)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-slate-300 font-semibold shrink-0">
                  {p.first_name[0]}
                  {p.last_name[0]}
                </div>
                <div className="min-w-0">
                  <div className={`font-semibold truncate ${!p.is_active ? "text-slate-500" : ""}`}>
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <AbilityBadge category={p.ability_category} />
                    {(p.preferred_position ?? "").toUpperCase() === "GK" && (
                      <GoalkeeperBadge compact />
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={() => toggleActive(p)}
                className={`chip border ${
                  p.is_active
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                }`}
              >
                {p.is_active ? "Active" : "Inactive"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <PlayerFormDialog
          clubId={clubId}
          player={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(p) => {
            upsertLocal(p);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
