"use client";

import { useMemo, useState } from "react";
import { Plus, UserPlus, Mail, Phone } from "lucide-react";
import CoachFormDialog from "./CoachFormDialog";
import { createClient } from "@/lib/supabase/client";
import type { Coach } from "@/lib/types/database";

export default function CoachesView({
  clubId,
  initialCoaches,
}: {
  clubId: string;
  initialCoaches: Coach[];
}) {
  const supabase = createClient();
  const [coaches, setCoaches] = useState<Coach[]>(initialCoaches);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"active" | "inactive" | "all">("active");

  const filtered = useMemo(() => {
    if (filter === "all") return coaches;
    return coaches.filter((c) => (filter === "active" ? c.is_active : !c.is_active));
  }, [coaches, filter]);

  async function toggleActive(c: Coach) {
    const next = !c.is_active;
    setCoaches((list) =>
      list.map((x) => (x.id === c.id ? { ...x, is_active: next } : x))
    );
    await supabase.from("coaches").update({ is_active: next }).eq("id", c.id);
  }

  function upsertLocal(coach: Coach) {
    setCoaches((list) => {
      const idx = list.findIndex((c) => c.id === coach.id);
      if (idx === -1)
        return [...list, coach].sort((a, b) => a.first_name.localeCompare(b.first_name));
      const copy = [...list];
      copy[idx] = coach;
      return copy;
    });
  }

  const activeCount = coaches.filter((c) => c.is_active).length;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-400">
          <span className="text-slate-100 font-semibold">{activeCount}</span> active ·{" "}
          {coaches.length} total
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
          <p className="text-slate-400 mb-3">No coaches in this view.</p>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <UserPlus className="w-5 h-5" /> Add first coach
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id} className="card flex items-center justify-between gap-3">
              <button
                onClick={() => setEditing(c)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-slate-300 font-semibold shrink-0">
                  {c.first_name[0]}
                  {c.last_name[0]}
                </div>
                <div className="min-w-0">
                  <div className={`font-semibold truncate ${!c.is_active ? "text-slate-500" : ""}`}>
                    {c.first_name} {c.last_name}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={() => toggleActive(c)}
                className={`chip border shrink-0 ${
                  c.is_active
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                }`}
              >
                {c.is_active ? "Active" : "Inactive"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <CoachFormDialog
          clubId={clubId}
          coach={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(c) => {
            upsertLocal(c);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
