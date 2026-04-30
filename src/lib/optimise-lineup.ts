// Phase 43 (OPT-01..OPT-05): pure-function lineup optimiser.
// Mirrors src/lib/chip-strategy-engine.ts pattern: no 'use client', no React, no side effects.
// Algorithm: enumerate C(15,11) = 1,365 subsets, validate FPL formation rules, score by horizon
// xPts, return highest-scoring subset with bench, captain, VC, formation string.
import type { MergedPlayer, OptimiserHorizon, OptimisedLineup } from './types'
import type { SquadPick } from './squad-adapter'

// Map horizon (1 | 3 | 5) to MergedPlayer field name. Object map preferred over switch (RESEARCH).
export const HORIZON_FIELD: Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}

// FPL position codes (matches MergedPlayer.element_type)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

/**
 * optimiseLineup: select the best 11 starters + 4 bench + captain + VC from a 15-player squad
 * for a given scoring horizon (1 / 3 / 5 GW).
 *
 * BGW exclusion: players with xPts_1gw === 0 (exact zero, NOT undefined) are filtered out
 * before enumeration (D-15, Pitfall 1).
 *
 * Formation rules: 1 GK, DEF in [3,5], MID in [2,5], FWD in [1,3], total starters = 11.
 * Valid FPL formations: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1.
 *
 * Captain: starter with highest (xPts_90th_1gw ?? xPts_1gw ?? 0). VC: second highest.
 * Bench: bench[0] = non-starting GK; bench[1..3] = remaining 3 outfield ordered by horizon xPts desc.
 *
 * Returns null when fewer than 11 BGW-eligible players remain.
 */
export function optimiseLineup(
  picks: SquadPick[],
  players: MergedPlayer[],
  horizon: OptimiserHorizon,
): OptimisedLineup | null {
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const field = HORIZON_FIELD[horizon]

  // BGW filter: exclude picks whose corresponding player has xPts_1gw === 0.
  // CRITICAL (Pitfall 1): undefined xPts_1gw means "no pipeline data", NOT "BGW".
  // Only exact === 0 triggers exclusion. Players missing from playerMap are also excluded
  // (defensive — pipeline data missing for that player ID).
  const eligible = picks.filter(pick => {
    const p = playerMap.get(pick.element)
    if (!p) return false
    return p.xPts_1gw !== 0
  })

  if (eligible.length < 11) return null

  // Helper: ranking key for captain selection (Pitfall 2 — fallback chain).
  const captainKey = (p: MergedPlayer): number =>
    p.xPts_90th_1gw ?? p.xPts_1gw ?? 0

  // Helper: horizon-field score for a player (?? 0 fallback for undefined fields).
  const horizonScore = (p: MergedPlayer): number =>
    (p[field] as number | undefined) ?? 0

  // Enumerate C(eligible.length, 11) subsets via 11-deep nested index iteration.
  // For 15 picks this is C(15,11) = 1,365; for fewer eligible (e.g. 11..14) it is C(n,11).
  // We use a generic combinations generator so the loop body is readable.
  let bestStarterIds: number[] | null = null
  let bestScore = -Infinity
  let bestCounts = { def: 0, mid: 0, fwd: 0 }

  const n = eligible.length
  const indices = new Array(11).fill(0).map((_, i) => i)
  while (true) {
    // Build the 11-player subset
    const subset = indices.map(i => eligible[i])

    // Count positions
    let gkCount = 0, defCount = 0, midCount = 0, fwdCount = 0
    let score = 0
    for (const pick of subset) {
      const p = playerMap.get(pick.element)
      if (!p) { gkCount = -1; break }  // defensive: skip invalid subset
      if (p.element_type === GK) gkCount++
      else if (p.element_type === DEF) defCount++
      else if (p.element_type === MID) midCount++
      else if (p.element_type === FWD) fwdCount++
      score += horizonScore(p)
    }

    // Validate formation rules
    const valid = (
      gkCount === 1 &&
      defCount >= 3 && defCount <= 5 &&
      midCount >= 2 && midCount <= 5 &&
      fwdCount >= 1 && fwdCount <= 3 &&
      (defCount + midCount + fwdCount) === 10
    )

    // Use `>` not `>=` — first-found wins ties (chip-strategy-engine convention).
    if (valid && score > bestScore) {
      bestScore = score
      bestStarterIds = subset.map(p => p.element)
      bestCounts = { def: defCount, mid: midCount, fwd: fwdCount }
    }

    // Advance combination indices (lex-order next combination of 11 from n).
    let k = 10
    while (k >= 0 && indices[k] === n - 11 + k) k--
    if (k < 0) break
    indices[k]++
    for (let j = k + 1; j < 11; j++) indices[j] = indices[j - 1] + 1
  }

  if (!bestStarterIds) return null

  // Captain / VC selection (OPT-03)
  const sortedStartersByCaptainKey = [...bestStarterIds].sort((a, b) => {
    const pa = playerMap.get(a)!
    const pb = playerMap.get(b)!
    return captainKey(pb) - captainKey(pa)
  })
  const captainId = sortedStartersByCaptainKey[0]
  const vcId = sortedStartersByCaptainKey[1]

  // Bench (OPT-04): the 4 picks not in starters.
  const starterSet = new Set(bestStarterIds)
  const benchPicks = picks
    .filter(pick => !starterSet.has(pick.element))
    .map(pick => playerMap.get(pick.element))
    .filter((p): p is MergedPlayer => p !== undefined)

  // bench[0] = non-starting GK. There must be exactly 1 (FPL squads have exactly 2 GKs).
  const benchGk = benchPicks.find(p => p.element_type === GK)
  const benchOutfield = benchPicks
    .filter(p => p.element_type !== GK)
    .sort((a, b) => horizonScore(b) - horizonScore(a))

  // Defensive: if for any reason there is no bench GK (e.g. both GKs in starters — invalid in FPL),
  // we can't satisfy OPT-04. Return null.
  if (!benchGk) return null

  const bench = [benchGk.id, ...benchOutfield.slice(0, 3).map(p => p.id)]

  // Formation string (Pitfall 5 — outfield only, GK NOT counted)
  const formation = `${bestCounts.def}-${bestCounts.mid}-${bestCounts.fwd}`

  return {
    starters: bestStarterIds,
    bench,
    captainId,
    vcId,
    formation,
  }
}
