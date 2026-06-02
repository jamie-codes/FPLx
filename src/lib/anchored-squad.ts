// WC-01: pure anchor-squad builder.
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { MergedPlayer, OptimiserHorizon, ChipSquadPlayer } from './types'
// Used by implementation (Task 2):
import { HORIZON_FIELD, optimiseLineup } from './optimise-lineup'
import type { SquadPick } from './squad-adapter'

// Redeclared locally — not exported from chip-modes.ts (codebase pattern).
const MIN_SLOTS: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
const MAX_SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }

export interface CaptainCandidate {
  id: number
  web_name: string
  xPts_1gw: number
  ceiling: number  // xPts_90th_1gw ?? xPts_1gw ?? 0
}

export interface AnchorConflict {
  playerId: number
  reason: 'not_found' | 'unavailable' | 'team_cap' | 'position_cap' | 'over_budget'
}

export interface AnchoredSquadResult {
  squad: ChipSquadPlayer[]
  bestXI: number[]
  formation: string
  budgetUsed: number
  budgetRemaining: number
  xPts1gw: number
  xPts3gw: number
  xPts5gw: number
  captainCandidates: CaptainCandidate[]
  anchorConflicts: AnchorConflict[]
}

export function buildAnchoredSquad(
  _anchors: number[],
  _players: MergedPlayer[],
  _budget: number,
  _horizon: OptimiserHorizon,
): AnchoredSquadResult | null {
  throw new Error('not implemented')
}
