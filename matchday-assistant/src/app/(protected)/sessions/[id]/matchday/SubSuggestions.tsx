'use client';

import { useState } from 'react';
import type { MatchSuggestion, PlayerSuggestion, Warning } from './suggestions';
import type { PlayerData, TeamData } from './page';

// ─── Colour helpers ───────────────────────────────────────────────────────────

const COLOUR_DOT: Record<string, string> = {
  blue: 'bg-blue-500', red: 'bg-red-500', green: 'bg-green-500',
  yellow: 'bg-yellow-400', orange: 'bg-orange-500', white: 'bg-white',
  black: 'bg-slate-800 border border-slate-500',
};

const POSITION_BADGE: Record<string, string> = {
  GK: 'bg-yellow-500 text-yellow-900',
  DEF: 'bg-blue-600 text-white',
  MID: 'bg-green-600 text-white',
  ATT: 'bg-red-600 text-white',
  ANY: 'bg-slate-600 text-slate-300',
};

function normalisePos(pos: string | null): string {
  if (!pos) return 'ANY';
  const p = pos.toUpperCase();
  if (p.includes('GK') || p.includes('GOAL')) return 'GK';
  if (['CB','LB','RB','DEF','BACK'].some(s => p.includes(s))) return 'DEF';
  if (['CM','DM','AM','MID'].some(s => p.includes(s))) return 'MID';
  if (['ST','CF','FW','ATT','WING','STRIK'].some(s => p.includes(s))) return 'ATT';
  return 'ANY';
}

const WARNING_STYLES: Record<string, string> = {
  error: 'bg-red-900/40 border-red-700 text-red-300',
  warn:  'bg-amber-900/40 border-amber-700 text-amber-300',
  info:  'bg-slate-800 border-slate-600 text-slate-400',
};

const WARNING_ICON: Record<string, string> = {
  error: '🚨', warn: '⚠️', info: 'ℹ️',
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  suggestion: MatchSuggestion;
  nextMatchNumber: number;
  totalMatches: number;
  teams: TeamData[];
  playerMap: Map<string, PlayerData>;
  /** Called with the final starter IDs per team (teamId → starterIds[]) */
  onApply: (startersByTeam: Record<string, string[]>) => void;
  onSkip: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubSuggestions({
  suggestion, nextMatchNumber, totalMatches, teams, playerMap, onApply, onSkip,
}: Props) {

  // Local toggleable state — coach can flip individual players before applying
  const [overrides, setOverrides] = useState<Record<string, 'starter' | 'bench'>>(() => {
    const init: Record<string, 'starter' | 'bench'> = {};
    suggestion.teams.forEach(t => t.players.forEach(p => { init[p.playerId] = p.role; }));
    return init;
  });

  function togglePlayer(playerId: string, teamId: string) {
    setOverrides(prev => {
      const current = prev[playerId];
      const teamSuggestion = suggestion.teams.find(t => t.teamId === teamId);
      if (!teamSuggestion) return prev;

      const newRole = current === 'starter' ? 'bench' : 'starter';

      // Count starters in this team after toggle
      const teamPlayers = teamSuggestion.players.map(p => p.playerId);
      const starterCount = teamPlayers.filter(id => {
        if (id === playerId) return newRole === 'starter';
        return prev[id] === 'starter';
      }).length;

      // Prevent going below 0 or above team player count (just warn via UI)
      return { ...prev, [playerId]: newRole };
    });
  }

  function handleApply() {
    const startersByTeam: Record<string, string[]> = {};
    suggestion.teams.forEach(t => {
      startersByTeam[t.teamId] = t.players
        .filter(p => overrides[p.playerId] === 'starter')
        .map(p => p.playerId);
    });
    onApply(startersByTeam);
  }

  const allWarnings = [
    ...suggestion.globalWarnings,
    ...suggestion.teams.flatMap(t => t.warnings),
  ];
  const errorCount = allWarnings.filter(w => w.level === 'error').length;
  const warnCount  = allWarnings.filter(w => w.level === 'warn').length;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900 flex flex-col overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 pt-6 pb-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white font-black text-xl">
              Suggested Lineup
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Match {nextMatchNumber} of {totalMatches}
              {errorCount > 0 && <span className="text-red-400 ml-2">· {errorCount} urgent</span>}
              {warnCount > 0  && <span className="text-amber-400 ml-2">· {warnCount} warnings</span>}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-white text-sm px-3 py-1.5 bg-slate-800 rounded-lg"
          >
            Skip
          </button>
        </div>

        {/* High-priority warnings banner */}
        {allWarnings.filter(w => w.level === 'error').map((w, i) => (
          <div key={i} className={`mt-3 px-3 py-2.5 rounded-xl border text-sm flex items-start gap-2 ${WARNING_STYLES.error}`}>
            <span className="shrink-0">🚨</span>
            <span>{w.message}</span>
          </div>
        ))}
      </div>

      {/* Team sections */}
      <div className="flex-1 px-4 py-4 space-y-6">

        {suggestion.teams.map(teamSugg => {
          const teamData = teams.find(t => t.id === teamSugg.teamId);
          const starters = teamSugg.players.filter(p => overrides[p.playerId] === 'starter');
          const bench    = teamSugg.players.filter(p => overrides[p.playerId] === 'bench');

          return (
            <div key={teamSugg.teamId}>
              {/* Team header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${COLOUR_DOT[teamData?.colour ?? 'blue']}`} />
                <h3 className="text-white font-bold">{teamSugg.teamName}</h3>
                <span className="text-slate-500 text-xs ml-auto">tap to toggle</span>
              </div>

              {/* Team-level warnings (non-error) */}
              {teamSugg.warnings.filter(w => w.level !== 'error').map((w, i) => (
                <div key={i} className={`mb-2 px-3 py-2 rounded-xl border text-xs flex items-start gap-1.5 ${WARNING_STYLES[w.level]}`}>
                  <span>{WARNING_ICON[w.level]}</span>
                  <span>{w.message}</span>
                </div>
              ))}

              {/* Starting lineup */}
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Starting</p>
              <div className="space-y-2 mb-4">
                {starters.map(ps => (
                  <PlayerSuggestionRow
                    key={ps.playerId}
                    suggestion={ps}
                    player={playerMap.get(ps.playerId)}
                    role="starter"
                    onToggle={() => togglePlayer(ps.playerId, teamSugg.teamId)}
                  />
                ))}
                {starters.length === 0 && (
                  <p className="text-slate-600 text-sm italic px-2">No starters assigned</p>
                )}
              </div>

              {/* Bench */}
              {bench.length > 0 && (
                <>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Bench</p>
                  <div className="space-y-2 opacity-70">
                    {bench.map(ps => (
                      <PlayerSuggestionRow
                        key={ps.playerId}
                        suggestion={ps}
                        player={playerMap.get(ps.playerId)}
                        role="bench"
                        onToggle={() => togglePlayer(ps.playerId, teamSugg.teamId)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: action buttons */}
      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 px-6 py-5 flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold"
        >
          Keep default
        </button>
        <button
          onClick={handleApply}
          className="flex-[2] py-4 rounded-2xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold transition-colors"
        >
          Apply lineup →
        </button>
      </div>
    </div>
  );
}

// ─── Player row ───────────────────────────────────────────────────────────────

function PlayerSuggestionRow({
  suggestion, player, role, onToggle,
}: {
  suggestion: PlayerSuggestion;
  player: PlayerData | undefined;
  role: 'starter' | 'bench';
  onToggle: () => void;
}) {
  if (!player) return null;
  const pos = normalisePos(player.preferred_position);
  const isStarter = role === 'starter';

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl transition-colors border ${
        isStarter
          ? 'bg-green-900/30 border-green-800/50 active:bg-green-900/50'
          : 'bg-slate-800/50 border-slate-700 active:bg-slate-700'
      }`}
    >
      {/* Position badge */}
      <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_BADGE[pos]}`}>
        {suggestion.isGk ? 'GK' : pos}
      </span>

      {/* Name + reason */}
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-semibold truncate ${isStarter ? 'text-white' : 'text-slate-400'}`}>
          {player.first_name} {player.last_name}
          {suggestion.hasNotPlayed && <span className="ml-1.5 text-red-400 text-xs">NO MINS</span>}
        </p>
        <p className="text-xs text-slate-500 truncate">{suggestion.reason}</p>
      </div>

      {/* Minutes */}
      <span className={`text-sm font-bold tabular-nums shrink-0 ${
        suggestion.totalMins === 0 ? 'text-red-400' :
        suggestion.wasOnBench ? 'text-amber-400' : 'text-slate-400'
      }`}>
        {suggestion.totalMins}m
      </span>

      {/* Toggle indicator */}
      <span className={`text-xs font-bold shrink-0 ${isStarter ? 'text-green-400' : 'text-slate-600'}`}>
        {isStarter ? '▶' : '–'}
      </span>
    </button>
  );
}
