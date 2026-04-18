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

/** Minimal team shape the balancer needs. */
export type BalancerTeam = {
  id: string;
  slot_number: number;
};

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

/**
 * Build the order in which teams receive goalkeepers. We cycle across slots
 * first so that if only N goalkeepers are available across M teams, the GKs
 * are spread across slots rather than piling into one slot.
 *
 *   slots: [[t1,t2], [t3,t4]] → GK rotation: [t1, t3, t2, t4]
 *
 * That way with 2 GKs: t1 and t3 each get one — one per slot.
 * With 4 GKs: each team gets one.
 */
function goalkeeperRotation(teams: readonly BalancerTeam[]): BalancerTeam[] {
  const bySlot = new Map<number, BalancerTeam[]>();
  for (const t of teams) {
    if (!bySlot.has(t.slot_number)) bySlot.set(t.slot_number, []);
    bySlot.get(t.slot_number)!.push(t);
  }
  const slotGroups = Array.from(bySlot.entries())
    .sort(([a], [b]) => a - b)
    .map(([, list]) => list);
  const out: BalancerTeam[] = [];
  const maxLen = Math.max(0, ...slotGroups.map((g) => g.length));
  for (let i = 0; i < maxLen; i++) {
    for (const g of slotGroups) {
      if (g[i]) out.push(g[i]);
    }
  }
  return out;
}

/**
 * Slot-aware ability-balanced team generator.
 *
 * Returns a Map of teamId → players assigned to that team.
 *
 * Algorithm:
 *   1. Split goalkeepers from outfield players.
 *   2. Distribute GKs across teams using a slot-interleaved rotation so that
 *      every slot gets at least one keeper before any slot gets two.
 *      Extra GKs (more keepers than teams) fall back into the outfield pool
 *      — they still play.
 *   3. Build units (pair_group glues players together) sorted by score desc.
 *   4. Greedy-assign each unit to the team with the lowest running ability
 *      score (ties broken by team size) — skipping teams that would break a
 *      separation_group constraint. This naturally balances ability across
 *      teams AND across slots, because every team is competing for the same
 *      pool and overall slot totals even out.
 *
 * Siblings (same pair_group) stay on the same team and therefore in the same
 * slot. That matches Livingston's weekly convention: siblings arrive and
 * leave at the same time regardless of which of the slot's teams they play on.
 */
export function balanceTeams(
  players: Player[],
  teams: readonly BalancerTeam[]
): Map<string, Player[]> {
  const result = new Map<string, Player[]>();
  const scores = new Map<string, number>();
  const seps = new Map<string, Set<string>>();
  for (const t of teams) {
    result.set(t.id, []);
    scores.set(t.id, 0);
    seps.set(t.id, new Set());
  }

  if (teams.length === 0 || players.length === 0) return result;

  // 1. Goalkeepers — slot-interleaved rotation.
  const rotation = goalkeeperRotation(teams);
  const gks = players.filter(isGoalkeeper).sort((a, b) => scoreOf(b) - scoreOf(a));
  const extraGks: Player[] = [];
  gks.forEach((gk, i) => {
    if (i < rotation.length) {
      const t = rotation[i];
      result.get(t.id)!.push(gk);
      scores.set(t.id, scores.get(t.id)! + scoreOf(gk));
      if (gk.separation_group) seps.get(t.id)!.add(gk.separation_group);
    } else {
      extraGks.push(gk);
    }
  });

  // 2. Outfield players + surplus GKs, built into pair/separation units.
  const outfieldPool = [...players.filter((p) => !isGoalkeeper(p)), ...extraGks];
  const units = buildUnits(outfieldPool).sort((a, b) => b.totalScore - a.totalScore);

  for (const unit of units) {
    let best: string | null = null;
    for (const t of teams) {
      const teamSeps = seps.get(t.id)!;
      let conflict = false;
      for (const s of unit.separations) {
        if (teamSeps.has(s)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;
      if (best === null) {
        best = t.id;
        continue;
      }
      const currScore = scores.get(t.id)!;
      const bestScore = scores.get(best)!;
      if (currScore < bestScore) {
        best = t.id;
      } else if (
        currScore === bestScore &&
        result.get(t.id)!.length < result.get(best)!.length
      ) {
        best = t.id;
      }
    }

    // Fallback: no team accepts the unit due to separation conflicts everywhere.
    // Drop to the team with the lowest score and accept the conflict.
    if (best === null) {
      best = teams.reduce((acc, t) =>
        scores.get(t.id)! < scores.get(acc.id)! ? t : acc
      ).id;
    }

    for (const p of unit.players) result.get(best)!.push(p);
    scores.set(best, scores.get(best)! + unit.totalScore);
    for (const s of unit.separations) seps.get(best)!.add(s);
  }

  return result;
}
