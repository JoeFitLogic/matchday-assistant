"use client";

import { Check, Minus } from "lucide-react";
import AbilityBadge from "@/components/ui/AbilityBadge";
import { createClient } from "@/lib/supabase/client";
import type { Attendance, Player } from "@/lib/types/database";

export default function AvailabilityTab({
  clubId,
  sessionId,
  players,
  attendance,
  setAttendance,
  readOnly = false,
}: {
  clubId: string;
  sessionId: string;
  players: Player[];
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const indexByPlayer = new Map(attendance.map((a) => [a.player_id, a]));

  async function setStatus(player: Player, status: "present" | "absent") {
    if (readOnly) return;
    const existing = indexByPlayer.get(player.id);

    if (existing) {
      setAttendance((list) =>
        list.map((a) => (a.id === existing.id ? { ...a, status } : a))
      );
      await supabase.from("attendance").update({ status }).eq("id", existing.id);
      return;
    }

    const temp: Attendance = {
      id: `tmp-${player.id}`,
      session_id: sessionId,
      player_id: player.id,
      club_id: clubId,
      status,
      arrived_at: null,
    };
    setAttendance((list) => [...list, temp]);
    const { data } = await supabase
      .from("attendance")
      .insert({
        session_id: sessionId,
        player_id: player.id,
        club_id: clubId,
        status,
      })
      .select("*")
      .single();
    if (data) {
      setAttendance((list) => list.map((a) => (a.id === temp.id ? (data as Attendance) : a)));
    }
  }

  async function setAll(status: "present" | "absent") {
    await Promise.all(players.map((p) => setStatus(p, status)));
  }

  if (players.length === 0) {
    return (
      <div className="card text-sm text-slate-400 text-center py-6">
        No active players in the squad. Add some in the Squad tab first.
      </div>
    );
  }

  return (
    <>
      {!readOnly && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => setAll("present")} className="btn-secondary h-9 min-h-0 px-3 text-sm flex-1">
            Mark all available
          </button>
          <button onClick={() => setAll("absent")} className="btn-ghost h-9 min-h-0 px-3 text-sm flex-1">
            Clear all
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {players.map((p) => {
          const a = indexByPlayer.get(p.id);
          const present = a?.status === "present";
          return (
            <li
              key={p.id}
              className={`card flex items-center gap-3 ${
                present ? "border-emerald-500/30" : ""
              }`}
            >
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-slate-300 font-semibold shrink-0">
                  {p.first_name[0]}
                  {p.last_name[0]}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="mt-0.5">
                    <AbilityBadge category={p.ability_category} />
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  aria-label="Absent"
                  disabled={readOnly}
                  onClick={() => setStatus(p, "absent")}
                  className={`w-tap h-tap rounded-lg flex items-center justify-center border disabled:cursor-default ${
                    a?.status === "absent"
                      ? "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-bg-elevated border-border text-slate-500"
                  }`}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  aria-label="Available"
                  disabled={readOnly}
                  onClick={() => setStatus(p, "present")}
                  className={`w-tap h-tap rounded-lg flex items-center justify-center border disabled:cursor-default ${
                    present
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-bg-elevated border-border text-slate-500"
                  }`}
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
