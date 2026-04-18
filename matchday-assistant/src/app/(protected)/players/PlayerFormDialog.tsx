"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AbilityCategory, Player } from "@/lib/types/database";

const ABILITIES: AbilityCategory[] = ["Advanced", "Intermediate", "Developing"];

export default function PlayerFormDialog({
  clubId,
  player,
  onClose,
  onSaved,
}: {
  clubId: string;
  player: Player | null;
  onClose: () => void;
  onSaved: (p: Player) => void;
}) {
  const supabase = createClient();
  const [firstName, setFirstName] = useState(player?.first_name ?? "");
  const [lastName, setLastName] = useState(player?.last_name ?? "");
  const [ability, setAbility] = useState<AbilityCategory>(
    player?.ability_category ?? "Intermediate"
  );
  const [dob, setDob] = useState(player?.date_of_birth ?? "");
  const [isGoalkeeper, setIsGoalkeeper] = useState(
    (player?.preferred_position ?? "").toUpperCase() === "GK"
  );
  const [pairGroup, setPairGroup] = useState(player?.pair_group ?? "");
  const [separationGroup, setSeparationGroup] = useState(player?.separation_group ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      club_id: clubId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      ability_category: ability,
      date_of_birth: dob || null,
      preferred_position: isGoalkeeper ? "GK" : null,
      pair_group: pairGroup.trim() || null,
      separation_group: separationGroup.trim() || null,
      is_active: player?.is_active ?? true,
    };

    const query = player
      ? supabase.from("players").update(payload).eq("id", player.id).select("*").single()
      : supabase.from("players").insert(payload).select("*").single();

    const { data, error } = await query;
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? "Could not save player");
      return;
    }
    onSaved(data as Player);
  }

  async function handleDelete() {
    if (!player) return;
    if (!confirm(`Remove ${player.first_name} ${player.last_name} from the squad?`)) return;
    setSaving(true);
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved({ ...player, is_active: false });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {player ? "Edit player" : "Add player"}
          </h2>
          <button onClick={onClose} className="btn-ghost w-tap h-tap p-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">First name</label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Last name</label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ability</label>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAbility(a)}
                  className={`min-h-tap rounded-lg border text-sm font-semibold ${
                    ability === a
                      ? a === "Advanced"
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : a === "Intermediate"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-bg-elevated border-border text-slate-400"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date of birth</label>
            <input
              type="date"
              value={dob ?? ""}
              onChange={(e) => setDob(e.target.value)}
              className="input"
            />
          </div>
          <label className="flex items-center gap-3 min-h-tap px-3 rounded-lg border border-border bg-bg-elevated cursor-pointer">
            <input
              type="checkbox"
              checked={isGoalkeeper}
              onChange={(e) => setIsGoalkeeper(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold">Goalkeeper</div>
              <div className="text-xs text-slate-400">
                Balancer will place one GK in each team.
              </div>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pair group</label>
              <input
                value={pairGroup ?? ""}
                onChange={(e) => setPairGroup(e.target.value)}
                placeholder="Brothers, friends…"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Separation</label>
              <input
                value={separationGroup ?? ""}
                onChange={(e) => setSeparationGroup(e.target.value)}
                placeholder="Keep apart"
                className="input"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            {player && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="btn-danger"
              >
                Delete
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : player ? "Save changes" : "Add player"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
