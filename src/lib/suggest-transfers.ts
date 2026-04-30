// Phase 45 (TFR-01..TFR-03): suggestTransfers engine — pure-function transfer
// suggestion engine. Mirrors src/lib/optimise-lineup.ts pattern: no 'use client',
// no React, no side effects, importable in @vitest-environment node tests.
//
// SKELETON IMPLEMENTATION — Wave 0 only. Real algorithm ships in Plan 02 (Wave 1).
// This skeleton returns [] so the test file in Wave 0 can import and run RED.
import type { MergedPlayer, OptimiserHorizon, TransferSuggestion } from './types'
import type { SquadPick } from './squad-adapter'
// Re-export HORIZON_FIELD usage from the optimiser to avoid duplication (IN-01 from 44-REVIEW.md)
// — the real engine in Plan 02 will use this. Imported here so the symbol is in scope.
import { HORIZON_FIELD as _HORIZON_FIELD } from './optimise-lineup'

// FPL position codes (matches MergedPlayer.element_type)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GK = 1
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEF = 2
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MID = 3
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FWD = 4

// Engine input shape (locked by 45-RESEARCH.md §Pattern 2 / 45-PATTERNS.md).
// currentPicks: the user's 15-man squad picks (from useSquad → SquadPicksResponse.picks).
// players: the FULL player pool (~500 players) — engine internally filters to top-30 per position.
// horizon: 1|3|5 — selects xPts_1gw / xPts_3gw / xPts_5gw field for ranking.
// ftCount: 1 (single transfers + hits) or 2 (single + combo + hits).
// bank: tenths of £1m, from squadData.entry_history.bank.
// sellPrices: optional Map<elementId, selling_price_in_tenths> from useMyTeam (authenticated).
//   Falls back to player.now_cost when absent (D-09, D-11).
export interface SuggestTransfersParams {
  currentPicks: SquadPick[]
  players: MergedPlayer[]
  horizon: OptimiserHorizon
  ftCount: 1 | 2
  bank: number
  sellPrices?: Map<number, number>
}

/**
 * suggestTransfers: rank transfer candidates by net xPts gain over the active horizon.
 *
 * Wave 0 SKELETON — returns []. Plan 02 implements the real algorithm:
 *   1. Filter player pool to top-30 per position by xPts[horizon].
 *   2. Exclude players already in the user's 15-man squad from the in-pool (D-03).
 *   3. Enumerate (out, in) pairs (1-FT) or (out1, in1, out2, in2) combos (2-FT) where positions match.
 *   4. Apply hard budget filter (D-10): bank + sum(sellPrice ?? now_cost of outs) >= sum(now_cost of ins).
 *   5. Compute xPtsGain = sum(in.xPts[horizon]) - sum(out.xPts[horizon]); filter xPtsGain > 0.
 *   6. cost = (transfersUsed > ftCount) ? 4 : 0 (FREE when within free transfers).
 *   7. xPtsGainPerGw = xPtsGain / horizon.
 *   8. breakEvenGws = cost > 0 && xPtsGainPerGw > 0 ? Math.max(1, Math.ceil(4 / xPtsGainPerGw)) : null.
 *   9. Sort by xPtsGain descending.
 */
export function suggestTransfers(params: SuggestTransfersParams): TransferSuggestion[] {
  // SKELETON: real implementation in Plan 02 (Wave 1).
  // Reference _HORIZON_FIELD so the import isn't tree-shaken / linted out:
  void _HORIZON_FIELD
  void params
  return []
}
