"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

function defaultLabelFor(slotIndex: number): string {
  return DEFAULT_SLOT_LABELS[slotIndex] ?? `Slot ${slotIndex + 1}`;
}

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
  const [numSlots, setNumSlots] = useState(2);
  const [teamsPerSlot, setTeamsPerSlot] = useState(2);
  const [slotLabels, setSlotLabels] = useState<string[]>(
    DEFAULT_SLOT_LABELS.slice(0, 2)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep slotLabels array length in sync with numSlots
  useEffect(() => {
    setSlotLabels((prev) => {
      const next = [...prev];
      while (next.length < numSlots) next.push(defaultLabelFor(next.length));
      next.length = numSlots;
      return next;
    });
  }, [numSlots]);

  const totalTeams = numSlots * teamsPerSlot;

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
      setError("Need at least 1 team.");
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

    // Build team rows: each slot gets teamsPerSlot teams, numbered sequentially.
    const teamRows: {
      club_id: string;
      session_id: string;
      team_name: string;
      team_colour: string;
      slot_number: number;
      slot_label: string;
    }[] = [];
    let teamIdx = 0;
    for (let slot = 0; slot < numSlots; slot++) {
      for (let inSlot = 0; inSlot < teamsPerSlot; inSlot++) {
        teamRows.push({
          club_id: clubId,
          session_id: session.id,
          team_name: `${clubName} ${teamIdx + 1}`,
          team_colour: TEAM_COLOURS[teamIdx % TEAM_COLOURS.length],
          slot_number: slot + 1,
          slot_label: slotLabels[slot] || defaultLabelFor(slot),
        });
        teamIdx++;
      }
    }

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
            {[1, 2, 3, 4].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setNumSlots(n)}
                className={`min-h-tap rounded-lg border font-bold ${
                  numSlots === n
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-bg-elevated border-border text-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            e.g. 2 slots for 6pm + 7pm kick-offs
          </p>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Teams per slot</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setTeamsPerSlot(n)}
                className={`min-h-tap rounded-lg border font-bold ${
                  teamsPerSlot === n
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-bg-elevated border-border text-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-bg-elevated border border-border rounded-lg px-3 py-2">
          Total: <span className="text-slate-100 font-semibold">{totalTeams}</span>{" "}
          team{totalTeams === 1 ? "" : "s"} across{" "}
          <span className="text-slate-100 font-semibold">{numSlots}</span> slot
          {numSlots === 1 ? "" : "s"}
        </div>

        {numSlots > 1 && (
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Slot labels</label>
            <div className="space-y-2">
              {Array.from({ length: numSlots }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="chip border bg-bg-elevated border-border text-slate-400 shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={slotLabels[i] ?? ""}
                    onChange={(e) => {
                      const next = [...slotLabels];
                      next[i] = e.target.value;
                      setSlotLabels(next);
                    }}
                    placeholder={defaultLabelFor(i)}
                    className="input h-10 min-h-0 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
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
