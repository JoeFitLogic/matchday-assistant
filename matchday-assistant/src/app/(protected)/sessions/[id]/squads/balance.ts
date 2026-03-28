// ─── Types ────────────────────────────────────────────────────────────────────

export const FORMATS = [4, 5, 7, 9, 11] as const;
export type Format = (typeof FORMATS)[number];
export type Position = 'GK' | 'DEF' | 'MID' | 'ATT' | 'ANY';

export type PlayerData = {
  id: string;
  first_name: string;
  last_name: string;
  ability_rating: number | null;
  preferred_position: string | null;
};

// ─── Position helpers ─────────────────────────────────────────────────────────

export function normalisePosition(pos: string | null): Position {
  if (!pos) return 'ANY';
  const p = pos.toUpperCase().trim();
  if (p === 'GK' || p.startsWith('GOAL') || p.includes('KEEPER')) return 'GK';
  if (['CB', 'LB', 'RB', 'DEF', 'BACK', 'DEFENDER'].some(s => p.includes(s))) return 'DEF';
  if (['CM', 'DM', 'AM', 'MID', 'MIDFIELDER'].some(s => p.includes(s))) return 'MID';
  if (['ST', 'CF', 'FW', 'LW', 'RW', 'ATT', 'FORWARD', 'STRIKER', 'WING'].some(s => p.includes(s))) return 'ATT';
  return 'ANY';
}

export function requiresGk(format: Format): boolean {
  return format !== 4;
}

// ─── Squad math ───────────────────────────────────────────────────────────────

export function suggestTeamCount(playerCount: number, format: Format): number {
  return Math.max(2, Math.floor(playerCount / format));
}

export function calcSubs(playerCount: number, format: Format, numTeams: number): number {
  return playerCount - numTeams * format;
}

export function teamAvgRating(playerIds: string[], playerMap: Map<string, PlayerData>): number {
  if (playerIds.length === 0) return 0;
  const sum = playerIds.reduce((acc, id) => acc + (playerMap.get(id)?.ability_rating ?? 3), 0);
  return sum / playerIds.length;
}

// ─── Balance algorithm ────────────────────────────────────────────────────────

/**
 * Snake draft: top player → team 0, next → team 1, ..., team n-1, team n-1, ..., team 0, repeat
 * This guarantees even distribution of high-rated players.
 */
function snakeDraft(sorted: PlayerData[], teams: string[][], numTeams: number) {
  let dir = 1;
  let idx = 0;
  for (const p of sorted) {
    teams[idx].push(p.id);
    idx += dir;
    if (idx >= numTeams) { idx = numTeams - 1; dir = -1; }
    else if (idx < 0)    { idx = 0;            dir = 1; }
  }
}

/** Shuffle within ability tiers for variety without destroying balance. */
function tierShuffle(players: PlayerData[]): PlayerData[] {
  const result: PlayerData[] = [];
  let i = 0;
  while (i < players.length) {
    const tier = players[i].ability_rating ?? 3;
    let j = i;
    while (j < players.length && (players[j].ability_rating ?? 3) === tier) j++;
    const tierGroup = players.slice(i, j).sort(() => Math.random() - 0.5);
    result.push(...tierGroup);
    i = j;
  }
  return result;
}

export type BalanceResult = {
  teams: string[][];   // playerIds per team (index matches team order)
  gkWarning: boolean;  // true if some teams have no GK
};

export function autoBalance(
  players: PlayerData[],
  numTeams: number,
  format: Format,
  locked: Set<string>,       // player IDs to keep in their current team
  currentTeams: string[][],  // existing assignments (for locked-player lookup)
): BalanceResult {
  const teams: string[][] = Array.from({ length: numTeams }, () => []);

  // ── 1. Place locked players into their current team (if still valid) ──────
  const unlockedPlayers: PlayerData[] = [];
  for (const player of players) {
    if (!locked.has(player.id)) {
      unlockedPlayers.push(player);
      continue;
    }
    const teamIdx = currentTeams.findIndex(t => t.includes(player.id));
    if (teamIdx >= 0 && teamIdx < numTeams) {
      teams[teamIdx].push(player.id);
    } else {
      unlockedPlayers.push(player); // locked but team gone — treat as unlocked
    }
  }

  let gkWarning = false;

  if (requiresGk(format)) {
    // ── 2. Separate GKs from outfield ───────────────────────────────────────
    const gks    = unlockedPlayers.filter(p => normalisePosition(p.preferred_position) === 'GK');
    const nonGks = unlockedPlayers.filter(p => normalisePosition(p.preferred_position) !== 'GK');

    // Find teams that don't already have a locked GK
    const playerMap = new Map(players.map(p => [p.id, p]));
    const teamsNeedingGk = teams
      .map((team, i) => ({ i, hasGk: team.some(id => normalisePosition(playerMap.get(id)?.preferred_position ?? null) === 'GK') }))
      .filter(t => !t.hasGk)
      .map(t => t.i);

    // Assign one GK per team that needs one, round-robin for extras
    const shuffledGks = [...gks].sort(() => Math.random() - 0.5);
    shuffledGks.forEach((gk, i) => {
      const target = teamsNeedingGk[i] ?? i % numTeams;
      teams[target].push(gk.id);
    });

    if (shuffledGks.length < teamsNeedingGk.length) {
      gkWarning = true;
    }

    // ── 3. Snake-draft outfield players by ability ───────────────────────────
    const sorted = tierShuffle(
      [...nonGks].sort((a, b) => (b.ability_rating ?? 3) - (a.ability_rating ?? 3))
    );
    snakeDraft(sorted, teams, numTeams);
  } else {
    // 4-a-side: pure ability balance, ignore position
    const sorted = tierShuffle(
      [...unlockedPlayers].sort((a, b) => (b.ability_rating ?? 3) - (a.ability_rating ?? 3))
    );
    snakeDraft(sorted, teams, numTeams);
  }

  return { teams: teams.map(t => Array.from(new Set(t))), gkWarning };
}
