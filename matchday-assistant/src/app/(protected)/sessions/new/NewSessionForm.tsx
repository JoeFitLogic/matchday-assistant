"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SessionFormat } from "@/lib/types/database";

const FORMATS: { value: SessionFormat; label: string; defaultLen: number; defaultSub: number }[] = [
  { value: "5v5", label: "5-a-side", defaultLen: 10, defaultSub: 3 },
  { value: "7v7", label: "7-a-side", defaultLen: 20, defaultSub: 5 },
  { value: "9v9", label: "9-a-side", defaultLen: 25, defaultSub: 5 },
  { value: "11v11", label: "11-a-side", defaultLen: 30, defaultSub: 10 },
];

const TEAM_COLOURS = ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981"];

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
  const [numTeams, setNumTeams] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        num_teams: numTeams,
      })
      .select("*")
      .single();

    if (sErr || !session) {
      setSaving(false);
      setError(sErr?.message ?? "Could not create session");
      return;
    }

    const teamRows = Array.from({ length: numTeams }, (_, i) => ({
      club_id: clubId,
      session_id: session.id,
      team_name: `${clubName} ${i + 1}`,
      team_colour: TEAM_COLOURS[i % TEAM_COLOURS.length],
    }));
    const { error: tErr } = await supabase.from("teams").insert(teamRows);
    if (tErr) {
      setSaving(false);
      setError(tErr.message);
      return;
    }

    router.replace(`/session/${session.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div>
        <label className="block text-sm text-slate-300 mb-1.5">Number of teams</label>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setNumTeams(n)}
              className={`min-h-tap rounded-lg border font-bold ${
                numTeams === n
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-bg-elevated border-border text-slate-300"
              }`}
            >
              {n}
            </button>
          ))}
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
