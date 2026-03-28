/**
 * Smart substitution suggestion engine.
 * Pure functions — no React, no Supabase. Fully testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type Position = 'GK' | 'DEF' | 'MID' | 'ATT' | 'ANY';

export type SuggestionPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_position: string | null;
};

export type WarningLevel = 'error' | 'warn' | 'info';

export type Warning = {
  level: WarningLevel;
  playerId?: string;
  message: string;
};

export type PlayerSuggestion = {
  playerId: string;
  role: 'starter' | 'bench';
  isGk: boolean;
  reason: string;       // short human-readable reason
  totalMins: number;
  wasOnBench: boolean;  // was bench in the just-ended match
  hasNotPlayed: boolean;
};

export type TeamSuggestion = {
  teamId: string;
  teamName: string;
  players: PlayerSuggestion[];
  warnings: Warning[];
};

export type MatchSuggestion = {
  teams: TeamSuggestion[];
  globalWarnings: Warning[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalisePosition(pos: string | null): Position {
  if (!pos) return 'ANY';
  const p = pos.toUpperCase().trim();
  if (p === 'GK' || p.startsWith('GOAL') || p.includes('KEEPER')) return 'GK';
  if (['CB','LB','RB','DEF','BACK','DEFENDER'].some(s => p.includes(s))) return 'DEF';
  if (['CM','DM','AM','MID','MIDFIELDER'].some(s => p.includes(s))) return 'MID';
  if (['ST','CF','FW','LW','RW','ATT','FORWARD','STRIKER','WING'].some(s => p.includes(s))) return 'ATT';
  return 'ANY';
}

export function formatRequiresGk(format: number): boolean {
  return format !== 4;
}

// ─── Per-player priority scoring ─────────────────────────────────────────────
//
// Lower score = higher priority to start.
// Factors:
//   1. Haven't played at all (-500) — urgent
//   2. Was bench last match (-100) — fairness
//   3. Total minutes (base) — equalise across session
//   4. Estimated matches played bonus for those near minimum target

function priorityScore(
  playerId: string,
  completedMinutes: Record<string, number>,
  prevBench: Set<string>,
): number {
  const mins = completedMinutes[playerId] ?? 0;
  const wasOnBench = prevBench.has(playerId);
  const hasNotPlayed = mins === 0;

  let score = mins;
  if (wasOnBench)    score -= 100;
  if (hasNotPlayed)  score -= 500;

  return score;
}

// ─── Core algorithm: suggest lineup for one team ──────────────────────────────

function suggestForTeam({
  teamId,
  teamName,
  players,
  format,
  completedMinutes,
  prevBench,
  nextMatchNumber,
  totalMatches,
}: {
  teamId: string;
  teamName: string;
  players: SuggestionPlayer[];
  format: number;
  completedMinutes: Record<string, number>;
  prevBench: Set<string>;
  nextMatchNumber: number;
  totalMatches: number;
}): TeamSuggestion {
  const needsGk = formatRequiresGk(format);
  const warnings: Warning[] = [];

  // Score every player
  const scored = players.map(p => ({
    player: p,
    pos: normalisePosition(p.preferred_position),
    score: priorityScore(p.id, completedMinutes, prevBench),
    totalMins: completedMinutes[p.id] ?? 0,
    wasOnBench: prevBench.has(p.id),
    hasNotPlayed: (completedMinutes[p.id] ?? 0) === 0,
  }));

  const starterIds = new Set<string>();
  let gkPlayerId: string | null = null;

  // ── GK handling ────────────────────────────────────────────────────────────
  if (needsGk) {
    const gkCandidates = scored
      .filter(s => s.pos === 'GK')
      .sort((a, b) => a.score - b.score);

    if (gkCandidates.length === 0) {
      warnings.push({ level: 'error', message: 'No goalkeeper available — assign one manually' });
    } else {
      gkPlayerId = gkCandidates[0].player.id;
      starterIds.add(gkPlayerId);

      // If only one GK and they've played every match: flag for rotation awareness
      if (gkCandidates.length === 1 && gkCandidates[0].totalMins > 0) {
        warnings.push({
          level: 'info',
          playerId: gkPlayerId,
          message: `Only one GK (${gkCandidates[0].player.first_name}) — no rotation possible`,
        });
      }
    }
  }

  // ── Outfield starters ─────────────────────────────────────────────────────
  const outfield = scored
    .filter(s => !starterIds.has(s.player.id) && s.pos !== 'GK')
    .sort((a, b) => a.score - b.score);

  const nonGkStarters = scored
    .filter(s => !starterIds.has(s.player.id) && (needsGk ? s.pos !== 'GK' : true))
    .sort((a, b) => a.score - b.score);

  const spotsLeft = format - starterIds.size;
  nonGkStarters.slice(0, spotsLeft).forEach(s => starterIds.add(s.player.id));

  // If 4-a-side or not enough outfield: also consider GKs as outfield
  if (starterIds.size < format) {
    const extras = scored
      .filter(s => !starterIds.has(s.player.id))
      .sort((a, b) => a.score - b.score);
    extras.slice(0, format - starterIds.size).forEach(s => starterIds.add(s.player.id));
  }

  // ── Build player suggestion list ──────────────────────────────────────────

  // Team average minutes (for below-average warning)
  const avgMins = players.length > 0
    ? players.reduce((sum, p) => sum + (completedMinutes[p.id] ?? 0), 0) / players.length
    : 0;

  // Minimum match target: 60% of total matches
  const minMatchTarget = Math.ceil(totalMatches * 0.6);
  const matchesRemaining = totalMatches - nextMatchNumber + 1;

  const playerSuggestions: PlayerSuggestion[] = scored.map(s => {
    const isStarter = starterIds.has(s.player.id);
    const isGk = s.player.id === gkPlayerId;

    // Build reason string
    let reason = '';
    if (s.hasNotPlayed) {
      reason = "Hasn't played — needs game time";
    } else if (s.wasOnBench && isStarter) {
      reason = 'Was bench last match — promoted';
    } else if (!s.wasOnBench && !isStarter) {
      reason = 'Played last match — resting';
    } else if (isGk) {
      reason = s.totalMins === 0 ? 'GK — first start' : 'GK — fewest minutes';
    } else if (isStarter) {
      reason = s.totalMins < avgMins * 0.7 ? 'Below session average' : 'Balanced rotation';
    } else {
      reason = 'More minutes than teammates';
    }

    // Per-player warnings
    if (s.hasNotPlayed) {
      warnings.push({
        level: 'error',
        playerId: s.player.id,
        message: `${s.player.first_name} hasn't played at all yet!`,
      });
    }

    // At-risk: can't reach minimum even playing every remaining match
    const estimatedMatchesPlayed = s.totalMins > 0
      ? Math.max(1, Math.round(s.totalMins / Math.max(1, format)))
      : 0;
    const maxPossibleMatches = estimatedMatchesPlayed + matchesRemaining;

    if (!s.hasNotPlayed && maxPossibleMatches < minMatchTarget) {
      warnings.push({
        level: 'warn',
        playerId: s.player.id,
        message: `${s.player.first_name} may not reach minimum play target (${minMatchTarget} matches)`,
      });
    }

    return {
      playerId: s.player.id,
      role: isStarter ? 'starter' : 'bench',
      isGk,
      reason,
      totalMins: s.totalMins,
      wasOnBench: s.wasOnBench,
      hasNotPlayed: s.hasNotPlayed,
    };
  });

  // Deduplicate warnings (same player may get multiple)
  const seenWarnings = new Set<string>();
  const dedupedWarnings = warnings.filter(w => {
    const key = `${w.playerId}:${w.message}`;
    if (seenWarnings.has(key)) return false;
    seenWarnings.add(key);
    return true;
  });

  return {
    teamId,
    teamName,
    players: playerSuggestions,
    warnings: dedupedWarnings,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type SuggestMatchInput = {
  nextMatchHomeTeam: { id: string; name: string; players: SuggestionPlayer[] };
  nextMatchAwayTeam: { id: string; name: string; players: SuggestionPlayer[] };
  format: number;
  completedMinutes: Record<string, number>;
  /** Player IDs that were on the bench in the just-completed match */
  prevBenchPlayerIds: string[];
  /** Player IDs to exclude entirely (injured, withdrawn, etc.) */
  excludedPlayerIds?: string[];
  nextMatchNumber: number;
  totalMatches: number;
};

export function computeSuggestions(input: SuggestMatchInput): MatchSuggestion {
  const {
    nextMatchHomeTeam,
    nextMatchAwayTeam,
    format,
    completedMinutes,
    prevBenchPlayerIds,
    excludedPlayerIds = [],
    nextMatchNumber,
    totalMatches,
  } = input;

  const prevBench = new Set(prevBenchPlayerIds);
  const excluded  = new Set(excludedPlayerIds);

  // Strip injured/excluded players from team rosters before suggesting
  const homePlayers = nextMatchHomeTeam.players.filter(p => !excluded.has(p.id));
  const awayPlayers = nextMatchAwayTeam.players.filter(p => !excluded.has(p.id));

  const shared = { format, completedMinutes, prevBench, nextMatchNumber, totalMatches };

  const homeTeamSuggestion = suggestForTeam({ ...shared, teamId: nextMatchHomeTeam.id, teamName: nextMatchHomeTeam.name, players: homePlayers });
  const awayTeamSuggestion = suggestForTeam({ ...shared, teamId: nextMatchAwayTeam.id, teamName: nextMatchAwayTeam.name, players: awayPlayers });

  // Global warnings: players across the whole session who need attention
  const globalWarnings: Warning[] = [];

  // Players in the next match who haven't played yet
  const allPresentIds = new Set([
    ...homePlayers.map(p => p.id),
    ...awayPlayers.map(p => p.id),
  ]);
  const unplayedInMatch = Array.from(allPresentIds).filter(id => (completedMinutes[id] ?? 0) === 0);
  if (unplayedInMatch.length > 0) {
    globalWarnings.push({
      level: 'warn',
      message: `${unplayedInMatch.length} player(s) haven't played — check upcoming matches`,
    });
  }

  return {
    teams: [homeTeamSuggestion, awayTeamSuggestion],
    globalWarnings,
  };
}
