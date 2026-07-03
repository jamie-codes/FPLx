// TRF-02: the exp14-VALIDATED transfer policy, ported 1:1 from
// pipeline/transfer_advisor.py (suggest_transfers) so the algorithm the season
// replay proved (+136 pts vs hold, +197 vs placebo on 2025/26) is the same one
// that advises the USER's squad in the cockpit.
//
// Policy semantics (kept identical to the Python source — parity tests enforce):
//   - greedy: each move is the single highest-gain legal same-position swap
//   - free transfers go to the biggest gains; extras cost HIT_COST and are only
//     taken when the gain clears HIT_GAIN_MIN (a -4 must be CLEARLY beaten)
//   - unavailable squad members value 0 on the way out (forced replacements)
//   - unavailable pool players never come IN
//   - budget = squad sell value + bank; <=3 per club
//
// This complements (does not replace) suggest-transfers.ts: that engine
// enumerates 1-2 move combos with break-even maths for exploration; this one
// answers "what would the validated policy actually DO this week".
// Pure module — no React, no side effects (mirrors optimise-lineup.ts).
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'

export const HIT_COST = 4
export const HIT_GAIN_MIN = 6.0   // gain an EXTRA (paid) transfer must clear
export const FREE_GAIN_MIN = 1.0  // gain a free transfer must clear (else hold)
export const MAX_PER_TEAM = 3

export interface AdvisorCandidate {
  id: number
  name: string
  elementType: 1 | 2 | 3 | 4
  team: number
  cost: number            // tenths of £1m (sell price for squad, buy price for pool)
  value: number           // the points metric to maximise (xPts_5gw preferred)
  available: boolean
}

export interface ValidatedMove {
  out: AdvisorCandidate
  in: AdvisorCandidate
  gain: number
  hit: boolean
  reason: string
}

export interface ValidatedAdvice {
  moves: ValidatedMove[]
  nFreeUsed: number
  nHits: number
  predictedGain: number
  netGain: number
  hold: boolean
  newSquadIds: number[]
}

export function suggestValidatedTransfers(
  squad: AdvisorCandidate[],
  pool: AdvisorCandidate[],
  opts: { freeTransfers?: number; budget: number; maxExtra?: number },
): ValidatedAdvice {
  const freeTransfers = opts.freeTransfers ?? 1
  const maxExtra = opts.maxExtra ?? 2
  const squadIds = new Set(squad.map(p => p.id))
  let poolIns = pool.filter(p => !squadIds.has(p.id) && p.available)

  let current = [...squad]
  const moves: ValidatedMove[] = []
  const maxMoves = freeTransfers + maxExtra

  while (moves.length < maxMoves) {
    const bank = opts.budget - current.reduce((s, p) => s + p.cost, 0)
    const clubCount = new Map<number, number>()
    for (const p of current) clubCount.set(p.team, (clubCount.get(p.team) ?? 0) + 1)

    let best: { gain: number; out: AdvisorCandidate; in: AdvisorCandidate } | null = null
    for (const outP of current) {
      const outValue = outP.available ? outP.value : 0
      for (const inP of poolIns) {
        if (inP.elementType !== outP.elementType) continue
        if (inP.cost > outP.cost + bank) continue
        if ((clubCount.get(inP.team) ?? 0) >= MAX_PER_TEAM && inP.team !== outP.team) continue
        const gain = inP.value - outValue
        if (best === null || gain > best.gain) best = { gain, out: outP, in: inP }
      }
    }

    if (best === null) break
    const isHit = moves.length >= freeTransfers
    const threshold = isHit ? HIT_GAIN_MIN : FREE_GAIN_MIN
    const forced = !best.out.available
    if (best.gain < threshold && !(forced && !isHit)) break

    moves.push({
      out: best.out,
      in: best.in,
      gain: Math.round(best.gain * 100) / 100,
      hit: isHit,
      reason: forced ? 'unavailable — forced replacement' : 'predicted upgrade',
    })
    current = current.filter(p => p.id !== best!.out.id).concat(best.in)
    poolIns = poolIns.filter(p => p.id !== best!.in.id)
  }

  const nHits = moves.filter(m => m.hit).length
  const predicted = moves.reduce((s, m) => s + m.gain, 0)
  return {
    moves,
    nFreeUsed: moves.length - nHits,
    nHits,
    predictedGain: Math.round(predicted * 100) / 100,
    netGain: Math.round((predicted - nHits * HIT_COST) * 100) / 100,
    hold: moves.length === 0,
    newSquadIds: current.map(p => p.id).sort((a, b) => a - b),
  }
}

/** Normalise merged players into pool candidates (xPts_5gw preferred). */
export function mergedToCandidates(players: MergedPlayer[]): AdvisorCandidate[] {
  return players
    .filter(p => VALID_ET.has(p.element_type as number))
    .map(p => ({
      id: p.id,
      name: p.web_name ?? String(p.id),
      elementType: p.element_type as 1 | 2 | 3 | 4,
      team: p.team,
      cost: p.now_cost ?? 0,
      value: (p.xPts_5gw as number | undefined) ?? (p.xPts_1gw as number | undefined) ?? 0,
      available: p.status === 'a',
    }))
}

const VALID_ET = new Set([1, 2, 3, 4])

/**
 * The user's 15 as advisor candidates. Sell price prefers the authenticated
 * my-team selling_price (half-profit rule); falls back to now_cost. A pick
 * missing from the merged pool becomes a zero-value forced sell.
 */
export function picksToSquadCandidates(
  picks: SquadPick[],
  players: MergedPlayer[],
  sellPrices?: Map<number, number>,
): AdvisorCandidate[] {
  const byId = new Map(players.map(p => [p.id, p]))
  return picks.map(pick => {
    const p = byId.get(pick.element)
    const sell = sellPrices?.get(pick.element)
    if (!p) {
      return { id: pick.element, name: String(pick.element), elementType: 3 as const,
               team: 0, cost: sell ?? 0, value: 0, available: false }
    }
    return {
      id: p.id,
      name: p.web_name ?? String(p.id),
      elementType: p.element_type as 1 | 2 | 3 | 4,
      team: p.team,
      cost: sell ?? p.now_cost ?? 0,
      value: (p.xPts_5gw as number | undefined) ?? (p.xPts_1gw as number | undefined) ?? 0,
      available: p.status === 'a',
    }
  })
}
