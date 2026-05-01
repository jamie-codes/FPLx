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
  // SKELETON — Wave 1 implements the real algorithm.
  // params, MIN_SLOTS, MAX_SLOTS, HORIZON_FIELD, optimiseLineup used in Wave 1.
  void params
  void MIN_SLOTS
  void MAX_SLOTS
  void HORIZON_FIELD
  void optimiseLineup
  return null
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
  // SKELETON — Wave 1 implements.
  // bench, players, horizon, HORIZON_FIELD used in Wave 1.
  void bench
  void players
  void horizon
  void HORIZON_FIELD
  return 0
}

// SquadPick imported for Wave 1 usage — type alias exported for callers.
export type { SquadPick }
// ChipSquadPlayer and ChipSquadResult re-exported from types for convenience.
export type { ChipSquadPlayer, ChipSquadResult }
