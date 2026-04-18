"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SessionFormat } from "@/lib/types/database";

const FORMATS: { value: SessionFormat; label: string; defaultLen: number; defaultSub: number }[] = [
  { value: "5v5", label: "5-a-side", defaultLen: 10, defaultSub: 3 },
  { value: "7v7", label: "7-a-side", defaultLen: 20, defaultSub: 5 },
  { value: "9v9", label: "9-a-side", defaultLen: 25, defaultSub: 5 },
  { value: "11v11", label: "11-a-side", defaultLen: 30, defaultSub: 10 },
];

const TEAM_COLOURS = ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899"];

const DEFAULT_SLOT_LABELS = ["6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
const MAX_SLOTS = 4;
const MAX_TEAMS_PER_SLOT = 4;

function defaultLabelFor(slotIndex: number): string {
  return DEFAULT_SLOT_LABELS[slotIndex] ?? `Slot ${slotIndex + 1}`;
}

type SlotConfig = { label: string; teams: number };

export default function NewSessionForm({
  clubId,
  seasonId,
  clubName,
}: {
  clubId: string;
  seasonId: string | null;
  clubName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [venue, setVenue] = useState("");
  const [format, setFormat] = useState<SessionFormat>("5v5");
  const [matchLen, setMatchLen] = useState(10);
  const [subInterval, setSubInterval] = useState(3);
  const [slots, setSlots] = useState<SlotConfig[]>([
    { label: "6:00 PM", teams: 2 },
    { label: "7:00 PM", teams: 2 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setNumSlots(n: number) {
    setSlots((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ label: defaultLabelFor(next.length), teams: 2 });
      next.length = n;
      return next;
    });
  }

  function updateSlot(i: number, patch: Partial<SlotConfig>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  const totalTeams = slots.reduce((n, s) => n + s.teams, 0);

  function pickFormat(f: SessionFormat) {
    setFormat(f);
    const def = FORMATS.find((x) => x.value === f)!;
    setMatchLen(def.defaultLen);
    setSubInterval(def.defaultSub);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!seasonId) {
      setError("No active season for this club. Ask admin to create one.");
      return;
    }
    if (totalTeams === 0) {
      setError("Need at least 1 team across all slots.");
      return;
    }

    setSaving(true);

    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .insert({
        club_id: clubId,
        season_id: seasonId,
        session_date: date,
        notes: venue.trim() || null,
        status: "draft",
        format,
        match_length_minutes: matchLen,
        sub_interval_minutes: subInterval,
        num_teams: totalTeams,
      })
      .select("*")
      .single();

    if (sErr || !session) {
      setSaving(false);
      setError(sErr?.message ?? "Could not create session");
      return;
    }

    // Build team rows from the per-slot config.
    const teamRows: {
      club_id: string;
      session_id: string;
      team_name: string;
      team_colour: string;
      slot_number: number;
      slot_label: string;
    }[] = [];
    let teamIdx = 0;
    slots.forEach((slot, slotIdx) => {
      for (let inSlot = 0; inSlot < slot.teams; inSlot++) {
        teamRows.push({
          club_id: clubId,
          session_id: session.id,
          team_name: `${clubName} ${teamIdx + 1}`,
          team_colour: TEAM_COLOURS[teamIdx % TEAM_COLOURS.length],
          slot_number: slotIdx + 1,
          slot_label: slot.label || defaultLabelFor(slotIdx),
        });
        teamIdx++;
      }
    });

    const { error: tErr } = await supabase.from("teams").insert(teamRows);
    if (tErr) {
      setSaving(false);
      setError(tErr.message);
      return;
    }

    router.replace(`/session/${session.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Session date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Venue / notes</label>
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Livingston Stadium 3G"
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Format</label>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button
              type="button"
              key={f.value}
              onClick={() => pickFormat(f.value)}
              className={`min-h-tap rounded-lg border text-sm font-semibold ${
                format === f.value
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-bg-elevated border-border text-slate-300"
              }`}
            >
              <div>{f.value.toUpperCase()}</div>
              <div className="text-xs text-slate-400 font-normal">{f.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Time slots</label>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setNumSlots(n)}
                className={`min-h-tap rounded-lg border font-bold ${
                  slots.length === n
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-bg-elevated border-border text-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {slots.map((slot, i) => (
            <div key={i} className="card space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  value={slot.label}
                  onChange={(e) => updateSlot(i, { label: e.target.value })}
                  placeholder={defaultLabelFor(i)}
                  className="input h-10 min-h-0 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Teams in this slot
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: MAX_TEAMS_PER_SLOT }, (_, n) => n + 1).map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => updateSlot(i, { teams: n })}
                      className={`min-h-tap rounded-lg border font-bold text-sm ${
                        slot.teams === n
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-bg-elevated border-border text-slate-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-400 bg-bg-elevated border border-border rounded-lg px-3 py-2">
          Total: <span className="text-slate-100 font-semibold">{totalTeams}</span>{" "}
          team{totalTeams === 1 ? "" : "s"} across{" "}
          <span className="text-slate-100 font-semibold">{slots.length}</span> slot
          {slots.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Match length (min)</label>
          <input
            type="number"
            min={5}
            max={90}
            value={matchLen}
            onChange={(e) => setMatchLen(Number(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Sub interval (min)</label>
          <input
            type="number"
            min={1}
            max={matchLen}
            value={subInterval}
            onChange={(e) => setSubInterval(Number(e.target.value))}
            className="input"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "Creating…" : "Create session"}
      </button>
    </form>
  );
}
