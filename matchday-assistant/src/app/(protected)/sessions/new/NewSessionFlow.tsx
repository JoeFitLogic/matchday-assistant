'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/context/ClubProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

const FORMATS = [4, 5, 7, 9, 11] as const;
type Format = (typeof FORMATS)[number];
type Step = 1 | 2 | 3 | 4;

type Player = { id: string; first_name: string; last_name: string };

type Props = {
  players: Player[];
  seasonId: string;
  seasonName: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextFriday(): string {
  const today = new Date();
  const day = today.getDay(); // 0 Sun … 6 Sat
  const daysUntil = day === 5 ? 7 : (5 - day + 7) % 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntil);
  return friday.toISOString().split('T')[0];
}

function suggestTeams(present: number, format: Format): number {
  return Math.max(2, Math.floor(present / format));
}

function calcSubs(present: number, format: Format, teams: number): number {
  return present - teams * format;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewSessionFlow({ players, seasonId, seasonName }: Props) {
  const router = useRouter();
  const { clubId } = useClub();

  const [step, setStep]     = useState<Step>(1);
  const [date, setDate]     = useState(getNextFriday());
  const [format, setFormat] = useState<Format>(5);
  const [numTeams, setNumTeams] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // All players start as present — coach taps to mark absent
  const [attendance, setAttendance] = useState<Record<string, boolean>>(
    () => Object.fromEntries(players.map(p => [p.id, true]))
  );

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const subs = calcSubs(presentCount, format, numTeams);

  function togglePlayer(id: string) {
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function next() {
    setStep(s => (s + 1) as Step);
  }

  function back() {
    setStep(s => (s - 1) as Step);
  }

  function goToTeamSetup() {
    setNumTeams(suggestTeams(presentCount, format));
    next();
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();

    // 1. Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        club_id:      clubId,
        season_id:    seasonId,
        session_date: date,
        format,
        status:       'draft',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      setSaveError('Failed to create session. Please try again.');
      setSaving(false);
      return;
    }

    // 2. Save attendance for every player
    const attendanceRows = players.map(p => ({
      session_id: session.id,
      player_id:  p.id,
      club_id:    clubId,
      status:     attendance[p.id] ? 'present' : 'absent',
    }));

    const { error: attError } = await supabase
      .from('attendance')
      .insert(attendanceRows);

    if (attError) {
      setSaveError('Session created but attendance failed to save.');
      setSaving(false);
      return;
    }

    // 3. Create team placeholder rows
    const teamRows = Array.from({ length: numTeams }, (_, i) => ({
      session_id: session.id,
      club_id:    clubId,
      team_name:  `Team ${i + 1}`,
    }));

    await supabase.from('teams').insert(teamRows);

    router.push(`/sessions/${session.id}/squads`);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-8 pb-2">
        <Link
          href="/sessions"
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-white">New Session</h1>
        <span className="text-slate-500 text-sm ml-auto">{seasonName}</span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 px-6 py-3">
        {([1, 2, 3, 4] as Step[]).map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              s <= step ? 'bg-green-500' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2">

        {/* ── Step 1: Date ── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Pick a date</h2>
            <p className="text-slate-400 text-sm mb-6">
              Defaulted to next Friday
            </p>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        )}

        {/* ── Step 2: Format ── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Game format</h2>
            <p className="text-slate-400 text-sm mb-6">Players per team</p>
            <div className="grid grid-cols-2 gap-3">
              {FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`py-6 rounded-2xl text-xl font-bold transition-colors ${
                    format === f
                      ? 'bg-green-600 text-white ring-2 ring-green-400'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700'
                  }`}
                >
                  {f}-a-side
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Attendance ── */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Attendance</h2>
                <p className="text-slate-400 text-sm">Tap a player to mark absent</p>
              </div>
              {/* Live counter */}
              <div className="text-right">
                <p className="text-3xl font-black text-green-400 leading-none">
                  {presentCount}
                </p>
                <p className="text-slate-500 text-sm">
                  of {players.length}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {players.map(player => {
                const present = attendance[player.id];
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player.id)}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-colors ${
                      present
                        ? 'bg-green-900/40 border border-green-700/60'
                        : 'bg-slate-800/50 border border-slate-700 opacity-50'
                    }`}
                  >
                    <span
                      className={`font-semibold text-base ${
                        present ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      {player.first_name}{' '}
                      <span className="font-normal">{player.last_name}</span>
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        present ? 'text-green-400' : 'text-slate-500'
                      }`}
                    >
                      {present ? '✓' : '✗'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Team confirmation ── */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Team setup</h2>
            <p className="text-slate-400 text-sm mb-6">
              Adjust the number of teams
            </p>

            {/* Calculation summary */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-8">
              <p className="text-slate-400 text-sm mb-1">
                {presentCount} players · {format}-a-side
              </p>
              <p className="text-white font-bold text-2xl">
                {numTeams} teams of {format}
              </p>
              {subs >= 0 ? (
                <p className="text-green-400 text-sm mt-1">
                  {subs} rolling sub{subs !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-amber-400 text-sm mt-1">
                  {Math.abs(subs)} players short — reduce teams or change format
                </p>
              )}
            </div>

            {/* ± adjuster */}
            <div className="flex items-center justify-center gap-10">
              <button
                onClick={() => setNumTeams(n => Math.max(2, n - 1))}
                className="w-16 h-16 rounded-full bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-3xl font-bold flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="text-6xl font-black text-white w-16 text-center tabular-nums">
                {numTeams}
              </span>
              <button
                onClick={() => setNumTeams(n => Math.min(8, n + 1))}
                className="w-16 h-16 rounded-full bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-3xl font-bold flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-center text-slate-500 text-sm mt-3">teams</p>

            {saveError && (
              <p className="text-red-400 text-sm text-center mt-6">{saveError}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-6 flex gap-3">
        {step > 1 && (
          <button
            onClick={back}
            className="flex-1 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-base active:bg-slate-700 transition-colors"
          >
            Back
          </button>
        )}

        {step < 3 && (
          <button
            onClick={next}
            disabled={!date}
            className="flex-[2] py-4 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-base transition-colors"
          >
            Continue
          </button>
        )}

        {step === 3 && (
          <button
            onClick={goToTeamSetup}
            disabled={presentCount < 2}
            className="flex-[2] py-4 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-base transition-colors"
          >
            Continue — {presentCount} players
          </button>
        )}

        {step === 4 && (
          <button
            onClick={handleSave}
            disabled={saving || subs < 0}
            className="flex-[2] py-4 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-base transition-colors"
          >
            {saving ? 'Creating session…' : 'Confirm & build squads →'}
          </button>
        )}
      </div>
    </div>
  );
}
