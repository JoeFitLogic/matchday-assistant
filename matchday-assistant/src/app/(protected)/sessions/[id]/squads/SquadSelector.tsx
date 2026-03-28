'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  autoBalance,
  calcSubs,
  FORMATS,
  normalisePosition,
  requiresGk,
  suggestTeamCount,
  teamAvgRating,
  type Format,
  type PlayerData,
} from './balance';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOURS = ['blue', 'red', 'green', 'yellow', 'orange', 'white', 'black'] as const;
type TeamColour = (typeof COLOURS)[number];

const COLOUR_STYLES: Record<TeamColour, { dot: string; ring: string; header: string }> = {
  blue:   { dot: 'bg-blue-500',   ring: 'ring-blue-500',   header: 'bg-blue-900/30 border-blue-700' },
  red:    { dot: 'bg-red-500',    ring: 'ring-red-500',    header: 'bg-red-900/30 border-red-700' },
  green:  { dot: 'bg-green-500',  ring: 'ring-green-500',  header: 'bg-green-900/30 border-green-700' },
  yellow: { dot: 'bg-yellow-400', ring: 'ring-yellow-400', header: 'bg-yellow-900/30 border-yellow-700' },
  orange: { dot: 'bg-orange-500', ring: 'ring-orange-500', header: 'bg-orange-900/30 border-orange-700' },
  white:  { dot: 'bg-white',      ring: 'ring-white',      header: 'bg-slate-700/40 border-slate-500' },
  black:  { dot: 'bg-slate-900 border border-slate-600', ring: 'ring-slate-400', header: 'bg-slate-900/60 border-slate-600' },
};

const POSITION_STYLES: Record<string, string> = {
  GK:  'bg-yellow-500 text-yellow-900',
  DEF: 'bg-blue-600 text-white',
  MID: 'bg-green-600 text-white',
  ATT: 'bg-red-600 text-white',
  ANY: 'bg-slate-600 text-slate-200',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamState = {
  id: string | null;
  name: string;
  colour: TeamColour;
  playerIds: string[];
};

type Props = {
  sessionId: string;
  clubId: string;
  sessionDate: string;
  initialFormat: Format;
  players: PlayerData[];
  initialTeams: { id: string; name: string; colour: string; playerIds: string[] }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function defaultColours(idx: number): TeamColour {
  return COLOURS[idx % COLOURS.length];
}

function ratingDots(rating: number | null) {
  const r = rating ?? 0;
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i < r ? 'bg-amber-400' : 'bg-slate-600'}`} />
  ));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SquadSelector({
  sessionId, clubId, sessionDate, initialFormat, players, initialTeams,
}: Props) {
  const router = useRouter();
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [format, setFormat]     = useState<Format>(initialFormat);
  const [numTeams, setNumTeams] = useState(initialTeams.length || suggestTeamCount(players.length, initialFormat));
  const [teams, setTeams]       = useState<TeamState[]>(() =>
    initialTeams.length > 0
      ? initialTeams.map((t, i) => ({ ...t, colour: (t.colour as TeamColour) || defaultColours(i) }))
      : Array.from({ length: numTeams }, (_, i) => ({ id: null, name: `Team ${i + 1}`, colour: defaultColours(i), playerIds: [] }))
  );
  const [locked, setLocked]         = useState<Set<string>>(new Set());
  const [selected, setSelected]     = useState<string | null>(null);
  const [gkWarning, setGkWarning]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null); // team index
  const originalTeamIds = useRef(initialTeams.map(t => t.id));

  // ── Auto-balance on mount if no assignments yet ────────────────────────────
  const hasAssignments = initialTeams.some(t => t.playerIds.length > 0);
  const hasRun = useRef(false);
  useEffect(() => {
    if (!hasAssignments && !hasRun.current) {
      hasRun.current = true;
      runBalance(teams);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Balance runner ─────────────────────────────────────────────────────────
  function runBalance(currentTeams: TeamState[]) {
    const current2d = currentTeams.map(t => t.playerIds);
    const { teams: balanced, gkWarning: warn } = autoBalance(players, numTeams, format, locked, current2d);
    setGkWarning(warn);
    setTeams(prev => prev.map((t, i) => ({ ...t, playerIds: balanced[i] ?? [] })));
  }

  // ── Recalculate when format or team count changes ──────────────────────────
  function handleFormatChange(f: Format) {
    const newCount = suggestTeamCount(players.length, f);
    setFormat(f);
    setNumTeams(newCount);
    setLocked(new Set()); // clear locks on format change
    const newTeams = Array.from({ length: newCount }, (_, i) => ({
      id: teams[i]?.id ?? null,
      name: teams[i]?.name ?? `Team ${i + 1}`,
      colour: teams[i]?.colour ?? defaultColours(i),
      playerIds: [],
    }));
    setTeams(newTeams);
    const { teams: balanced, gkWarning: warn } = autoBalance(players, newCount, f, new Set(), []);
    setGkWarning(warn);
    setTeams(newTeams.map((t, i) => ({ ...t, playerIds: balanced[i] ?? [] })));
  }

  function handleTeamCountChange(delta: number) {
    const next = Math.max(2, Math.min(8, numTeams + delta));
    if (next === numTeams) return;
    setNumTeams(next);
    setLocked(new Set());
    const newTeams = Array.from({ length: next }, (_, i) => ({
      id: teams[i]?.id ?? null,
      name: teams[i]?.name ?? `Team ${i + 1}`,
      colour: teams[i]?.colour ?? defaultColours(i),
      playerIds: [],
    }));
    setTeams(newTeams);
    const { teams: balanced, gkWarning: warn } = autoBalance(players, next, format, new Set(), []);
    setGkWarning(warn);
    setTeams(newTeams.map((t, i) => ({ ...t, playerIds: balanced[i] ?? [] })));
  }

  // ── Player interactions ────────────────────────────────────────────────────
  function handlePlayerTap(playerId: string, fromTeamIdx: number) {
    if (selected === null) {
      setSelected(playerId);
      return;
    }
    if (selected === playerId) {
      setSelected(null);
      return;
    }
    // Move selected player to this team (swap if target has a player)
    const selectedTeamIdx = teams.findIndex(t => t.playerIds.includes(selected));
    if (selectedTeamIdx === fromTeamIdx) {
      // Same team — just change selection
      setSelected(playerId);
      return;
    }
    // Swap the two players
    setTeams(prev => prev.map((team, i) => {
      if (i === selectedTeamIdx) {
        return { ...team, playerIds: team.playerIds.map(id => id === selected ? playerId : id) };
      }
      if (i === fromTeamIdx) {
        return { ...team, playerIds: team.playerIds.map(id => id === playerId ? selected : id) };
      }
      return team;
    }));
    setSelected(null);
  }

  function moveSelectedToTeam(toTeamIdx: number) {
    if (!selected) return;
    const fromTeamIdx = teams.findIndex(t => t.playerIds.includes(selected));
    if (fromTeamIdx === toTeamIdx) { setSelected(null); return; }
    setTeams(prev => prev.map((team, i) => {
      if (i === fromTeamIdx) return { ...team, playerIds: team.playerIds.filter(id => id !== selected) };
      if (i === toTeamIdx)   return { ...team, playerIds: [...team.playerIds, selected] };
      return team;
    }));
    setSelected(null);
  }

  function toggleLock(playerId: string) {
    setLocked(prev => {
      const next = new Set(prev);
      next.has(playerId) ? next.delete(playerId) : next.add(playerId);
      return next;
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    // 1. Update / create teams
    const savedTeamIds: string[] = [];
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.id) {
        await supabase.from('teams').update({ team_name: team.name, team_colour: team.colour }).eq('id', team.id);
        savedTeamIds.push(team.id);
      } else {
        const { data } = await supabase
          .from('teams')
          .insert({ session_id: sessionId, club_id: clubId, team_name: team.name, team_colour: team.colour })
          .select('id')
          .single();
        if (data) savedTeamIds.push(data.id);
      }
    }

    // 2. Delete teams that were removed
    const deletedIds = originalTeamIds.current.filter(id => id && !savedTeamIds.includes(id));
    if (deletedIds.length) {
      await supabase.from('teams').delete().in('id', deletedIds as string[]);
    }

    // 3. Delete all existing team_players for remaining teams
    if (savedTeamIds.length) {
      await supabase.from('team_players').delete().in('team_id', savedTeamIds);
    }

    // 4. Insert new team_players
    const rows = teams.flatMap((team, i) =>
      team.playerIds.map(playerId => ({
        team_id:   savedTeamIds[i],
        player_id: playerId,
        club_id:   clubId,
      }))
    ).filter(r => r.team_id);

    if (rows.length) {
      const { error } = await supabase.from('team_players').insert(rows);
      if (error) { setSaveError('Failed to save squads. Please try again.'); setSaving(false); return; }
    }

    router.push(`/sessions/${sessionId}`);
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const subs = calcSubs(players.length, format, numTeams);
  const selectedPlayer = selected ? playerMap.get(selected) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-36">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-8 pb-3">
        <Link href={`/sessions/${sessionId}`} className="text-slate-400 hover:text-white">← Back</Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white leading-none">Squad Builder</h1>
          <p className="text-slate-500 text-xs mt-0.5">{formatDate(sessionDate)}</p>
        </div>
        <button
          onClick={() => runBalance(teams)}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-xl transition-colors"
        >
          Shuffle
        </button>
      </div>

      {/* GK warning */}
      {gkWarning && (
        <div className="mx-6 mb-3 px-4 py-3 bg-amber-900/40 border border-amber-700 rounded-xl text-amber-300 text-sm">
          Not enough goalkeepers for every team — assign one manually.
        </div>
      )}

      {/* Format selector */}
      <div className="px-6 mb-1">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Format</p>
        <div className="flex gap-2">
          {FORMATS.map(f => (
            <button
              key={f}
              onClick={() => handleFormatChange(f)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                format === f
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {f}v{f}
            </button>
          ))}
        </div>
      </div>

      {/* Team count + summary */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">
            {players.length} players → {numTeams} teams of {format}
          </p>
          <p className={`text-xs mt-0.5 ${subs >= 0 ? 'text-green-400' : 'text-amber-400'}`}>
            {subs >= 0
              ? `${subs} rolling sub${subs !== 1 ? 's' : ''}`
              : `${Math.abs(subs)} players short`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleTeamCountChange(-1)}
            className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold text-lg flex items-center justify-center">−</button>
          <span className="text-white font-bold text-lg w-5 text-center">{numTeams}</span>
          <button onClick={() => handleTeamCountChange(1)}
            className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold text-lg flex items-center justify-center">+</button>
        </div>
      </div>

      {/* Team cards */}
      <div className="px-4 space-y-4">
        {teams.map((team, teamIdx) => {
          const cs      = COLOUR_STYLES[team.colour];
          const avgRating = teamAvgRating(team.playerIds, playerMap);
          const fieldPlayers = team.playerIds.slice(0, format);
          const teamSubs     = team.playerIds.slice(format);

          return (
            <div key={teamIdx} className={`rounded-2xl border ${cs.header} overflow-hidden`}>
              {/* Team header */}
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Colour picker */}
                <div className="flex gap-1.5">
                  {COLOURS.map(c => (
                    <button
                      key={c}
                      onClick={() => setTeams(prev => prev.map((t, i) => i === teamIdx ? { ...t, colour: c } : t))}
                      className={`w-4 h-4 rounded-full ${COLOUR_STYLES[c].dot} ${team.colour === c ? `ring-2 ring-offset-1 ring-offset-slate-800 ${cs.ring}` : ''}`}
                    />
                  ))}
                </div>

                {/* Team name */}
                {editingName === `${teamIdx}` ? (
                  <input
                    autoFocus
                    value={team.name}
                    onChange={e => setTeams(prev => prev.map((t, i) => i === teamIdx ? { ...t, name: e.target.value } : t))}
                    onBlur={() => setEditingName(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditingName(null)}
                    className="flex-1 bg-transparent text-white font-bold text-sm border-b border-slate-500 outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(`${teamIdx}`)}
                    className="flex-1 text-left text-white font-bold text-sm"
                  >
                    {team.name}
                  </button>
                )}

                {/* Avg rating bar */}
                <div className="text-right shrink-0">
                  <div className="flex gap-px justify-end mb-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-4 rounded-full ${i < Math.round(avgRating) ? 'bg-amber-400' : 'bg-slate-600'}`}
                      />
                    ))}
                  </div>
                  <p className="text-slate-500 text-xs">{avgRating.toFixed(1)} avg</p>
                </div>
              </div>

              {/* Move-here button (shown when a player is selected) */}
              {selected && !team.playerIds.includes(selected) && (
                <button
                  onClick={() => moveSelectedToTeam(teamIdx)}
                  className="w-full py-2 bg-green-700/50 border-t border-green-700 text-green-300 text-xs font-semibold"
                >
                  Move {selectedPlayer?.first_name} here
                </button>
              )}

              {/* Field players */}
              <div className="px-3 pb-2 pt-1 space-y-1.5">
                {fieldPlayers.map(pid => (
                  <PlayerRow
                    key={pid}
                    player={playerMap.get(pid)!}
                    isSub={false}
                    isSelected={selected === pid}
                    isLocked={locked.has(pid)}
                    onTap={() => handlePlayerTap(pid, teamIdx)}
                    onToggleLock={() => toggleLock(pid)}
                  />
                ))}
              </div>

              {/* Subs */}
              {teamSubs.length > 0 && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-700/50">
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-1.5 px-1">Subs</p>
                  <div className="space-y-1.5 opacity-60">
                    {teamSubs.map(pid => (
                      <PlayerRow
                        key={pid}
                        player={playerMap.get(pid)!}
                        isSub
                        isSelected={selected === pid}
                        isLocked={locked.has(pid)}
                        onTap={() => handlePlayerTap(pid, teamIdx)}
                        onToggleLock={() => toggleLock(pid)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-4 space-y-2">
        {selected && (
          <p className="text-center text-slate-400 text-xs">
            <span className="text-white font-semibold">{selectedPlayer?.first_name} {selectedPlayer?.last_name}</span>
            {' '}selected — tap a player to swap, or tap "Move here" on a team
          </p>
        )}
        {saveError && <p className="text-red-400 text-sm text-center">{saveError}</p>}
        <div className="flex gap-3">
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="flex-1 py-4 rounded-2xl bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] py-4 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition-colors"
          >
            {saving ? 'Saving…' : 'Confirm squads →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Player row sub-component ─────────────────────────────────────────────────

function PlayerRow({
  player, isSub, isSelected, isLocked, onTap, onToggleLock,
}: {
  player: PlayerData;
  isSub: boolean;
  isSelected: boolean;
  isLocked: boolean;
  onTap: () => void;
  onToggleLock: () => void;
}) {
  if (!player) return null;
  const pos = normalisePosition(player.preferred_position);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors ${
        isSelected
          ? 'bg-green-700/50 ring-2 ring-green-500'
          : 'bg-slate-800/60 active:bg-slate-700'
      }`}
    >
      <button onClick={onTap} className="flex-1 flex items-center gap-2 min-w-0">
        {/* Position badge */}
        <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_STYLES[pos]}`}>
          {pos}
        </span>
        {/* Name */}
        <span className="text-white text-sm font-medium truncate">
          {player.first_name} {player.last_name}
        </span>
        {/* Rating dots */}
        <span className="flex gap-0.5 ml-auto shrink-0">
          {ratingDots(player.ability_rating)}
        </span>
      </button>
      {/* Lock button */}
      <button
        onClick={onToggleLock}
        className={`shrink-0 text-base transition-opacity ${isLocked ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
        title={isLocked ? 'Unlock player' : 'Lock to this team'}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>
    </div>
  );
}
