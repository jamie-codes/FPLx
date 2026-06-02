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
  anchors: number[],
  players: MergedPlayer[],
  budget: number,
  horizon: OptimiserHorizon,
): AnchoredSquadResult | null {
  const field = HORIZON_FIELD[horizon]
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const anchorConflicts: AnchorConflict[] = []
  const squad: ChipSquadPlayer[] = []
  const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCount = new Map<number, number>()
  let runningCost = 0
  const seatedIds = new Set<number>()

  // Step 1: Validate and pre-seat anchor players in order.
  for (const anchorId of anchors) {
    if (seatedIds.has(anchorId)) continue  // skip duplicate anchor IDs
    const player = playerMap.get(anchorId)
    if (!player) {
      anchorConflicts.push({ playerId: anchorId, reason: 'not_found' })
      continue
    }
    if (player.status !== 'a') {
      anchorConflicts.push({ playerId: anchorId, reason: 'unavailable' })
      continue
    }
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) {
      anchorConflicts.push({ playerId: anchorId, reason: 'position_cap' })
      continue
    }
    if ((teamCount.get(player.team) ?? 0) >= 3) {
      anchorConflicts.push({ playerId: anchorId, reason: 'team_cap' })
      continue
    }
    if (runningCost + player.now_cost > budget) {
      anchorConflicts.push({ playerId: anchorId, reason: 'over_budget' })
      continue
    }
    squad.push({
      id: player.id,
      web_name: player.web_name,
      element_type: pos as 1 | 2 | 3 | 4,
      team: player.team,
      now_cost: player.now_cost,
      xPts: (player[field] as number | undefined) ?? 0,
    })
    filledSlots[pos] = (filledSlots[pos] ?? 0) + 1
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
    seatedIds.add(anchorId)
  }

  // Step 2: Greedy fill — eligible = available, non-BGW proxy, not already seated.
  const eligible = players
    .filter(p => p.status === 'a' && p.xPts_1gw !== 0 && !seatedIds.has(p.id))
    .sort((a, b) => {
      const diff =
        ((b[field] as number | undefined) ?? 0) -
        ((a[field] as number | undefined) ?? 0)
      // Tie-break: lower cost wins (better budget utilisation, mirrors buildOptimalSquad).
      return diff !== 0 ? diff : a.now_cost - b.now_cost
    })

  for (const player of eligible) {
    if (squad.length >= 15) break
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCount.get(player.team) ?? 0) >= 3) continue
    if (runningCost + player.now_cost > budget) continue
    squad.push({
      id: player.id,
      web_name: player.web_name,
      element_type: pos as 1 | 2 | 3 | 4,
      team: player.team,
      now_cost: player.now_cost,
      xPts: (player[field] as number | undefined) ?? 0,
    })
    filledSlots[pos] = (filledSlots[pos] ?? 0) + 1
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
  }

  // Step 3: Validate formation minimums.
  if (squad.length < 15) return null
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledSlots[pos] ?? 0) < MIN_SLOTS[pos]) return null
  }

  // Step 4: Derive best XI via optimiseLineup.
  const syntheticPicks: SquadPick[] = squad.map((p, i) => ({
    element: p.id,
    position: i + 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
  }))
  const squadPlayersFull = squad
    .map(p => playerMap.get(p.id))
    .filter((p): p is MergedPlayer => p !== undefined)
  const lineupResult = optimiseLineup(syntheticPicks, squadPlayersFull, horizon)
  if (!lineupResult) return null

  const { starters: bestXI, formation } = lineupResult

  // Step 5: xPts totals for XI only (?? 0 fallback for optional fields).
  const xPts1gw = bestXI.reduce(
    (sum, id) => sum + (playerMap.get(id)?.xPts_1gw ?? 0), 0,
  )
  const xPts3gw = bestXI.reduce(
    (sum, id) => sum + ((playerMap.get(id)?.xPts_3gw as number | undefined) ?? 0), 0,
  )
  const xPts5gw = bestXI.reduce(
    (sum, id) => sum + ((playerMap.get(id)?.xPts_5gw as number | undefined) ?? 0), 0,
  )

  // Step 6: Top-3 captain candidates from XI by ceiling descending.
  const captainCandidates: CaptainCandidate[] = bestXI
    .map(id => playerMap.get(id))
    .filter((p): p is MergedPlayer => p !== undefined)
    .map(p => ({
      id: p.id,
      web_name: p.web_name,
      xPts_1gw: p.xPts_1gw ?? 0,
      ceiling: p.xPts_90th_1gw ?? p.xPts_1gw ?? 0,
    }))
    .sort((a, b) => b.ceiling - a.ceiling)
    .slice(0, 3)

  return {
    squad,
    bestXI,
    formation,
    budgetUsed: runningCost,
    budgetRemaining: budget - runningCost,
    xPts1gw,
    xPts3gw,
    xPts5gw,
    captainCandidates,
    anchorConflicts,
  }
}
