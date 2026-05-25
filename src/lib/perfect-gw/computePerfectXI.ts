import type { FPLElementRaw } from '@/lib/fpl-adapter'

export interface PerfectXIResult {
  xi: FPLElementRaw[]           // 11 players ordered: [GK, ...DEFs, ...MIDs, ...FWDs]
  captain: FPLElementRaw
  formation: string             // e.g. "3-4-3"
  totalPts: number
  squadCost: number             // sum of xi now_cost in FPL units (tenths of £m)
  overBudget: boolean           // squadCost > 1000 (= £100m)
  overBudgetBy: number          // squadCost - 1000, or 0 if not over
}

// 8 valid FPL formations as [DEF count, MID count, FWD count].
// Invariant: each row sums to 10 (+ 1 GK = 11).
// Constraints: min 3 DEF, min 2 MID, min 1 FWD, max 3 FWD.
const FORMATIONS: [number, number, number][] = [
  [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2],
  [4, 5, 1], [5, 3, 2], [5, 4, 1], [5, 2, 3],
]

/**
 * Greedily pick `count` highest-scoring players from `candidates`,
 * enforcing a max of 3 players per club across all positions (shared clubCounts).
 * `candidates` must already be sorted descending by livePoints.
 */
function pickBest(
  candidates: FPLElementRaw[],
  count: number,
  clubCounts: Map<number, number>,
): FPLElementRaw[] {
  const picked: FPLElementRaw[] = []
  for (const player of candidates) {
    if (picked.length >= count) break
    const clubCount = clubCounts.get(player.team) ?? 0
    if (clubCount >= 3) continue
    picked.push(player)
    clubCounts.set(player.team, clubCount + 1)
  }
  return picked
}

export function computePerfectXI(
  players: FPLElementRaw[],
  livePoints: Record<number, number>,
): PerfectXIResult {
  // Group by position and sort each group descending by live points
  const byPosition: Record<number, FPLElementRaw[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const player of players) {
    if (player.element_type in byPosition) {
      byPosition[player.element_type].push(player)
    }
  }
  for (const group of Object.values(byPosition)) {
    group.sort((a, b) => (livePoints[b.id] ?? 0) - (livePoints[a.id] ?? 0))
  }

  let best: PerfectXIResult | null = null

  for (const [defCount, midCount, fwdCount] of FORMATIONS) {
    const clubCounts = new Map<number, number>()

    const gks  = pickBest(byPosition[1], 1,        clubCounts)
    const defs = pickBest(byPosition[2], defCount,  clubCounts)
    const mids = pickBest(byPosition[3], midCount,  clubCounts)
    const fwds = pickBest(byPosition[4], fwdCount,  clubCounts)

    // Skip formation if we can't fill every slot
    if (
      gks.length < 1 ||
      defs.length < defCount ||
      mids.length < midCount ||
      fwds.length < fwdCount
    ) {
      continue
    }

    const xi = [...gks, ...defs, ...mids, ...fwds]
    const totalPts = xi.reduce((sum, p) => sum + (livePoints[p.id] ?? 0), 0)

    if (!best || totalPts > best.totalPts) {
      const captain = xi.reduce((max, p) =>
        (livePoints[p.id] ?? 0) > (livePoints[max.id] ?? 0) ? p : max,
      )
      const squadCost = xi.reduce((sum, p) => sum + p.now_cost, 0)

      best = {
        xi,
        captain,
        formation: `${defCount}-${midCount}-${fwdCount}`,
        totalPts,
        squadCost,
        overBudget: squadCost > 1000,
        overBudgetBy: Math.max(0, squadCost - 1000),
      }
    }
  }

  if (!best) {
    throw new Error('computePerfectXI: could not fill any valid formation from provided players')
  }

  return best
}
