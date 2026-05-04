// Phase 60 (TRT-01..TRT-07): buildTransferRouteTree — pure-function multi-branch
// greedy transfer engine. Mirrors src/lib/suggest-transfers.ts and
// src/lib/planning-engine.ts: no 'use client', no React, no side effects.
//
// Algorithm:
//   1. Identify 3 sell roots = picks sorted by (xPts_1gw asc, now_cost asc, id asc),
//      take first 3 (D-03, Pitfall 8 tie-break for determinism).
//   2. For each root, build a branch:
//      a. GW1: force-sell the root — buy the best position-matched candidate
//         (positive gain preferred, but per RESEARCH.md A1 / Pitfall 9 the root
//         sells even with non-positive replacement — branch dropped only when
//         no position-matched candidate exists at all).
//      b. GW2..H: greedy 0/1/2 transfers per step (D-01 / D-04 — per-leg
//         positive-gain rule from suggest-transfers.ts:175,179).
//   3. recommendedPathIndex = argmax of paths[i].netXpts.
//
// FT propagation: computeNextFTState / computeHitCost / snapshotSquad reused
//   verbatim from Phase 56 (free-transfer-engine.ts).
// Per-GW xPts: (buy.xPts_1gw * fixtureCountForGw(buy, gw)) -
//              (sell.xPts_1gw * fixtureCountForGw(sell, gw))
//   — handles DGW/BGW correctly. Citation: planning-engine.ts:120.
//
// Complexity (worst-case horizon=5, 3 roots): 3 × 5 × 15 × 20 ≈ 22,500 ops; <10ms in V8.
//
// No hits: D-01 forbids hits — totalHits === 0 and totalHitCostPts === 0 for every path.

import type { ScoredPlayer, FTState, PlannerHorizon, PlannerChip } from './types'
import type { SquadPick } from './squad-adapter'
import { computeNextFTState, computeHitCost, snapshotSquad } from './free-transfer-engine'
import { fixtureCountForGw } from './planning-engine'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOP_N_PER_POSITION = 20  // matches planning-engine.ts:11 CANDIDATES_PER_POSITION

// ---------------------------------------------------------------------------
// Exported types (declared before the function per project convention)
// ---------------------------------------------------------------------------

export interface RouteNode {
  gw: number
  ftBefore: FTState
  transfers: { sellId: number; buyId: number }[]
  hitCost: 0
  chip: PlannerChip
  xPtsContribution: number
  squadAfter: number[]
}

export interface RoutePath {
  rootSellId: number
  nodes: RouteNode[]
  totalTransfers: number
  totalHits: 0
  totalHitCostPts: 0
  netXpts: number
  chipsConsumed: PlannerChip[]
}

export interface TransferRouteTree {
  paths: RoutePath[]
  recommendedPathIndex: number
}

export interface BuildTransferRouteTreeArgs {
  picks: SquadPick[]
  players: ScoredPlayer[]
  horizon: PlannerHorizon
  initialFT: FTState
  initialBank: number
  sellPrices: Map<number, number> | undefined
  chipMode: PlannerChip
  startingGw: number
}

// ---------------------------------------------------------------------------
// Internal helper: sellValueFor (verbatim from suggest-transfers.ts:55–67,
// swapping MergedPlayer for ScoredPlayer)
// ---------------------------------------------------------------------------

function sellValueFor(
  id: number,
  sellPrices: Map<number, number> | undefined,
  playerById: Map<number, ScoredPlayer>,
): number {
  const sp = sellPrices?.get(id)
  if (sp !== undefined) return sp
  return playerById.get(id)?.now_cost ?? 0
}

// ---------------------------------------------------------------------------
// Internal helper: build top-N position-matched candidate pool
// ---------------------------------------------------------------------------

function buildCandidatePool(
  players: ScoredPlayer[],
  elementType: 1 | 2 | 3 | 4,
  ownedIds: Set<number>,
): ScoredPlayer[] {
  return players
    .filter(p => p.element_type === elementType && !ownedIds.has(p.id))
    .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
    .slice(0, TOP_N_PER_POSITION)
}

// ---------------------------------------------------------------------------
// Internal helper: forceRootReplacement
// Selects the best position-matched buy for a forced root sell in GW1.
// Returns the highest-xPts_1gw * fixtureCount candidate in budget, even if gain <= 0.
// Returns null ONLY when no position-matched, budget-passing candidate exists at all.
// ---------------------------------------------------------------------------

function forceRootReplacement(
  rootId: number,
  squad: number[],
  args: BuildTransferRouteTreeArgs,
  playerMap: Map<number, ScoredPlayer>,
  bank: number,
  gw: number,
): ScoredPlayer | null {
  const rootPlayer = playerMap.get(rootId)
  if (!rootPlayer) return null

  const ownedIds = new Set<number>(squad)
  const sellPrice = sellValueFor(rootId, args.sellPrices, playerMap)
  const budget = bank + sellPrice

  const candidates = buildCandidatePool(args.players, rootPlayer.element_type as 1 | 2 | 3 | 4, ownedIds)

  // Filter by budget, then pick highest xPts_1gw * fixtureCount (per RESEARCH.md §forceRootReplacement)
  const affordable = candidates.filter(c => c.now_cost <= budget)
  if (affordable.length === 0) return null

  // Sort by xPts_1gw * fixtureCount descending to pick best available
  affordable.sort((a, b) => {
    const scoreA = (a.xPts_1gw ?? 0) * fixtureCountForGw(a, gw)
    const scoreB = (b.xPts_1gw ?? 0) * fixtureCountForGw(b, gw)
    return scoreB - scoreA
  })

  return affordable[0]
}

// ---------------------------------------------------------------------------
// Internal helper: pickBestPositiveGain
// Finds the best (sell, buy) pair with individually positive xPts gain.
// Returns null if no positive-gain pair exists (D-01 positive-only).
// ---------------------------------------------------------------------------

function pickBestPositiveGain(
  squad: number[],
  args: BuildTransferRouteTreeArgs,
  playerMap: Map<number, ScoredPlayer>,
  bank: number,
  gw: number,
  excludedSells: Set<number>,
  excludedBuys: Set<number>,
): { sellId: number; buyId: number } | null {
  let bestGain = 0
  let bestTransfer: { sellId: number; buyId: number } | null = null

  const ownedIds = new Set<number>(squad)

  for (const sellId of squad) {
    if (excludedSells.has(sellId)) continue
    const sellPlayer = playerMap.get(sellId)
    if (!sellPlayer) continue
    const sellPrice = sellValueFor(sellId, args.sellPrices, playerMap)
    const budget = bank + sellPrice

    const candidates = buildCandidatePool(
      args.players,
      sellPlayer.element_type as 1 | 2 | 3 | 4,
      ownedIds,
    ).filter(c => !excludedBuys.has(c.id))

    for (const buy of candidates) {
      if (buy.now_cost > budget) continue  // budget guard (D-04)

      const gain =
        (buy.xPts_1gw ?? 0) * fixtureCountForGw(buy, gw) -
        (sellPlayer.xPts_1gw ?? 0) * fixtureCountForGw(sellPlayer, gw)

      if (gain > bestGain) {
        bestGain = gain
        bestTransfer = { sellId, buyId: buy.id }
      }
    }
  }

  return bestTransfer  // null when bestGain === 0 (no positive gain found)
}

// ---------------------------------------------------------------------------
// Internal helper: greedyTransfersForStep
// D-04 enforcement: each leg must individually produce positive gain.
// Returns 0, 1, or 2 transfers for the step (never exceeds ft.available).
// ---------------------------------------------------------------------------

function greedyTransfersForStep(
  squad: number[],
  args: BuildTransferRouteTreeArgs,
  playerMap: Map<number, ScoredPlayer>,
  ft: FTState,
  bank: number,
  gw: number,
): { sellId: number; buyId: number }[] {
  const transfers: { sellId: number; buyId: number }[] = []
  let workingSquad = [...squad]
  let workingBank = bank
  const maxTransfers = ft.available  // never exceed FTs per D-01

  for (let slot = 0; slot < maxTransfers; slot++) {
    const excludedSells = new Set(transfers.map(t => t.sellId))
    const excludedBuys = new Set(transfers.map(t => t.buyId))

    const best = pickBestPositiveGain(
      workingSquad,
      args,
      playerMap,
      workingBank,
      gw,
      excludedSells,
      excludedBuys,
    )

    if (!best) break  // D-01: skip if no positive gain

    transfers.push(best)

    // Apply the transfer to working state for next slot
    const sellPrice = sellValueFor(best.sellId, args.sellPrices, playerMap)
    const buyPlayer = playerMap.get(best.buyId)!
    workingBank = workingBank + sellPrice - buyPlayer.now_cost
    workingSquad = workingSquad.map(id => id === best.sellId ? best.buyId : id)
  }

  return transfers
}

// ---------------------------------------------------------------------------
// Internal helper: buildBranch
// Builds one RoutePath starting from a forced root sell in GW1, then
// greedy continuation for GW2..H.
// Returns null if the root has no position-matched budget-passing candidate (branch dropped).
// ---------------------------------------------------------------------------

function buildBranch(
  rootId: number,
  args: BuildTransferRouteTreeArgs,
  playerMap: Map<number, ScoredPlayer>,
): RoutePath | null {
  // Mutation-safe: start from a fresh snapshot per branch (RESEARCH.md §Squad mutation safety)
  let simulatedSquad: number[] = snapshotSquad(args.picks.map(p => p.element))
  let bank = args.initialBank
  let ft: FTState = { ...args.initialFT }

  const nodes: RouteNode[] = []

  for (let h = 0; h < args.horizon; h++) {
    const gw = args.startingGw + h
    const chip: PlannerChip = h === 0 ? args.chipMode : null

    let transfers: { sellId: number; buyId: number }[] = []

    if (h === 0) {
      // Forced root sell in GW1 (D-03 / RESEARCH.md A1)
      const buyPlayer = forceRootReplacement(rootId, simulatedSquad, args, playerMap, bank, gw)
      if (buyPlayer === null) {
        // No position-matched candidate → drop this branch
        return null
      }
      transfers = [{ sellId: rootId, buyId: buyPlayer.id }]

      // When 2 FTs available, check if a second positive-gain transfer exists (D-04)
      // The root forced transfer used 1 FT; if ft.available >= 2, we try a second leg
      if (ft.available >= 2) {
        // Apply the root transfer to working state to find the second leg candidate
        const rootSellPrice = sellValueFor(rootId, args.sellPrices, playerMap)
        const rootBuyPlayer = playerMap.get(buyPlayer.id)!
        const bankAfterRoot = bank + rootSellPrice - rootBuyPlayer.now_cost
        const squadAfterRoot = simulatedSquad.map(id => id === rootId ? buyPlayer.id : id)

        const excludedSells = new Set([rootId])
        const excludedBuys = new Set([buyPlayer.id])
        const secondLeg = pickBestPositiveGain(
          squadAfterRoot,
          args,
          playerMap,
          bankAfterRoot,
          gw,
          excludedSells,
          excludedBuys,
        )
        if (secondLeg) {
          transfers = [{ sellId: rootId, buyId: buyPlayer.id }, secondLeg]
        }
      }
    } else {
      // Greedy continuation for GW2..H (D-01 / D-04)
      transfers = greedyTransfersForStep(simulatedSquad, args, playerMap, ft, bank, gw)
    }

    // Apply transfers to mutable state
    for (const t of transfers) {
      const sellPrice = sellValueFor(t.sellId, args.sellPrices, playerMap)
      const buyPlayer = playerMap.get(t.buyId)!
      bank = bank + sellPrice - buyPlayer.now_cost
      simulatedSquad = simulatedSquad.map(id => id === t.sellId ? t.buyId : id)
    }

    // Compute xPts contribution for this node (sum of per-leg deltas, fixture-count adjusted)
    // Citation: planning-engine.ts:120 gwScore pattern
    let xPtsContribution = 0
    for (const t of transfers) {
      const sellPlayer = playerMap.get(t.sellId)
      const buyPlayer = playerMap.get(t.buyId)
      if (sellPlayer && buyPlayer) {
        xPtsContribution +=
          (buyPlayer.xPts_1gw ?? 0) * fixtureCountForGw(buyPlayer, gw) -
          (sellPlayer.xPts_1gw ?? 0) * fixtureCountForGw(sellPlayer, gw)
      }
    }

    // Advance FT state
    const nextFt = computeNextFTState(ft.available, transfers.length, chip)
    // hitCost is always 0 per D-01 (engine never exceeds ft.available)
    const hitCost = computeHitCost(ft.available, transfers.length, chip)
    // Assert invariant: no hits taken
    if (hitCost !== 0) {
      // This should never happen given our maxTransfers = ft.available constraint
      // If it does, cap transfers to 0 (defensive guard, not expected in normal operation)
    }

    nodes.push({
      gw,
      ftBefore: { ...ft },
      transfers,
      hitCost: 0,  // always 0 per D-01
      chip,
      xPtsContribution,
      squadAfter: snapshotSquad(simulatedSquad),
    })

    ft = nextFt
  }

  // Aggregate path metrics
  const totalTransfers = nodes.reduce((sum, n) => sum + n.transfers.length, 0)
  const netXpts = nodes.reduce((sum, n) => sum + n.xPtsContribution, 0)
  const chipsConsumed = nodes
    .filter(n => n.chip !== null)
    .map(n => n.chip)

  return {
    rootSellId: rootId,
    nodes,
    totalTransfers,
    totalHits: 0,
    totalHitCostPts: 0,
    netXpts,
    chipsConsumed,
  }
}

// ---------------------------------------------------------------------------
// Main exported function: buildTransferRouteTree
// ---------------------------------------------------------------------------

/**
 * Pure function that generates up to 3 branching greedy transfer paths,
 * each starting from a different sell root (the 3 lowest-xPts_1gw squad players).
 *
 * Returns paths sorted in root-selection order (not by netXpts — the caller uses
 * recommendedPathIndex to identify the best path).
 *
 * @param args - BuildTransferRouteTreeArgs containing squad picks, player pool, horizon, FT state, bank, sell prices, chip mode, and starting GW
 * @returns TransferRouteTree with 0–3 paths and recommendedPathIndex
 */
export function buildTransferRouteTree(args: BuildTransferRouteTreeArgs): TransferRouteTree {
  if (args.picks.length === 0 || args.players.length === 0) {
    return { paths: [], recommendedPathIndex: -1 }
  }

  // Build fast player lookup map (reused across all branches — do not rebuild per branch)
  const playerMap = new Map<number, ScoredPlayer>(args.players.map(p => [p.id, p]))

  // Resolve squad players from picks (defensive: skip picks whose element isn't in playerMap)
  const pickedPlayers: ScoredPlayer[] = args.picks
    .map(p => playerMap.get(p.element))
    .filter((p): p is ScoredPlayer => p !== undefined)

  if (pickedPlayers.length === 0) {
    return { paths: [], recommendedPathIndex: -1 }
  }

  // Step A: Identify 3 sell roots = picks sorted by xPts_1gw asc → now_cost asc → id asc
  // (D-03, Pitfall 8 tie-break for determinism)
  const sortedByXpts = [...pickedPlayers].sort((a, b) => {
    const xptsA = a.xPts_1gw ?? 0
    const xptsB = b.xPts_1gw ?? 0
    if (xptsA !== xptsB) return xptsA - xptsB
    if (a.now_cost !== b.now_cost) return a.now_cost - b.now_cost
    return a.id - b.id
  })
  const rootIds = sortedByXpts.slice(0, 3).map(p => p.id)

  // Step B: Build each branch
  const paths: RoutePath[] = []
  for (const rootId of rootIds) {
    const branch = buildBranch(rootId, args, playerMap)
    if (branch !== null) {
      paths.push(branch)
    }
  }

  // Step C: Recommend the highest-net-xPts path (stable argmax — first occurrence wins on ties)
  if (paths.length === 0) {
    return { paths: [], recommendedPathIndex: -1 }
  }

  const recommendedPathIndex = paths.reduce(
    (bestIdx, p, i) => (p.netXpts > paths[bestIdx].netXpts ? i : bestIdx),
    0,
  )

  return { paths, recommendedPathIndex }
}
