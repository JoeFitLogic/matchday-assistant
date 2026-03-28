'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { MatchData, PlayerData, TeamData } from './page';
import { computeSuggestions, type MatchSuggestion } from './suggestions';
import SubSuggestions from './SubSuggestions';

// ─── Constants ────────────────────────────────────────────────────────────────

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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerStatus = 'playing' | 'bench' | 'injured';

type PlayerLiveState = {
  status: PlayerStatus;
  onPitchSince: number | null; // timerSeconds when they came on
  minutesThisMatch: number;    // accumulated minutes while off pitch
  startedOnPitch: boolean;
};

type UndoSnapshot = {
  matchId: string;
  matchIdx: number;
  playerStates: Record<string, PlayerLiveState>;
  completedMins: Record<string, number>;
  homeScore: number;
  awayScore: number;
  timerSeconds: number;
};

type Props = {
  sessionId: string;
  clubId: string;
  sessionDate: string;
  format: number;
  teams: TeamData[];
  matches: MatchData[];
  completedMinutes: Record<string, number>;
};

// ─── Init helper ─────────────────────────────────────────────────────────────

/**
 * Builds initial player states for a match.
 * - Injured players start as 'injured' (no minutes, excluded from pitch count).
 * - Eligible starters: first `format` non-injured players, or customStarters if provided.
 * - Works correctly with uneven team sizes (e.g. 23 players across 4 teams).
 */
function initPlayerStates(
  match: MatchData,
  teams: TeamData[],
  format: number,
  injuredIds: Set<string>,
  customStarters?: Record<string, string[]>,
): Record<string, PlayerLiveState> {
  const states: Record<string, PlayerLiveState> = {};
  const homeTeam = teams.find(t => t.id === match.home_team_id);
  const awayTeam = teams.find(t => t.id === match.away_team_id);

  [homeTeam, awayTeam].forEach(team => {
    if (!team) return;
    // Only eligible (non-injured) players count toward the format slots
    const eligible = team.players.filter(p => !injuredIds.has(p.id));
    const starterIds = customStarters?.[team.id];

    team.players.forEach(p => {
      if (injuredIds.has(p.id)) {
        states[p.id] = { status: 'injured', onPitchSince: null, minutesThisMatch: 0, startedOnPitch: false };
        return;
      }
      const eligibleIdx = eligible.findIndex(ep => ep.id === p.id);
      const onPitch = starterIds ? starterIds.includes(p.id) : eligibleIdx < format;
      states[p.id] = {
        status: onPitch ? 'playing' : 'bench',
        onPitchSince: onPitch ? 0 : null,
        minutesThisMatch: 0,
        startedOnPitch: onPitch,
      };
    });
  });
  return states;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchdayDashboard({
  sessionId, clubId, sessionDate, format, teams: initialTeams, matches, completedMinutes: initialCompleted,
}: Props) {
  const router = useRouter();

  // Current match index (first non-completed)
  const [matchIdx, setMatchIdx] = useState(() =>
    Math.max(0, matches.findIndex(m => m.status !== 'completed'))
  );
  const currentMatch = matches[matchIdx];

  // ── Mutable team state (supports late arrivals) ────────────────────────────
  const [localTeams, setLocalTeams] = useState<TeamData[]>(initialTeams);

  // Scores
  const [homeScore, setHomeScore] = useState(currentMatch?.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(currentMatch?.away_score ?? 0);

  // ── Injured players ────────────────────────────────────────────────────────
  const [injuredIds, setInjuredIds] = useState<Set<string>>(new Set());

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startAtRef     = useRef<number | null>(null);
  const baseSecondsRef = useRef(0);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Player states
  const [playerStates, setPlayerStates] = useState<Record<string, PlayerLiveState>>(() =>
    currentMatch ? initPlayerStates(currentMatch, initialTeams, format, new Set()) : {}
  );

  // Cumulative minutes (from completed matches, updated as matches end)
  const [completedMins, setCompletedMins] = useState(initialCompleted);

  const [showMinutes, setShowMinutes]         = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState<string | null>(null);
  const [showConfirmEnd, setShowConfirmEnd]   = useState(false);
  const [undoAvailable, setUndoAvailable]     = useState(false);
  const [showAddPlayer, setShowAddPlayer]     = useState<string | null>(null); // teamId

  const undoSnapRef     = useRef<UndoSnapshot | null>(null);
  const undoTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against double-tap or multi-coach race on "End Match"
  const isCompletingRef = useRef(false);

  // Suggestions state — shown between matches
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    suggestion: MatchSuggestion;
    nextMatchIdx: number;
    newCompleted: Record<string, number>;
  } | null>(null);

  // ── Screen lock / tab visibility: resync timer immediately on return ───────
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible' && isRunning && startAtRef.current) {
        // Recalculate correct seconds from the wall-clock timestamp — works even
        // after the browser throttled setInterval while the screen was locked.
        const newSecs = baseSecondsRef.current + Math.floor((Date.now() - startAtRef.current) / 1000);
        setTimerSeconds(newSecs);
        // Restart interval to clear any backlog / throttle state
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startAtRef.current!) / 1000);
          setTimerSeconds(baseSecondsRef.current + elapsed);
        }, 500);
      }
    }
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [isRunning]);

  // ── Realtime: listen for match updates from other coaches ─────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`matchday:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          // Another coach completed this match — advance without a second DB write,
          // but only if we're not already mid-completion ourselves.
          if (
            payload.new.id === currentMatch?.id &&
            payload.new.status === 'completed' &&
            !isCompletingRef.current
          ) {
            handleMatchComplete(false);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentMatch?.id]);

  // ── Timer controls ────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    startAtRef.current = Date.now();
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startAtRef.current!) / 1000);
      setTimerSeconds(baseSecondsRef.current + elapsed);
    }, 500);
  }, []);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    baseSecondsRef.current = timerSeconds;
    setIsRunning(false);
  }, [timerSeconds]);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    baseSecondsRef.current = 0;
    setTimerSeconds(0);
    setIsRunning(false);
  }, []);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  // ── Live minutes calculation ───────────────────────────────────────────────

  function getLiveMinutes(playerId: string): number {
    const state = playerStates[playerId];
    const done = completedMins[playerId] ?? 0;
    if (!state) return done;
    let thisMatch = state.minutesThisMatch;
    if (state.status === 'playing' && state.onPitchSince !== null) {
      thisMatch += Math.floor((timerSeconds - state.onPitchSince) / 60);
    }
    return done + thisMatch;
  }

  // ── Substitution ──────────────────────────────────────────────────────────

  function handlePlayerTap(playerId: string) {
    setPlayerStates(prev => {
      const state = prev[playerId];
      if (!state || state.status === 'injured') return prev;

      if (state.status === 'playing') {
        const mins = state.onPitchSince !== null
          ? Math.floor((timerSeconds - state.onPitchSince) / 60)
          : 0;
        return {
          ...prev,
          [playerId]: { ...state, status: 'bench', onPitchSince: null, minutesThisMatch: state.minutesThisMatch + mins },
        };
      } else {
        return {
          ...prev,
          [playerId]: { ...state, status: 'playing', onPitchSince: timerSeconds },
        };
      }
    });
  }

  // ── Injury ────────────────────────────────────────────────────────────────

  function handleInjure(playerId: string) {
    setPlayerStates(prev => {
      const state = prev[playerId];
      if (!state || state.status === 'injured') return prev;
      const mins = state.status === 'playing' && state.onPitchSince !== null
        ? Math.floor((timerSeconds - state.onPitchSince) / 60)
        : 0;
      return {
        ...prev,
        [playerId]: { status: 'injured', onPitchSince: null, minutesThisMatch: state.minutesThisMatch + mins, startedOnPitch: state.startedOnPitch },
      };
    });
    setInjuredIds(prev => new Set([...Array.from(prev), playerId]));
  }

  function handleUninjure(playerId: string) {
    setInjuredIds(prev => {
      const next = new Set(Array.from(prev));
      next.delete(playerId);
      return next;
    });
    setPlayerStates(prev => {
      const state = prev[playerId];
      if (!state) return prev;
      return { ...prev, [playerId]: { ...state, status: 'bench' } };
    });
  }

  // ── Late player arrival ────────────────────────────────────────────────────

  function handleAddLatePlayer(teamId: string, player: PlayerData) {
    // Update local team roster
    setLocalTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      if (t.players.some(p => p.id === player.id)) return t;
      return { ...t, players: [...t.players, player] };
    }));

    // Player starts on bench for the current match
    setPlayerStates(prev => ({
      ...prev,
      [player.id]: { status: 'bench', onPitchSince: null, minutesThisMatch: 0, startedOnPitch: false },
    }));

    // Persist in DB (best-effort; not blocking UI)
    const supabase = createClient();
    supabase.from('team_players').insert({ team_id: teamId, player_id: player.id, club_id: clubId })
      .then(({ error }) => { if (error) console.warn('[addLatePlayer] DB insert failed:', error); });

    setShowAddPlayer(null);
  }

  // ── Undo last completed match ──────────────────────────────────────────────

  async function handleUndo() {
    const snap = undoSnapRef.current;
    if (!snap || saving) return;

    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    const [{ error: delErr }, { error: updErr }] = await Promise.all([
      supabase.from('player_match_minutes').delete().eq('match_id', snap.matchId),
      supabase.from('matches').update({ status: 'upcoming', home_score: 0, away_score: 0, duration_minutes: null }).eq('id', snap.matchId),
    ]);

    if (delErr || updErr) {
      setSaveError('Undo failed — try again');
      setSaving(false);
      return;
    }

    // Restore all state to just before the match was ended
    setMatchIdx(snap.matchIdx);
    setPlayerStates(snap.playerStates);
    setCompletedMins(snap.completedMins);
    setHomeScore(snap.homeScore);
    setAwayScore(snap.awayScore);
    baseSecondsRef.current = snap.timerSeconds;
    setTimerSeconds(snap.timerSeconds);
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Clear undo window
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAvailable(false);
    undoSnapRef.current = null;
    setSaving(false);
  }

  // ── Finalise player states at match end ───────────────────────────────────

  function finalisePlayerStates(): Record<string, PlayerLiveState & { finalMinutes: number }> {
    const result: Record<string, PlayerLiveState & { finalMinutes: number }> = {};
    for (const [id, state] of Object.entries(playerStates)) {
      let thisMatch = state.minutesThisMatch;
      if (state.status === 'playing' && state.onPitchSince !== null) {
        thisMatch += Math.floor((timerSeconds - state.onPitchSince) / 60);
      }
      result[id] = { ...state, finalMinutes: thisMatch };
    }
    return result;
  }

  // ── End match ─────────────────────────────────────────────────────────────

  async function handleMatchComplete(saveToDb = true) {
    if (!currentMatch) return;

    // Guard: prevent double-tap and multi-coach race
    if (saveToDb) {
      if (isCompletingRef.current) return;
      isCompletingRef.current = true;

      // Check the DB to make sure this match hasn't already been completed
      // (another coach may have ended it between the click and now)
      const supabase = createClient();
      const { data: fresh } = await supabase
        .from('matches')
        .select('status')
        .eq('id', currentMatch.id)
        .single();
      if (fresh?.status === 'completed') {
        // Already done — just advance the UI
        isCompletingRef.current = false;
        handleMatchComplete(false);
        return;
      }
    }

    const finalStates = finalisePlayerStates();

    if (saveToDb) {
      // Capture undo snapshot before any writes
      undoSnapRef.current = {
        matchId: currentMatch.id,
        matchIdx,
        playerStates,
        completedMins,
        homeScore,
        awayScore,
        timerSeconds,
      };

      setSaving(true);
      setSaveError(null);
      const supabase = createClient();

      const [{ error: matchErr }] = await Promise.all([
        supabase.from('matches').update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'completed',
          duration_minutes: Math.max(1, Math.floor(timerSeconds / 60)),
        }).eq('id', currentMatch.id),
      ]);

      if (matchErr) {
        setSaveError('Could not save match — check connection.');
        setSaving(false);
        isCompletingRef.current = false;
        return;
      }

      // Build player–team map for this match
      const homeTeam = localTeams.find(t => t.id === currentMatch.home_team_id);
      const awayTeam = localTeams.find(t => t.id === currentMatch.away_team_id);
      const playerTeamMap: Record<string, string> = {};
      homeTeam?.players.forEach(p => { playerTeamMap[p.id] = homeTeam.id; });
      awayTeam?.players.forEach(p => { playerTeamMap[p.id] = awayTeam.id; });

      const minuteRows = Object.entries(finalStates)
        .filter(([, s]) => s.finalMinutes > 0 || s.startedOnPitch)
        .map(([playerId, s]) => ({
          match_id: currentMatch.id,
          player_id: playerId,
          team_id: playerTeamMap[playerId],
          club_id: clubId,
          minutes_played: s.finalMinutes,
          started: s.startedOnPitch,
          subbed_on_minute: s.startedOnPitch ? null : (s.onPitchSince !== null ? Math.floor(s.onPitchSince / 60) : null),
          subbed_off_minute: s.status === 'bench' && !s.startedOnPitch ? null : (s.status === 'bench' ? null : null),
        }));

      if (minuteRows.length) {
        const { error: minsErr } = await supabase.from('player_match_minutes').insert(minuteRows);
        if (minsErr) {
          setSaveError('Minutes save failed — check connection.');
          setSaving(false);
          isCompletingRef.current = false;
          return;
        }
      }

      // Enable undo for 30 seconds
      setUndoAvailable(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setUndoAvailable(false);
        undoSnapRef.current = null;
      }, 30_000);

      isCompletingRef.current = false;
    }

    // Update cumulative minutes locally
    const newCompleted = { ...completedMins };
    for (const [id, s] of Object.entries(finalStates)) {
      newCompleted[id] = (newCompleted[id] ?? 0) + s.finalMinutes;
    }

    const nextIdx = matchIdx + 1;

    if (nextIdx < matches.length) {
      const nextMatch = matches[nextIdx];
      const nextHome = localTeams.find(t => t.id === nextMatch.home_team_id);
      const nextAway = localTeams.find(t => t.id === nextMatch.away_team_id);

      if (nextHome && nextAway) {
        const prevBenchIds = Object.entries(finalStates)
          .filter(([id, s]) => s.status === 'bench' && !injuredIds.has(id))
          .map(([id]) => id);

        const suggestion = computeSuggestions({
          nextMatchHomeTeam: { id: nextHome.id, name: nextHome.name, players: nextHome.players },
          nextMatchAwayTeam: { id: nextAway.id, name: nextAway.name, players: nextAway.players },
          format,
          completedMinutes: newCompleted,
          prevBenchPlayerIds: prevBenchIds,
          excludedPlayerIds: Array.from(injuredIds),
          nextMatchNumber: nextMatch.match_number,
          totalMatches: matches.length,
        });

        setCompletedMins(newCompleted);
        setPendingSuggestion({ suggestion, nextMatchIdx: nextIdx, newCompleted });
        setSaving(false);
        return;
      }

      // Fallback: advance without suggestions
      setCompletedMins(newCompleted);
      setMatchIdx(nextIdx);
      setHomeScore(nextMatch.home_score);
      setAwayScore(nextMatch.away_score);
      resetTimer();
      setPlayerStates(initPlayerStates(nextMatch, localTeams, format, injuredIds));
    } else {
      setCompletedMins(newCompleted);
      if (saveToDb) {
        const supabase = createClient();
        await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
      }
      router.push(`/sessions/${sessionId}`);
    }

    setSaving(false);
  }

  // ── Apply / skip suggestions ───────────────────────────────────────────────

  function handleApplySuggestion(startersByTeam: Record<string, string[]>) {
    if (!pendingSuggestion) return;
    const { nextMatchIdx } = pendingSuggestion;
    const nextMatch = matches[nextMatchIdx];

    setMatchIdx(nextMatchIdx);
    setHomeScore(nextMatch.home_score);
    setAwayScore(nextMatch.away_score);
    resetTimer();
    setPlayerStates(initPlayerStates(nextMatch, localTeams, format, injuredIds, startersByTeam));
    setPendingSuggestion(null);
  }

  function handleSkipSuggestion() {
    if (!pendingSuggestion) return;
    const { nextMatchIdx } = pendingSuggestion;
    const nextMatch = matches[nextMatchIdx];

    setMatchIdx(nextMatchIdx);
    setHomeScore(nextMatch.home_score);
    setAwayScore(nextMatch.away_score);
    resetTimer();
    setPlayerStates(initPlayerStates(nextMatch, localTeams, format, injuredIds));
    setPendingSuggestion(null);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const playerMap = useMemo(
    () => new Map(localTeams.flatMap(t => t.players).map(p => [p.id, p])),
    [localTeams]
  );

  const homeTeam = localTeams.find(t => t.id === currentMatch?.home_team_id);
  const awayTeam = localTeams.find(t => t.id === currentMatch?.away_team_id);

  /** Eligible (non-injured) starters target for a team */
  function pitchTarget(team: TeamData): number {
    const eligible = team.players.filter(p => !injuredIds.has(p.id)).length;
    return Math.min(format, eligible);
  }

  function pitchCount(team: TeamData | undefined): number {
    if (!team) return 0;
    return team.players.filter(p => playerStates[p.id]?.status === 'playing').length;
  }

  const totalMatches = matches.length;

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-2">Session complete!</p>
          <Link href={`/sessions/${sessionId}`} className="text-green-400 underline">Back to session</Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-28">

      {/* ── Sticky top bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 pt-4 pb-3 space-y-3">

        {/* Row 1: Back + match indicator + undo */}
        <div className="flex items-center gap-3">
          <Link href={`/sessions/${sessionId}`} className="text-slate-400 text-sm">← Back</Link>
          <span className="text-white font-bold text-sm flex-1 text-center">
            Match {currentMatch.match_number} of {totalMatches}
          </span>
          {undoAvailable ? (
            <button
              onClick={handleUndo}
              disabled={saving}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              ↩ Undo
            </button>
          ) : (
            <span className="bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full">
              {format}-a-side
            </span>
          )}
        </div>

        {/* Row 2: Timer */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-4xl font-black text-white tabular-nums tracking-tight">
            {formatTime(timerSeconds)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={isRunning ? pauseTimer : startTimer}
              className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xl flex items-center justify-center font-bold transition-colors"
            >
              {isRunning ? '⏸' : '▶'}
            </button>
            <button
              onClick={resetTimer}
              className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-300 text-base flex items-center justify-center transition-colors"
            >
              ↺
            </button>
          </div>
        </div>

        {/* Row 3: Scores */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center gap-2 justify-start">
            <div className={`w-3 h-3 rounded-full shrink-0 ${COLOUR_DOT[homeTeam?.colour ?? 'blue']}`} />
            <span className="text-slate-300 text-xs font-medium truncate">{homeTeam?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHomeScore(s => Math.max(0, s - 1))}
              className="w-9 h-9 bg-slate-700 rounded-lg text-white font-bold text-lg flex items-center justify-center active:bg-slate-600">−</button>
            <span className="text-3xl font-black text-white tabular-nums w-8 text-center">{homeScore}</span>
            <button onClick={() => setHomeScore(s => s + 1)}
              className="w-9 h-9 bg-slate-700 rounded-lg text-white font-bold text-lg flex items-center justify-center active:bg-slate-600">+</button>
          </div>
          <span className="text-slate-500 font-bold">vs</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setAwayScore(s => Math.max(0, s - 1))}
              className="w-9 h-9 bg-slate-700 rounded-lg text-white font-bold text-lg flex items-center justify-center active:bg-slate-600">−</button>
            <span className="text-3xl font-black text-white tabular-nums w-8 text-center">{awayScore}</span>
            <button onClick={() => setAwayScore(s => s + 1)}
              className="w-9 h-9 bg-slate-700 rounded-lg text-white font-bold text-lg flex items-center justify-center active:bg-slate-600">+</button>
          </div>
          <div className="flex-1 flex items-center gap-2 justify-end">
            <span className="text-slate-300 text-xs font-medium truncate text-right">{awayTeam?.name}</span>
            <div className={`w-3 h-3 rounded-full shrink-0 ${COLOUR_DOT[awayTeam?.colour ?? 'red']}`} />
          </div>
        </div>
      </div>

      {/* ── Team panels ───────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">
        {[homeTeam, awayTeam].map(team => {
          if (!team) return null;
          const playing  = team.players.filter(p => playerStates[p.id]?.status === 'playing');
          const bench    = team.players.filter(p => playerStates[p.id]?.status === 'bench');
          const injured  = team.players.filter(p => playerStates[p.id]?.status === 'injured');
          const count    = pitchCount(team);
          const target   = pitchTarget(team);
          const over     = count > target;
          const under    = count < target;

          return (
            <div key={team.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              {/* Team header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                <div className={`w-3 h-3 rounded-full shrink-0 ${COLOUR_DOT[team.colour]}`} />
                <span className="text-white font-bold text-sm flex-1">{team.name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  over  ? 'bg-amber-800 text-amber-300' :
                  under ? 'bg-red-900 text-red-300' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {count}/{target} on pitch
                  {over  && ' ▲ too many'}
                  {under && ' ▼ too few'}
                </span>
                {/* Add late player button */}
                <button
                  onClick={() => setShowAddPlayer(team.id)}
                  className="ml-1 text-slate-400 hover:text-green-400 text-lg leading-none transition-colors"
                  title="Add late player"
                >
                  +
                </button>
              </div>

              {/* Playing */}
              <div className="px-3 py-2 space-y-1.5">
                {playing.map(player => (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    status="playing"
                    totalMinutes={getLiveMinutes(player.id)}
                    onTap={() => handlePlayerTap(player.id)}
                    onInjure={() => handleInjure(player.id)}
                  />
                ))}
              </div>

              {/* Bench */}
              {bench.length > 0 && (
                <div className="px-3 pb-3 border-t border-slate-700/60">
                  <p className="text-slate-500 text-xs uppercase tracking-widest py-2 px-1">Bench</p>
                  <div className="space-y-1.5">
                    {bench.map(player => (
                      <PlayerChip
                        key={player.id}
                        player={player}
                        status="bench"
                        totalMinutes={getLiveMinutes(player.id)}
                        onTap={() => handlePlayerTap(player.id)}
                        onInjure={() => handleInjure(player.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Injured */}
              {injured.length > 0 && (
                <div className="px-3 pb-3 border-t border-red-900/40">
                  <p className="text-red-400 text-xs uppercase tracking-widest py-2 px-1">Injured</p>
                  <div className="space-y-1.5">
                    {injured.map(player => (
                      <PlayerChip
                        key={player.id}
                        player={player}
                        status="injured"
                        totalMinutes={getLiveMinutes(player.id)}
                        onTap={() => handleUninjure(player.id)}
                        onInjure={() => {}}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Resting teams */}
        {localTeams
          .filter(t => t.id !== currentMatch.home_team_id && t.id !== currentMatch.away_team_id)
          .map(team => (
            <div key={team.id} className="bg-slate-800/40 rounded-2xl border border-slate-700/40 px-4 py-3 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${COLOUR_DOT[team.colour]}`} />
              <span className="text-slate-500 text-sm">{team.name} — resting this match</span>
            </div>
          ))}
      </div>

      {/* ── Fixed bottom bar ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-4 space-y-2">
        {saveError && <p className="text-red-400 text-xs text-center">{saveError}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => setShowMinutes(true)}
            className="flex-1 py-3.5 rounded-2xl bg-slate-700 text-slate-300 font-semibold text-sm"
          >
            All Minutes
          </button>
          <button
            onClick={() => setShowConfirmEnd(true)}
            disabled={saving}
            className="flex-[2] py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-sm transition-colors"
          >
            {saving ? 'Saving…' : matchIdx < matches.length - 1 ? 'End Match →' : 'End Session ✓'}
          </button>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {showMinutes && (
        <MinutesSummary
          teams={localTeams}
          getLiveMinutes={getLiveMinutes}
          injuredIds={injuredIds}
          format={format}
          matchCount={matchIdx + 1}
          onClose={() => setShowMinutes(false)}
        />
      )}

      {showConfirmEnd && (
        <ConfirmEndModal
          matchNumber={currentMatch.match_number}
          totalMatches={totalMatches}
          isLastMatch={matchIdx === matches.length - 1}
          homeTeamName={homeTeam?.name ?? ''}
          awayTeamName={awayTeam?.name ?? ''}
          homeScore={homeScore}
          awayScore={awayScore}
          timerSeconds={timerSeconds}
          onConfirm={() => { setShowConfirmEnd(false); handleMatchComplete(true); }}
          onCancel={() => setShowConfirmEnd(false)}
        />
      )}

      {showAddPlayer && (
        <AddLatePlayerModal
          sessionId={sessionId}
          teamId={showAddPlayer}
          localTeams={localTeams}
          onAdd={handleAddLatePlayer}
          onClose={() => setShowAddPlayer(null)}
        />
      )}

      {pendingSuggestion && (
        <SubSuggestions
          suggestion={pendingSuggestion.suggestion}
          nextMatchNumber={matches[pendingSuggestion.nextMatchIdx]?.match_number ?? pendingSuggestion.nextMatchIdx + 1}
          totalMatches={matches.length}
          teams={localTeams}
          playerMap={playerMap}
          onApply={handleApplySuggestion}
          onSkip={handleSkipSuggestion}
        />
      )}
    </div>
  );
}

// ─── Player chip ──────────────────────────────────────────────────────────────

function PlayerChip({
  player, status, totalMinutes, onTap, onInjure,
}: {
  player: PlayerData;
  status: PlayerStatus;
  totalMinutes: number;
  onTap: () => void;
  onInjure: () => void;
}) {
  const pos = normalisePos(player.preferred_position);
  const isPlaying = status === 'playing';
  const isInjured = status === 'injured';

  return (
    <div className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl ${
      isInjured ? 'bg-red-950/40 border border-red-900/40 opacity-70' :
      isPlaying  ? 'bg-green-900/30 border border-green-800/50' :
                   'bg-slate-700/30 border border-slate-700 opacity-60'
    }`}>
      <button onClick={onTap} className="flex items-center gap-2.5 flex-1 min-w-0 active:opacity-70">
        <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_BADGE[pos]}`}>
          {pos}
        </span>
        <span className="text-white text-sm font-medium flex-1 text-left truncate">
          {player.first_name} {player.last_name}
        </span>
        <span className={`text-xs font-semibold shrink-0 ${
          totalMinutes >= 20 ? 'text-green-400' :
          totalMinutes >= 10 ? 'text-amber-400' : 'text-slate-400'
        }`}>
          {totalMinutes}m
        </span>
        <span className={`text-xs shrink-0 ${
          isInjured ? 'text-red-400' :
          isPlaying  ? 'text-green-500' : 'text-slate-500'
        }`}>
          {isInjured ? 'injured — tap to clear' : isPlaying ? '↓ sub off' : '↑ sub on'}
        </span>
      </button>

      {/* Injury toggle — only on non-injured players */}
      {!isInjured && (
        <button
          onClick={onInjure}
          className="shrink-0 w-7 h-7 rounded-lg bg-red-900/30 hover:bg-red-800/50 text-red-400 text-xs flex items-center justify-center transition-colors"
          title="Mark injured"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Confirm end modal ────────────────────────────────────────────────────────

function ConfirmEndModal({
  matchNumber, totalMatches, isLastMatch,
  homeTeamName, awayTeamName, homeScore, awayScore,
  timerSeconds, onConfirm, onCancel,
}: {
  matchNumber: number;
  totalMatches: number;
  isLastMatch: boolean;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  timerSeconds: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
      <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-5 border border-slate-700">
        <div className="text-center space-y-1">
          <h3 className="text-white font-bold text-lg">
            {isLastMatch ? 'End session?' : `End Match ${matchNumber} of ${totalMatches}?`}
          </h3>
          <p className="text-slate-400 text-sm">{formatTime(timerSeconds)} played</p>
        </div>

        {/* Score summary */}
        <div className="bg-slate-700/50 rounded-2xl px-5 py-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-300 text-sm font-medium truncate max-w-[80px]">{homeTeamName}</span>
            <span className="text-white text-3xl font-black tabular-nums">
              {homeScore} – {awayScore}
            </span>
            <span className="text-slate-300 text-sm font-medium truncate max-w-[80px]">{awayTeamName}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-2xl font-bold text-base transition-colors"
          >
            {isLastMatch ? 'Yes, end session' : 'Yes, end match'}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl font-semibold text-base transition-colors"
          >
            Cancel — keep playing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add late player modal ────────────────────────────────────────────────────

function AddLatePlayerModal({
  sessionId, teamId, localTeams, onAdd, onClose,
}: {
  sessionId: string;
  teamId: string;
  localTeams: TeamData[];
  onAdd: (teamId: string, player: PlayerData) => void;
  onClose: () => void;
}) {
  const [available, setAvailable] = useState<PlayerData[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // All present players in this session's attendance
      const { data } = await supabase
        .from('attendance')
        .select('players(id, first_name, last_name, preferred_position, ability_rating)')
        .eq('session_id', sessionId)
        .eq('present', true);

      // Filter out players already assigned to any team
      const inTeam = new Set(localTeams.flatMap(t => t.players.map(p => p.id)));

      const players: PlayerData[] = (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => (Array.isArray(r.players) ? r.players[0] : r.players))
        .filter((p: PlayerData | null): p is PlayerData => !!p && !inTeam.has(p.id));

      setAvailable(players);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const team = localTeams.find(t => t.id === teamId);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="bg-slate-800 rounded-t-3xl w-full max-w-md border-t border-slate-700 flex flex-col max-h-[75vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700">
          <div>
            <h3 className="text-white font-bold text-base">Add late player</h3>
            <p className="text-slate-400 text-sm">To {team?.name} — starts on bench</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && available.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              No unassigned players on the attendance list.
            </div>
          )}

          {!loading && available.map(player => {
            const pos = normalisePos(player.preferred_position);
            return (
              <button
                key={player.id}
                onClick={() => onAdd(teamId, player)}
                className="w-full flex items-center gap-3 bg-slate-700/50 hover:bg-slate-700 active:bg-slate-600 px-4 py-3.5 rounded-xl transition-colors"
              >
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${POSITION_BADGE[pos]}`}>
                  {pos}
                </span>
                <span className="text-white font-medium text-sm flex-1 text-left">
                  {player.first_name} {player.last_name}
                </span>
                <span className="text-green-400 text-sm font-semibold">Add →</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Minutes summary sheet ────────────────────────────────────────────────────

function MinutesSummary({
  teams, getLiveMinutes, injuredIds, format, matchCount, onClose,
}: {
  teams: TeamData[];
  getLiveMinutes: (id: string) => number;
  injuredIds: Set<string>;
  format: number;
  matchCount: number;
  onClose: () => void;
}) {
  const maxMinutes = matchCount * format;

  const allPlayers = useMemo(() => {
    const seen = new Set<string>();
    const result: (PlayerData & { teamName: string; teamColour: string; injured: boolean })[] = [];
    teams.forEach(team => {
      team.players.forEach(p => {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          result.push({ ...p, teamName: team.name, teamColour: team.colour, injured: injuredIds.has(p.id) });
        }
      });
    });
    return result.sort((a, b) => getLiveMinutes(b.id) - getLiveMinutes(a.id));
  }, [teams, getLiveMinutes, injuredIds]);

  return (
    <div className="fixed inset-0 z-30 bg-slate-900/95 flex flex-col">
      <div className="flex items-center justify-between px-6 pt-8 pb-4 border-b border-slate-800">
        <h2 className="text-white font-bold text-lg">Minutes Tonight</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
        {allPlayers.map(player => {
          const mins = getLiveMinutes(player.id);
          const pct  = Math.min(100, maxMinutes > 0 ? (mins / maxMinutes) * 100 : 0);
          const barColour = player.injured ? 'bg-red-600' :
                            pct >= 60 ? 'bg-green-500' :
                            pct >= 30 ? 'bg-amber-500' : 'bg-red-500';

          return (
            <div key={player.id} className={`rounded-xl px-4 py-3 ${player.injured ? 'bg-red-950/30 border border-red-900/30' : 'bg-slate-800'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${COLOUR_DOT[player.teamColour]}`} />
                  <span className="text-white text-sm font-medium">
                    {player.first_name} {player.last_name}
                  </span>
                  {player.injured && (
                    <span className="text-red-400 text-xs">injured</span>
                  )}
                </div>
                <span className="text-white font-bold text-sm tabular-nums">{mins}m</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColour}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-slate-500 text-xs text-center">
          Max possible: {maxMinutes} min/player · Tap player cards to sub
        </p>
      </div>
    </div>
  );
}
