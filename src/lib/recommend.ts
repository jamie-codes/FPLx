import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Verdict = 'buy' | 'hold' | 'sell'

// ---------------------------------------------------------------------------
// Threshold constants (exported for test visibility)
//
// BUY_THRESHOLD:  gem_score > positionAvg * BUY_THRESHOLD  → buy
// SELL_THRESHOLD: gem_score < positionAvg * SELL_THRESHOLD → sell
// Everything else falls into the Hold band.
// ---------------------------------------------------------------------------

/** A player is a Buy if their gem_score exceeds the position average (strictly above). */
export const BUY_THRESHOLD = 1.0

/** A player is a Sell if their gem_score is more than 10% below the position average. */
export const SELL_THRESHOLD = 0.90

/** Bench enablers (≤ £4.5m, positions 12-15) are exempt from the sell bands.
 * Standard bench fodder scores near zero on most gem dimensions by design —
 * without this gate every squad would show permanent SELL chips on players
 * that are correct to keep (mirrors MINUTES_TRAP_MIN_COST's misfire guard). */
export const BENCH_ENABLER_MAX_COST = 45

// ---------------------------------------------------------------------------
// Helper: computePositionAverages
// Exported for reuse by captaincy-engine.ts (Plan 02).
// ---------------------------------------------------------------------------

/**
 * Compute the average gem_score for each FPL position code (1-4)
 * across ALL players provided.
 *
 * Returns a Map<element_type, averageGemScore>.
 * Falls back to 0.5 for positions with no players.
 */
export function computePositionAverages(
  allPlayers: ScoredPlayer[],
): Map<number, number> {
  const sums = new Map<number, number>()
  const counts = new Map<number, number>()

  for (const player of allPlayers) {
    const pos = player.element_type
    sums.set(pos, (sums.get(pos) ?? 0) + player.gem_score)
    counts.set(pos, (counts.get(pos) ?? 0) + 1)
  }

  const averages = new Map<number, number>()
  for (const pos of [1, 2, 3, 4]) {
    const count = counts.get(pos) ?? 0
    averages.set(pos, count > 0 ? (sums.get(pos)! / count) : 0.5)
  }

  return averages
}

// ---------------------------------------------------------------------------
// Main export: computeVerdicts
// ---------------------------------------------------------------------------

/**
 * Compute Buy/Hold/Sell verdicts for all 15 squad players (XI + bench).
 *
 * Algorithm:
 * 1. Build a lookup map from allPlayers by id.
 * 2. Compute position averages from ALL allPlayers (not squad members only).
 * 3. For each squadPick:
 *    - Find the player in the lookup map.
 *    - Compare gem_score to positionAvg:
 *      - Buy:  gem_score > positionAvg                  (above average)
 *      - Sell: gem_score < positionAvg * SELL_THRESHOLD (> 10% below avg)
 *      - Hold: everything else                          (within 0-10% below)
 * 4. Return the verdicts Map.
 *
 * Bench players (position >= 12) are rated like starters — a dud on the bench
 * is still squad value at risk (season-start fix: bench was previously unrated).
 * Players with null xG/xA are handled correctly because the algorithm
 * uses gem_score only — not raw xg_per90/xa_per90.
 *
 * @param squadPicks  The manager's 15-player squad picks for the current GW.
 * @param allPlayers  Full scored player population (used for position averages).
 * @returns           Map<playerId, Verdict> for all squad picks.
 */
export function computeVerdicts(
  squadPicks: SquadPick[],
  allPlayers: ScoredPlayer[],
): Map<number, Verdict> {
  const verdicts = new Map<number, Verdict>()

  if (squadPicks.length === 0) return verdicts

  // Step 1: Build lookup map
  const playerById = new Map<number, ScoredPlayer>()
  for (const player of allPlayers) {
    playerById.set(player.id, player)
  }

  // Step 2: Compute position averages from full population
  const positionAverages = computePositionAverages(allPlayers)

  // Step 3: Classify every pick — bench (positions 12-15) included
  for (const pick of squadPicks) {
    const player = playerById.get(pick.element)
    if (!player) continue

    // Cheap bench enablers are a Hold by definition — see BENCH_ENABLER_MAX_COST.
    if (pick.position >= 12 && player.now_cost <= BENCH_ENABLER_MAX_COST) {
      verdicts.set(pick.element, 'hold')
      continue
    }

    const positionAvg = positionAverages.get(player.element_type) ?? 0.5
    const gem = player.gem_score

    let verdict: Verdict
    if (gem > positionAvg * BUY_THRESHOLD) {
      verdict = 'buy'
    } else if (gem < positionAvg * SELL_THRESHOLD) {
      verdict = 'sell'
    } else {
      verdict = 'hold'
    }

    verdicts.set(pick.element, verdict)
  }

  return verdicts
}
