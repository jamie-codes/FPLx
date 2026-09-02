// FUND-01 (2026-09-02): "who do I sell, and which bench slots do I downgrade
// to fodder, to afford a better XI?"
//
// The question behind it: a manager rolls free transfers toward a planned
// rebuild (e.g. exiting Everton at GW7 before CHE/ARS) and needs to know which
// moves actually release money, what they cost in projected points, and how
// many fit inside the transfers banked.
//
// This is deliberately NOT suggest-transfers. That engine looks for value
// UPGRADES within one or two moves. This one looks for the cheapest way to
// FREE CASH — downgrades — ranked by how little projection each sacrifices.
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'
import { computeGwXpts } from './gw-xpts'

/** A player who actually appears. A cheap body who never plays frees money but
 * breaks autosubs, which is the failure this whole feature exists to avoid. */
export const MIN_REPLACEMENT_XMINS = 30

/** FPL 2026/27 caps banked free transfers at five. */
export const MAX_FREE_TRANSFERS = 5

export interface DowngradeMove {
  sell: MergedPlayer
  buy: MergedPlayer
  /** Tenths of £1m released (sell price − replacement price). */
  cashFreed: number
  /** Projected points given up across the window (never negative). */
  xPtsCost: number
  /** Cash freed per projected point sacrificed — higher is a better trade. */
  efficiency: number
  /** True when the caller demanded this sale (e.g. "sell all Everton"). */
  forced: boolean
}

export interface FundingPlan {
  moves: DowngradeMove[]
  cashFreed: number
  xPtsCost: number
  transfersUsed: number
  /** Moves beyond the free transfers available, at −4 points each. */
  hits: number
  pointsCost: number
  /** Bank after the plan (tenths). */
  budgetAfter: number
}

export interface FundingPlanParams {
  picks: SquadPick[]
  players: MergedPlayer[]
  /** element id → selling price (tenths). Falls back to now_cost when absent. */
  sellPrices?: Map<number, number>
  bank: number
  freeTransfers: number
  /** Gameweek the rebuild happens in; scoring window starts here. */
  startGw: number
  horizon: number
  /** Players who MUST go regardless of efficiency (e.g. a club whose fixtures turn). */
  forceSellIds?: number[]
  /** Restrict optional downgrades to these picks (typically the bench). */
  downgradeCandidateIds?: number[]
  /** Cap the plan; defaults to the free transfers available. */
  maxMoves?: number
}

function windowXPts(p: MergedPlayer, startGw: number, horizon: number): number {
  let sum = 0
  for (let gw = startGw; gw < startGw + horizon; gw++) sum += computeGwXpts(p, gw)
  return sum
}

/** Cheapest replacement in the same position who actually plays, is not already
 * owned, and keeps the squad inside the 3-per-club limit. */
function cheapestReplacement(
  sell: MergedPlayer,
  players: MergedPlayer[],
  ownedIds: Set<number>,
  teamCounts: Map<number, number>,
  startGw: number,
  horizon: number,
): MergedPlayer | null {
  let best: MergedPlayer | null = null
  for (const p of players) {
    if (ownedIds.has(p.id)) continue
    if (p.element_type !== sell.element_type) continue
    if (p.status !== 'a') continue
    if ((p.xmins ?? 0) < MIN_REPLACEMENT_XMINS) continue
    if (!(p.fixtures ?? []).some(f => f.event_id === startGw)) continue
    // Selling frees a slot at the outgoing club, so that club's count drops.
    const count = (teamCounts.get(p.team) ?? 0) - (p.team === sell.team ? 1 : 0)
    if (count >= 3) continue
    if (best === null || p.now_cost < best.now_cost ||
        (p.now_cost === best.now_cost &&
         windowXPts(p, startGw, horizon) > windowXPts(best, startGw, horizon))) {
      best = p
    }
  }
  return best
}

/**
 * Build a cash-releasing plan for a planned rebuild.
 *
 * Forced sales are taken first (they are a decision, not a trade-off), then
 * optional downgrades in descending cash-per-point order until the move cap is
 * reached. Moves beyond the free transfers available are costed at −4 each so
 * the caller can see whether a hit is worth taking.
 */
export function computeFundingPlan(params: FundingPlanParams): FundingPlan {
  const {
    picks, players, sellPrices, bank, freeTransfers, startGw, horizon,
    forceSellIds = [], downgradeCandidateIds, maxMoves,
  } = params

  const byId = new Map(players.map(p => [p.id, p]))
  const owned = picks
    .map(pick => byId.get(pick.element))
    .filter((p): p is MergedPlayer => p !== undefined)
  const ownedIds = new Set(owned.map(p => p.id))
  const teamCounts = new Map<number, number>()
  for (const p of owned) teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1)

  const priceOf = (p: MergedPlayer) => sellPrices?.get(p.id) ?? p.now_cost
  const forced = new Set(forceSellIds)
  const optionalPool = downgradeCandidateIds ? new Set(downgradeCandidateIds) : null

  const candidates: DowngradeMove[] = []
  for (const sell of owned) {
    const isForced = forced.has(sell.id)
    if (!isForced && optionalPool && !optionalPool.has(sell.id)) continue
    const buy = cheapestReplacement(sell, players, ownedIds, teamCounts, startGw, horizon)
    if (!buy) continue
    const cashFreed = priceOf(sell) - buy.now_cost
    // A downgrade that costs money is not a funding move.
    if (!isForced && cashFreed <= 0) continue
    const xPtsCost = Math.max(
      0,
      windowXPts(sell, startGw, horizon) - windowXPts(buy, startGw, horizon),
    )
    candidates.push({
      sell, buy, cashFreed, xPtsCost,
      efficiency: cashFreed / Math.max(xPtsCost, 0.1),
      forced: isForced,
    })
  }

  // Forced sales first, then the most cash per point sacrificed.
  candidates.sort((a, b) => {
    if (a.forced !== b.forced) return a.forced ? -1 : 1
    return b.efficiency - a.efficiency
  })

  const cap = maxMoves ?? Math.max(freeTransfers, forced.size)
  const takenBuyIds = new Set<number>()
  const moves: DowngradeMove[] = []
  for (const move of candidates) {
    if (moves.length >= cap) break
    // Two sales must not be handed the same replacement.
    if (takenBuyIds.has(move.buy.id)) continue
    takenBuyIds.add(move.buy.id)
    moves.push(move)
  }

  const cashFreed = moves.reduce((s, m) => s + m.cashFreed, 0)
  const xPtsCost = moves.reduce((s, m) => s + m.xPtsCost, 0)
  const hits = Math.max(0, moves.length - freeTransfers)
  return {
    moves,
    cashFreed,
    xPtsCost,
    transfersUsed: moves.length,
    hits,
    pointsCost: hits * 4,
    budgetAfter: bank + cashFreed,
  }
}
