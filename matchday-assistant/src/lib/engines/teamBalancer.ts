import type { AbilityCategory, Player } from "@/lib/types/database";

const ABILITY_SCORE: Record<AbilityCategory, number> = {
  Advanced: 3,
  Intermediate: 2,
  Developing: 1,
};

function scoreOf(p: Player): number {
  return ABILITY_SCORE[p.ability_category ?? "Intermediate"];
}

export function isGoalkeeper(p: Player): boolean {
  return (p.preferred_position ?? "").toUpperCase() === "GK";
}

type Unit = {
  players: Player[];
  totalScore: number;
  separations: Set<string>;
};

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
 * Ability-balanced team generator with goalkeeper-first distribution.
 *
 * Algorithm:
 *   1. Split goalkeepers from outfield players.
 *   2. Sort goalkeepers by ability (strongest first) and distribute one to
 *      each team in order. Any extra GKs go back into the outfield pool so
 *      they still get a game.
 *   3. For the remaining outfield players, group by pair_group (units glued
 *      together), sort by ability score descending, then greedy-assign each
 *      unit to the team with the lowest running total — skipping teams that
 *      would break a separation_group constraint.
 *
 * This keeps teams balanced by:
 *   - Guaranteeing a keeper in every team (when enough keepers exist)
 *   - Spreading Advanced/Intermediate/Developing evenly via the score sum
 *   - Respecting pair_group (friends stay together) and
 *     separation_group (certain kids kept apart)
 */
export function balanceTeams(players: Player[], numTeams: number): BalancedTeam[] {
  if (numTeams <= 0) return [];

  const teams: Unit[][] = Array.from({ length: numTeams }, () => []);
  const teamScores = new Array(numTeams).fill(0);
  const teamSizes = new Array(numTeams).fill(0);

  // 1. Goalkeepers: one per team, strongest first.
  const gks = players.filter(isGoalkeeper).sort((a, b) => scoreOf(b) - scoreOf(a));
  const outfieldStart = players.filter((p) => !isGoalkeeper(p));

  const extraGks: Player[] = [];
  gks.forEach((gk, idx) => {
    if (idx < numTeams) {
      const unit: Unit = {
        players: [gk],
        totalScore: scoreOf(gk),
        separations: new Set(gk.separation_group ? [gk.separation_group] : []),
      };
      teams[idx].push(unit);
      teamScores[idx] += unit.totalScore;
      teamSizes[idx] += 1;
    } else {
      extraGks.push(gk);
    }
  });

  // 2. Outfield units (plus any surplus keepers), greedy balance.
  const units = buildUnits([...outfieldStart, ...extraGks]).sort(
    (a, b) => b.totalScore - a.totalScore
  );

  for (const unit of units) {
    let best = -1;
    for (let i = 0; i < numTeams; i++) {
      if (hasSeparationConflict(teams[i], unit)) continue;
      if (best === -1) {
        best = i;
        continue;
      }
      if (teamScores[i] < teamScores[best]) best = i;
      else if (teamScores[i] === teamScores[best] && teamSizes[i] < teamSizes[best])
        best = i;
    }
    if (best === -1) {
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
