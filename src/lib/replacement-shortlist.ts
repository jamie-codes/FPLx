import type { ScoredPlayer } from '@/lib/types'

export interface ShortlistEntry {
  player: ScoredPlayer
  pts_delta: number
  budget_sufficient: boolean
}

/**
 * Compute a replacement shortlist for a Sell-verdicted player.
 *
 * Mirrors transfer-engine.ts budget arithmetic. Ranked by projected points
 * delta descending per D-05 (NOT gem_delta).
 *
 * @param sellPlayer   The player being sold
 * @param allPlayers   Full scored player population
 * @param squadIds     Set of player IDs currently in the squad
 * @param bankBalance  entry_history.bank in tenths (e.g. 15 = GBP1.5m)
 * @param count        Max entries to return (default 5)
 */
export function computeReplacementShortlist(
  sellPlayer: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  squadIds: Set<number>,
  bankBalance: number,
  count = 5,
): ShortlistEntry[] {
  const available_budget = bankBalance / 10 + sellPlayer.now_cost / 10

  return allPlayers
    .filter(
      candidate =>
        candidate.element_type === sellPlayer.element_type &&
        !squadIds.has(candidate.id) &&
        candidate.id !== sellPlayer.id &&
        candidate.proj_pts_1gw > 0
    )
    .map(candidate => ({
      player: candidate,
      pts_delta: candidate.proj_pts_1gw - sellPlayer.proj_pts_1gw,
      budget_sufficient: candidate.now_cost / 10 <= available_budget,
    }))
    .sort((a, b) => b.pts_delta - a.pts_delta)
    .slice(0, count)
}
