import type { AbilityCategory, Player } from "@/lib/types/database";

const ABILITY_SCORE: Record<AbilityCategory, number> = {
  Advanced: 3,
  Intermediate: 2,
  Developing: 1,
};

function scoreOf(p: Player): number {
  return ABILITY_SCORE[p.ability_category ?? "Intermediate"];
}

type Unit = {
  players: Player[];
  totalScore: number;
  separations: Set<string>; // separation_group values on this unit
};

/**
 * Group players by pair_group (pairs must go together). Each unit is 1+ players.
 * Separation groups are kept as a hint — we try to avoid two units with the same
 * separation_group landing on the same team.
 */
function buildUnits(players: Player[]): Unit[] {
  const grouped = new Map<string, Player[]>();
  const units: Unit[] = [];
  for (const p of players) {
    const key = p.pair_group?.trim();
    if (!key) {
      units.push({
        players: [p],
        totalScore: scoreOf(p),
        separations: new Set(p.separation_group ? [p.separation_group] : []),
      });
      continue;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }
  for (const members of grouped.values()) {
    const separations = new Set<string>();
    for (const m of members) if (m.separation_group) separations.add(m.separation_group);
    units.push({
      players: members,
      totalScore: members.reduce((s, m) => s + scoreOf(m), 0),
      separations,
    });
  }
  return units;
}

function hasSeparationConflict(team: Unit[], unit: Unit): boolean {
  if (unit.separations.size === 0) return false;
  for (const t of team) {
    for (const sep of t.separations) {
      if (unit.separations.has(sep)) return true;
    }
  }
  return false;
}

export type BalancedTeam = { players: Player[]; totalScore: number };

/**
 * Ability-balanced team generator.
 *
 * Algorithm:
 *   1. Group into units (pair_group members stay glued together).
 *   2. Sort units by score desc (largest impact first).
 *   3. Greedy assign each unit to the team that (a) doesn't break separation groups
 *      and (b) has the lowest running score. Ties broken by fewest players.
 *
 * Good enough for squads up to ~30 with 2–5 teams. Not optimal but fast and
 * deterministic, and the coach always gets two-tap manual swap.
 */
export function balanceTeams(players: Player[], numTeams: number): BalancedTeam[] {
  if (numTeams <= 0) return [];
  const teams: Unit[][] = Array.from({ length: numTeams }, () => []);
  const teamScores = new Array(numTeams).fill(0);
  const teamSizes = new Array(numTeams).fill(0);

  const units = buildUnits(players).sort((a, b) => b.totalScore - a.totalScore);

  for (const unit of units) {
    let best = -1;
    for (let i = 0; i < numTeams; i++) {
      if (hasSeparationConflict(teams[i], unit)) continue;
      if (best === -1) {
        best = i;
        continue;
      }
      if (teamScores[i] < teamScores[best]) best = i;
      else if (teamScores[i] === teamScores[best] && teamSizes[i] < teamSizes[best]) best = i;
    }
    if (best === -1) {
      // All teams conflict on separation — fall back to lowest score.
      best = teamScores.indexOf(Math.min(...teamScores));
    }
    teams[best].push(unit);
    teamScores[best] += unit.totalScore;
    teamSizes[best] += unit.players.length;
  }

  return teams.map((team) => ({
    players: team.flatMap((u) => u.players),
    totalScore: team.reduce((s, u) => s + u.totalScore, 0),
  }));
}
