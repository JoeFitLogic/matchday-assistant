'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, CartesianGrid,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import type { Assessment, PlayerInfo } from './page';

// ─── Skill config ─────────────────────────────────────────────────────────────

const SKILLS = [
  { key: 'passing',     label: 'Passing',     color: '#3b82f6' },
  { key: 'shooting',    label: 'Shooting',    color: '#ef4444' },
  { key: 'dribbling',   label: 'Dribbling',   color: '#8b5cf6' },
  { key: 'positioning', label: 'Positioning', color: '#f59e0b' },
  { key: 'teamwork',    label: 'Teamwork',    color: '#10b981' },
  { key: 'attitude',    label: 'Attitude',    color: '#ec4899' },
] as const;

type SkillKey = (typeof SKILLS)[number]['key'];
type Ratings = Record<SkillKey, number>;

const DEFAULT_RATINGS: Ratings = {
  passing: 3, shooting: 3, dribbling: 3,
  positioning: 3, teamwork: 3, attitude: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function overallScore(a: Assessment): number {
  const vals = SKILLS.map(s => a[s.key] ?? 0);
  return Math.round((vals.reduce((sum, v) => sum + v, 0) / vals.length) * 10) / 10;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function shortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function calcAge(dob: string | null): string {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
  return `Age ${age}`;
}

function toRadarData(a: Assessment) {
  return SKILLS.map(s => ({
    skill: s.label,
    value: a[s.key] ?? 0,
    fullMark: 5,
  }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  player: PlayerInfo;
  assessments: Assessment[];
  seasonId: string | null;
  seasonName: string | null;
  clubId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DevelopmentPage({
  player, assessments: initialAssessments, seasonId, seasonName, clubId,
}: Props) {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [formOpen, setFormOpen]       = useState(initialAssessments.length === 0);
  const [ratings, setRatings]         = useState<Ratings>(DEFAULT_RATINGS);
  const [notes, setNotes]             = useState('');
  const [date, setDate]               = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const latest   = assessments[assessments.length - 1];
  const previous = assessments[assessments.length - 2];

  // ── Submit assessment ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!seasonId) { setSaveError('No active season found.'); return; }

    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from('player_development')
      .insert({
        player_id:       player.id,
        season_id:       seasonId,
        club_id:         clubId,
        assessment_date: date,
        coach_notes:     notes.trim() || null,
        ...ratings,
      })
      .select('id, assessment_date, passing, shooting, dribbling, positioning, teamwork, attitude, coach_notes')
      .single();

    if (error || !data) {
      setSaveError('Failed to save assessment.');
      setSaving(false);
      return;
    }

    setAssessments(prev =>
      [...prev, data as Assessment].sort((a, b) =>
        a.assessment_date.localeCompare(b.assessment_date)
      )
    );
    setRatings(DEFAULT_RATINGS);
    setNotes('');
    setFormOpen(false);
    setSaving(false);
  }

  // ── Radar chart data (current + previous for comparison) ───────────────────

  const radarData = latest
    ? SKILLS.map(s => ({
        skill:    s.label,
        current:  latest[s.key] ?? 0,
        previous: previous ? (previous[s.key] ?? 0) : undefined,
        fullMark: 5,
      }))
    : [];

  // ── Line chart data ─────────────────────────────────────────────────────────

  const lineData = assessments.map(a => ({
    date:        shortDate(a.assessment_date),
    passing:     a.passing,
    shooting:    a.shooting,
    dribbling:   a.dribbling,
    positioning: a.positioning,
    teamwork:    a.teamwork,
    attitude:    a.attitude,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 pb-12">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-4">
        <Link href={`/players/${player.id}`} className="text-slate-400 text-sm">
          ← {player.first_name} {player.last_name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">
              {player.first_name} {player.last_name}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {player.preferred_position && <span className="mr-2">{player.preferred_position}</span>}
              {calcAge(player.date_of_birth)}
              {seasonName && <span className="ml-2 text-slate-500">· {seasonName}</span>}
            </p>
          </div>
          {assessments.length > 0 && (
            <div className="text-right">
              <p className="text-3xl font-black text-green-400">{overallScore(latest)}</p>
              <p className="text-slate-500 text-xs">overall</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Current skill profile (radar) ──────────────────────────────────── */}
      {latest && (
        <section className="px-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold">Skill Profile</h2>
            {previous && (
              <button
                onClick={() => setShowCompare(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  showCompare
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {showCompare ? 'Hide comparison' : 'Compare previous'}
              </button>
            )}
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                {showCompare && previous && (
                  <Radar
                    name="Previous"
                    dataKey="previous"
                    stroke="#64748b"
                    fill="#64748b"
                    fillOpacity={0.2}
                    strokeDasharray="4 2"
                  />
                )}
                <Radar
                  name="Current"
                  dataKey="current"
                  stroke="#16a34a"
                  fill="#16a34a"
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Comparison vs previous ──────────────────────────────────────────── */}
      {latest && previous && (
        <section className="px-6 mb-6">
          <h2 className="text-white font-bold mb-3">
            vs Previous
            <span className="text-slate-500 font-normal text-sm ml-2">
              {formatDate(previous.assessment_date)} → {formatDate(latest.assessment_date)}
            </span>
          </h2>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 divide-y divide-slate-700">
            {SKILLS.map(skill => {
              const curr = latest[skill.key] ?? 0;
              const prev = previous[skill.key] ?? 0;
              const delta = curr - prev;
              return (
                <div key={skill.key} className="flex items-center px-4 py-3 gap-3">
                  <span className="text-slate-300 text-sm w-24 shrink-0">{skill.label}</span>
                  <div className="flex-1 flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <div
                        key={n}
                        className={`flex-1 h-2 rounded-full ${
                          n <= curr ? 'bg-green-500' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-white font-bold text-sm w-4 text-center">{curr}</span>
                  <span className={`text-sm font-bold w-10 text-right shrink-0 ${
                    delta > 0 ? 'text-green-400' :
                    delta < 0 ? 'text-red-400' : 'text-slate-600'
                  }`}>
                    {delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : '='}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Assessment form ─────────────────────────────────────────────────── */}
      <section className="px-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold">
            {assessments.length === 0 ? 'First Assessment' : 'New Assessment'}
          </h2>
          {assessments.length > 0 && (
            <button
              onClick={() => setFormOpen(v => !v)}
              className="text-sm text-green-400 font-medium"
            >
              {formOpen ? '✕ Cancel' : '+ Add'}
            </button>
          )}
        </div>

        {formOpen && (
          <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-5">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Assessment date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Skill ratings */}
            {SKILLS.map(skill => (
              <RatingPicker
                key={skill.key}
                label={skill.label}
                value={ratings[skill.key]}
                color={skill.color}
                onChange={v => setRatings(prev => ({ ...prev, [skill.key]: v }))}
              />
            ))}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Coach notes <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="What stood out today? Areas to work on?"
                className="w-full px-4 py-3 rounded-xl bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {saveError && (
              <p className="text-red-400 text-sm">{saveError}</p>
            )}

            <button
              type="submit"
              disabled={saving || !seasonId}
              className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition-colors"
            >
              {saving ? 'Saving…' : 'Save Assessment'}
            </button>

            {!seasonId && (
              <p className="text-amber-400 text-xs text-center">
                No active season — create one before assessing players.
              </p>
            )}
          </form>
        )}
      </section>

      {/* ── Progress over time (line chart) ────────────────────────────────── */}
      {assessments.length >= 2 && (
        <section className="px-6 mb-6">
          <h2 className="text-white font-bold mb-3">Progress Over Time</h2>
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                {SKILLS.map(skill => (
                  <Line
                    key={skill.key}
                    type="monotone"
                    dataKey={skill.key}
                    name={skill.label}
                    stroke={skill.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: skill.color }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Assessment history ──────────────────────────────────────────────── */}
      {assessments.length > 0 && (
        <section className="px-6">
          <h2 className="text-white font-bold mb-3">
            Assessment History
            <span className="text-slate-500 font-normal text-sm ml-2">
              {assessments.length} total
            </span>
          </h2>
          <div className="space-y-3">
            {[...assessments].reverse().map((a, idx) => (
              <AssessmentCard
                key={a.id}
                assessment={a}
                isLatest={idx === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {assessments.length === 0 && !formOpen && (
        <div className="px-6 py-12 text-center">
          <p className="text-slate-400 text-lg mb-2">No assessments yet</p>
          <p className="text-slate-500 text-sm mb-6">
            Start tracking {player.first_name}&apos;s development this season.
          </p>
          <button
            onClick={() => setFormOpen(true)}
            className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl"
          >
            Add first assessment
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Rating picker ────────────────────────────────────────────────────────────

function RatingPicker({
  label, value, color, onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-medium text-sm">{label}</span>
        <span className="font-bold text-sm" style={{ color }}>{value} / 5</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors ${
              n === value
                ? 'text-white'
                : n < value
                  ? 'text-slate-400 opacity-60'
                  : 'bg-slate-700 text-slate-500'
            }`}
            style={n <= value ? { backgroundColor: color + (n === value ? '' : '66') } : {}}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Assessment card ──────────────────────────────────────────────────────────

function AssessmentCard({
  assessment, isLatest,
}: {
  assessment: Assessment;
  isLatest: boolean;
}) {
  const score = overallScore(assessment);

  return (
    <div className={`bg-slate-800 rounded-2xl border p-4 ${
      isLatest ? 'border-green-700' : 'border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">
            {formatDate(assessment.assessment_date)}
            {isLatest && (
              <span className="ml-2 text-xs text-green-400 font-medium bg-green-900/40 px-2 py-0.5 rounded-full">
                Latest
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white">{score}</span>
          <span className="text-slate-500 text-xs ml-1">/ 5</span>
        </div>
      </div>

      {/* Skill bars */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        {SKILLS.map(skill => (
          <div key={skill.key} className="flex items-center gap-2">
            <span className="text-slate-400 text-xs w-20 shrink-0">{skill.label}</span>
            <div className="flex gap-0.5 flex-1">
              {[1,2,3,4,5].map(n => (
                <div
                  key={n}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    backgroundColor: n <= (assessment[skill.key] ?? 0) ? skill.color : '#1e293b',
                  }}
                />
              ))}
            </div>
            <span className="text-white text-xs font-bold w-3 text-right">
              {assessment[skill.key] ?? '–'}
            </span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {assessment.coach_notes && (
        <p className="text-slate-400 text-sm italic border-t border-slate-700 pt-3 mt-1">
          &ldquo;{assessment.coach_notes}&rdquo;
        </p>
      )}
    </div>
  );
}
