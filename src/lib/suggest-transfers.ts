// Phase 45 (TFR-01..TFR-03): suggestTransfers engine — pure-function transfer
// suggestion engine. Mirrors src/lib/optimise-lineup.ts pattern: no 'use client',
// no React, no side effects, importable in @vitest-environment node tests.
//
// Algorithm (Plan 02, Wave 1):
//   1. Filter player pool to top-30 per position by xPts[horizon] (D-03).
//   2. Exclude players already in the user's 15-man squad from the in-pool (D-03).
//   3. Enumerate position-matched (out, in) pairs (1-FT) and (out1, in1, out2, in2)
//      combos (2-FT); positions of out and in must match for each transfer leg.
//   4. Apply hard budget filter (D-10):
//      bank + sum(sellPrice ?? now_cost of outs) >= sum(now_cost of ins).
//   5. Compute xPtsGain = sum(in.xPts[horizon]) - sum(out.xPts[horizon]); keep > 0.
//   6. cost = (transfersUsed > ftCount) ? 4 : 0. (For combos: 1 hit when ftCount=1.)
//   7. xPtsGainPerGw = xPtsGain / horizon.
//   8. breakEvenGws = cost > 0 && xPtsGainPerGw > 0
//                       ? Math.max(1, Math.ceil(4 / xPtsGainPerGw))
//                       : null.
//   9. Sort by xPtsGain descending, return.
//
// Complexity (45-RESEARCH.md §Risk 1):
//   1-FT: 15 squad × 30 in-pool per position = ~450 pairs (per-position matched).
//   2-FT: C(15,2) = 105 out-pairs × up to 30 × 30 in-pairs = ~94,500 worst case.
//   Both well under the 10ms budget for the useMemo recompute.
//
// 2-FT xPtsGain uses additive approximation (sum of individual deltas) rather than
// re-running optimiseLineup per combo — see 45-RESEARCH.md §Risk 7 / Open Question 1.
import type { MergedPlayer, OptimiserHorizon, TransferSuggestion } from './types'
import type { SquadPick } from './squad-adapter'
import { HORIZON_FIELD } from './optimise-lineup'

// FPL position codes (matches MergedPlayer.element_type)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4
const POSITIONS: ReadonlyArray<1 | 2 | 3 | 4> = [GK, DEF, MID, FWD]

// Cap top-N per position for the in-pool (D-03).
const TOP_N_PER_POSITION = 30

export interface SuggestTransfersParams {
  currentPicks: SquadPick[]
  players: MergedPlayer[]
  horizon: OptimiserHorizon
  ftCount: 1 | 2
  bank: number
  sellPrices?: Map<number, number>
}

/** Score a player by the active horizon's xPts field (?? 0 fallback). */
function horizonScore(p: MergedPlayer, field: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'): number {
  return (p[field] as number | undefined) ?? 0
}

/**
 * Sell value for a player id: prefer sellPrices entry (selling_price from useMyTeam),
 * fall back to now_cost (D-09 / D-11). All values in tenths of £1m.
 */
function sellValueFor(
  id: number,
  sellPrices: Map<number, number> | undefined,
  playerById: Map<number, MergedPlayer>,
): number {
  const sp = sellPrices?.get(id)
  if (sp !== undefined) return sp
  return playerById.get(id)?.now_cost ?? 0
}

/**
 * Compute breakEvenGws per the locked formula (45-UI-SPEC.md §9 invariants).
 *   cost === 0  → null
 *   cost > 0 && xPtsGainPerGw > 0  → max(1, ceil(cost / xPtsGainPerGw))
 *   cost > 0 && xPtsGainPerGw <= 0 → null (defensive — engine filters non-positive elsewhere)
 *
 * Widened to accept cost: 0 | 4 | 8 (Phase 74 TFX plan) — formula generalises to cost=8.
 */
function breakEven(cost: 0 | 4 | 8, xPtsGainPerGw: number): number | null {
  if (cost === 0) return null
  if (xPtsGainPerGw <= 0) return null
  return Math.max(1, Math.ceil(cost / xPtsGainPerGw))
}

export function suggestTransfers(params: SuggestTransfersParams): TransferSuggestion[] {
  const { currentPicks, players, horizon, ftCount, bank, sellPrices } = params

  if (currentPicks.length === 0 || players.length === 0) return []

  const field = HORIZON_FIELD[horizon]
  const playerById = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const ownedIds = new Set<number>(currentPicks.map(p => p.element))

  // TFX-01: Build capped-teams set — teams where user already owns 3 players.
  // SquadPick has no .team field (squad-adapter.ts); look up via playerById.
  const teamCountMap = new Map<number, number>()
  for (const pick of currentPicks) {
    const teamId = playerById.get(pick.element)?.team
    if (teamId !== undefined) {
      teamCountMap.set(teamId, (teamCountMap.get(teamId) ?? 0) + 1)
    }
  }
  const cappedTeams = new Set<number>(
    [...teamCountMap.entries()]
      .filter(([, count]) => count >= 3)
      .map(([teamId]) => teamId),
  )

  // Step 1+2: Build top-30 per position pool, excluding currently-owned players (D-03)
  // and players from capped teams (TFX-01: FPL 3-player-per-team cap).
  const inPoolByPosition = new Map<1 | 2 | 3 | 4, MergedPlayer[]>()
  for (const pos of POSITIONS) {
    const candidates = players
      .filter(p => p.element_type === pos && !ownedIds.has(p.id) && !cappedTeams.has(p.team))
      .sort((a, b) => horizonScore(b, field) - horizonScore(a, field))
      .slice(0, TOP_N_PER_POSITION)
    inPoolByPosition.set(pos, candidates)
  }

  // Resolve current squad players (skip picks whose element isn't in the players list — defensive).
  const currentPlayers: MergedPlayer[] = []
  for (const pick of currentPicks) {
    const p = playerById.get(pick.element)
    if (p) currentPlayers.push(p)
  }

  // ---------- 1-FT enumeration ----------
  // For every owned player (out), and every in-pool candidate of the same position,
  // compute xPtsGain. Apply budget filter. Keep only positive-gain pairs.
  // Each pair yields up to 2 entries: cost=0 (FREE, applies first FT) and cost=4 (hit).
  // Engine returns BOTH free and hit results so the UI can rank by gain across cost variants.
  const singles: TransferSuggestion[] = []
  for (const sell of currentPlayers) {
    const pool = inPoolByPosition.get(sell.element_type) ?? []
    const sellHorizonPts = horizonScore(sell, field)
    for (const buy of pool) {
      const xPtsGain = horizonScore(buy, field) - sellHorizonPts
      if (xPtsGain <= 0) continue

      // Budget check (D-10): bank + sellValue(sell) >= now_cost(buy)
      const sellValue = sellValueFor(sell.id, sellPrices, playerById)
      if (bank + sellValue < buy.now_cost) continue

      const xPtsGainPerGw = xPtsGain / horizon

      // FREE variant — always emitted when ftCount allows at least 1 free transfer (which is always).
      singles.push({
        kind: 'single',
        sell,
        buy,
        cost: 0,
        xPtsGain,
        xPtsGainPerGw,
        breakEvenGws: breakEven(0, xPtsGainPerGw),
      })

      // HIT variant — only relevant when ftCount=1 (spending the FT elsewhere means this costs -4pts).
      // When ftCount=2, every single transfer is free — no hit entries needed.
      if (ftCount === 1) {
        singles.push({
          kind: 'single',
          sell,
          buy,
          cost: 4,
          xPtsGain,
          xPtsGainPerGw,
          breakEvenGws: breakEven(4, xPtsGainPerGw),
        })
      }
    }
  }

  // ---------- 2-FT combo enumeration (only when ftCount === 2) ----------
  // For every pair of owned players (out1, out2) and every pair of in-pool candidates
  // (in1, in2) where position(out1)==position(in1) and position(out2)==position(in2),
  // additive xPtsGain = (in1.xPts - out1.xPts) + (in2.xPts - out2.xPts).
  // Budget: bank + sellValue(out1) + sellValue(out2) >= now_cost(in1) + now_cost(in2).
  // For a 2-transfer combo, cost = 0 when ftCount=2, cost = 4 when ftCount=1.
  const combos: TransferSuggestion[] = []
  if (ftCount === 2) {
    for (let i = 0; i < currentPlayers.length; i++) {
      const sell1 = currentPlayers[i]
      const pool1 = inPoolByPosition.get(sell1.element_type) ?? []
      const sell1Pts = horizonScore(sell1, field)
      const sell1Value = sellValueFor(sell1.id, sellPrices, playerById)

      for (let j = i + 1; j < currentPlayers.length; j++) {
        const sell2 = currentPlayers[j]
        const pool2 = inPoolByPosition.get(sell2.element_type) ?? []
        const sell2Pts = horizonScore(sell2, field)
        const sell2Value = sellValueFor(sell2.id, sellPrices, playerById)

        for (const buy1 of pool1) {
          const gain1 = horizonScore(buy1, field) - sell1Pts
          if (gain1 <= 0) continue  // each leg must individually improve the squad (CR-02)
          for (const buy2 of pool2) {
            if (buy2.id === buy1.id) continue   // can't buy the same player twice
            const gain2 = horizonScore(buy2, field) - sell2Pts
            if (gain2 <= 0) continue  // each leg must individually improve the squad (CR-02)
            const xPtsGain = gain1 + gain2
            if (xPtsGain <= 0) continue

            // Budget check across both transfers
            if (bank + sell1Value + sell2Value < buy1.now_cost + buy2.now_cost) continue

            const xPtsGainPerGw = xPtsGain / horizon
            // ftCount=2 covers both transfers → FREE. (ftCount=1 path is excluded by the outer if.)
            const cost: 0 | 4 = 0
            combos.push({
              kind: 'combo',
              transfers: [
                { sell: sell1, buy: buy1 },
                { sell: sell2, buy: buy2 },
              ],
              cost,
              xPtsGain,
              xPtsGainPerGw,
              breakEvenGws: breakEven(cost, xPtsGainPerGw),
            })
          }
        }
      }
    }
  }

  // Sort all suggestions by xPtsGain descending (highest gain first).
  // Tie-breaker: lower cost wins (FREE preferred over hit).
  const all: TransferSuggestion[] = [...singles, ...combos]
  all.sort((a, b) => {
    if (b.xPtsGain !== a.xPtsGain) return b.xPtsGain - a.xPtsGain
    return a.cost - b.cost
  })
  return all
}
