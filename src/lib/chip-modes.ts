// Phase 46 (CHIP-01..CHIP-03): pure chip-mode engine.
// buildOptimalSquad: greedy 15-player squad from full player pool (WC/FH).
// computeBenchBoostXPts: sum bench players' horizon xPts (BB headline helper).
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { MergedPlayer, OptimiserHorizon, ChipSquadPlayer, ChipSquadResult } from './types'
import { HORIZON_FIELD, optimiseLineup } from './optimise-lineup'
import type { SquadPick } from './squad-adapter'

// Default budget for unauthenticated users (£100m in integer tenths, per D-11).
// Redeclared locally — do NOT import from chip-strategy-engine.ts (D-07).
export const CHIP_DEFAULT_BUDGET_TENTHS = 1000

// Position quotas (per D-07, mirrors computeFHResult in chip-strategy-engine.ts).
// Redeclared locally — do NOT import from chip-strategy-engine.ts.
const MIN_SLOTS: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
const MAX_SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }

export interface BuildOptimalSquadParams {
  players: MergedPlayer[]
  budget: number            // integer tenths of £1m (D-12)
  horizon: OptimiserHorizon
  teamCap?: number          // default 3 (FPL rule per D-06)
}

/**
 * buildOptimalSquad: greedy 15-player squad from the full player pool (WC / FH modes).
 *
 * Eligibility: status === 'a' AND xPts_1gw !== 0 (BGW proxy, D-09).
 * Sort: HORIZON_FIELD[horizon] descending; tie-break: lower now_cost wins (Claude's Discretion).
 * Slot constraints: MIN_SLOTS / MAX_SLOTS per position (D-07).
 * Team cap: max teamCap (default 3) players per FPL club (D-06).
 * Budget guard: runningCost + player.now_cost <= budget (D-12).
 *
 * Returns null when fewer than 15 eligible players can be selected (D-06).
 * bestXI derived by calling optimiseLineup() on the 15-player squad (D-10).
 */
export function buildOptimalSquad(params: BuildOptimalSquadParams): ChipSquadResult | null {
  const { players, budget, horizon, teamCap = 3 } = params
  const field = HORIZON_FIELD[horizon]

  // Eligibility: status === 'a' AND xPts_1gw !== 0 (D-09 BGW proxy; exact === 0 only).
  // NOTE: undefined !== 0 evaluates true — players with missing pipeline data are NOT excluded.
  const eligible = players.filter(p => p.status === 'a' && p.xPts_1gw !== 0)

  // Horizon score helper (?? 0 fallback for undefined optional fields)
  const horizonScore = (p: MergedPlayer): number =>
    (p[field] as number | undefined) ?? 0

  // Sort: horizon score desc; tie-break lower now_cost (cheaper = better budget utilisation)
  const sorted = [...eligible].sort((a, b) => {
    const diff = horizonScore(b) - horizonScore(a)
    if (diff !== 0) return diff
    return a.now_cost - b.now_cost
  })

  const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCount = new Map<number, number>()
  const squad: ChipSquadPlayer[] = []
  let runningCost = 0

  for (const player of sorted) {
    if (squad.length >= 15) break
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCount.get(player.team) ?? 0) >= teamCap) continue
    if (runningCost + player.now_cost > budget) continue
    squad.push({
      id: player.id,
      web_name: player.web_name,
      element_type: pos,
      team: player.team,
      now_cost: player.now_cost,
      xPts: horizonScore(player),
    })
    filledSlots[pos]++
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
  }

  // D-06: return null when fewer than 15 slots could be filled
  if (squad.length < 15) return null

  // D-10: derive bestXI by calling optimiseLineup() on the 15 squad players.
  // CRITICAL (Pitfall 1): pass full MergedPlayer[] for the 15 squad members, NOT ChipSquadPlayer[]
  const squadIds = new Set(squad.map(p => p.id))
  const syntheticPicks: SquadPick[] = squad.map((p, i) => ({
    element: p.id,
    position: i + 1,    // arbitrary — optimiseLineup never reads .position
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
  }))
  const squadPlayers = players.filter(p => squadIds.has(p.id))
  const lineupResult = optimiseLineup(syntheticPicks, squadPlayers, horizon)

  // If optimiseLineup returns null (e.g. all 15 are BGW — already excluded above, but defensive),
  // return null to signal an unresolvable state.
  if (!lineupResult) return null

  return {
    squad,
    bestXI: lineupResult.starters,
    formation: lineupResult.formation,
    budgetUsed: runningCost,
  }
}

/**
 * computeBenchBoostXPts: sum of bench players' horizon xPts (D-13 BB headline helper).
 * bench: array of 4 player IDs (bench[0] = non-starting GK per OPT-04 convention).
 */
export function computeBenchBoostXPts(
  bench: number[],
  players: MergedPlayer[],
  horizon: OptimiserHorizon,
): number {
  const field = HORIZON_FIELD[horizon]
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  return bench.reduce((sum, id) => {
    const p = playerMap.get(id)
    return sum + ((p?.[field] as number | undefined) ?? 0)
  }, 0)
}

// SquadPick imported for Wave 1 usage — type alias exported for callers.
export type { SquadPick }
// ChipSquadPlayer and ChipSquadResult re-exported from types for convenience.
export type { ChipSquadPlayer, ChipSquadResult }

// MIN_SLOTS used for validation callers — not currently re-exported (internal use).
void MIN_SLOTS
