import type { ScoredPlayer, FTState, PlannerHorizon, PlanResult, PlanStep, ScoredTransfer } from './types'
import type { SquadPick } from './squad-adapter'
import { computeHitCost, computeNextFTState, snapshotSquad } from './free-transfer-engine'

// ---------------------------------------------------------------------------
// Constants (per D-01 / CONTEXT.md)
// ---------------------------------------------------------------------------

const LOOK_AHEAD_DISCOUNT = 0.8
const CANDIDATES_PER_POSITION = 20

// ---------------------------------------------------------------------------
// fixtureCountForGw
// ---------------------------------------------------------------------------

/**
 * Returns how many fixtures a player has in the given gameweek.
 * DGW = 2, normal = 1, BGW = 0.
 * Pure function — no side effects.
 */
export function fixtureCountForGw(player: ScoredPlayer, targetGw: number): number {
  return player.fixtures.filter(f => f.event_id === targetGw).length
}

// ---------------------------------------------------------------------------
// generatePlan
// ---------------------------------------------------------------------------

/**
 * Generate a multi-gameweek transfer plan using a greedy + 1-level look-ahead algorithm.
 *
 * Pure function — no hooks, no side effects.
 *
 * @param picks         Squad picks (positions 1-11 = starting XI, 12-15 = bench)
 * @param allPlayers    All scored players (used as candidate pool)
 * @param horizon       Number of gameweeks to plan ahead (1–5)
 * @param startingGw    First gameweek in the plan
 * @param ftState       Current free transfer state
 * @param bankBalance   Current bank balance in tenths of £1m (e.g. 15 = £1.5m)
 * @param sellPrices    Optional map of player ID → exact sell price in tenths.
 *                      Falls back to player.now_cost when absent (per D-04).
 */
export function generatePlan(
  picks: SquadPick[],
  allPlayers: ScoredPlayer[],
  horizon: PlannerHorizon,
  startingGw: number,
  ftState: FTState,
  bankBalance: number,
  sellPrices?: Record<number, number>,
): PlanResult {
  // Build fast player lookup
  const playerMap = new Map<number, ScoredPlayer>(allPlayers.map(p => [p.id, p]))

  // Simulated mutable state (never mutates originals)
  // snapshotSquad provides a deep copy so the original picks array is never mutated
  let simulatedSquadIds: number[] = snapshotSquad(picks.map(p => p.element))
  // Track positions alongside IDs so we can maintain position mapping
  const positionMap = new Map<number, number>()
  for (const pick of picks) {
    positionMap.set(pick.element, pick.position)
  }

  let simulatedBank = bankBalance
  let currentFT = { ...ftState }

  const steps: PlanStep[] = []

  for (let stepIndex = 0; stepIndex < horizon; stepIndex++) {
    const targetGw = startingGw + stepIndex
    const nextGw = stepIndex < horizon - 1 ? startingGw + stepIndex + 1 : null

    // Determine if fixture data exists for this GW across all players
    const unconfirmedFixtures = !allPlayers.some(p =>
      p.fixtures.some(f => f.event_id === targetGw)
    )

    // Build set of current squad IDs for candidate exclusion
    const squadIdSet = new Set(simulatedSquadIds)

    // Identify starting XI sell candidates (positions 1-11 only — not bench)
    const startingXIIds = simulatedSquadIds.filter(id => {
      const pos = positionMap.get(id)
      return pos !== undefined && pos >= 1 && pos <= 11
    })

    const startingXIPlayers = startingXIIds
      .map(id => playerMap.get(id))
      .filter((p): p is ScoredPlayer => p !== undefined)

    // Pre-filter candidates per position: top CANDIDATES_PER_POSITION by gem_score, not in squad
    const candidatePoolByPosition = new Map<number, ScoredPlayer[]>()
    for (const posCode of [1, 2, 3, 4] as const) {
      const pool = allPlayers
        .filter(p => p.element_type === posCode && !squadIdSet.has(p.id))
        .sort((a, b) => b.gem_score - a.gem_score)
        .slice(0, CANDIDATES_PER_POSITION)
      candidatePoolByPosition.set(posCode, pool)
    }

    // Score all (sell, buy) pairs
    const allScoredTransfers: ScoredTransfer[] = []

    for (const sellPlayer of startingXIPlayers) {
      const sellPrice = sellPrices?.[sellPlayer.id] ?? sellPlayer.now_cost
      const candidatePool = candidatePoolByPosition.get(sellPlayer.element_type) ?? []

      for (const buyCandidate of candidatePool) {
        // Budget guard (per D-04, all prices in tenths — never divide before comparing)
        if (buyCandidate.now_cost > simulatedBank + sellPrice) {
          continue // unaffordable
        }

        // Score for target GW (per D-02: proj_pts_1gw * fixtureCount)
        const gwScore =
          buyCandidate.proj_pts_1gw * fixtureCountForGw(buyCandidate, targetGw) -
          sellPlayer.proj_pts_1gw * fixtureCountForGw(sellPlayer, targetGw)

        // Look-ahead score for GW+1
        let lookAheadScore = 0
        if (nextGw !== null) {
          lookAheadScore =
            LOOK_AHEAD_DISCOUNT *
            (buyCandidate.proj_pts_1gw * fixtureCountForGw(buyCandidate, nextGw) -
              sellPlayer.proj_pts_1gw * fixtureCountForGw(sellPlayer, nextGw))
        }

        const totalScore = gwScore + lookAheadScore
        const hitCost = computeHitCost(currentFT.available, 1, null)
        const netGain = totalScore + hitCost

        allScoredTransfers.push({
          sellId: sellPlayer.id,
          buyId: buyCandidate.id,
          gwScore,
          lookAheadScore,
          totalScore,
          hitCost,
          netGain,
          affordable: true,
        })
      }
    }

    // Sort by netGain descending and find best transfer (only if netGain > 0, per D-03)
    allScoredTransfers.sort((a, b) => b.netGain - a.netGain)
    const bestTransfer = allScoredTransfers.find(t => t.netGain > 0) ?? null

    let transfersIn: number[] = []
    let transfersOut: number[] = []
    let transfersUsed = 0

    if (bestTransfer !== null) {
      const buyPlayer = playerMap.get(bestTransfer.buyId)!
      const sellPrice = sellPrices?.[bestTransfer.sellId] ?? (playerMap.get(bestTransfer.sellId)?.now_cost ?? 0)

      // Apply transfer to simulated squad state
      simulatedSquadIds = simulatedSquadIds.map(id =>
        id === bestTransfer.sellId ? bestTransfer.buyId : id
      )
      // Update position map: new player inherits the sell player's position
      const soldPosition = positionMap.get(bestTransfer.sellId)
      if (soldPosition !== undefined) {
        positionMap.delete(bestTransfer.sellId)
        positionMap.set(bestTransfer.buyId, soldPosition)
      }

      simulatedBank = simulatedBank + sellPrice - buyPlayer.now_cost

      transfersIn = [bestTransfer.buyId]
      transfersOut = [bestTransfer.sellId]
      transfersUsed = 1
    }

    // Snapshot position map for squad accordion display (per D-04)
    const positionsAfter: Record<number, number> = {}
    for (const [id, pos] of positionMap.entries()) {
      positionsAfter[id] = pos
    }

    // Compute hit cost for the step (actual transfers used)
    const stepHitCost = computeHitCost(currentFT.available, transfersUsed, null)

    // Top 5 scored transfers for the step record
    const top5 = allScoredTransfers.slice(0, 5)

    const step: PlanStep = {
      gw: targetGw,
      chip: null,
      transfersIn,
      transfersOut,
      freeTransfersAvailable: currentFT.available,
      hitCost: stepHitCost,
      scoredTransfers: top5,
      squadAfter: [...simulatedSquadIds],
      positionsAfter,          // NEW — per D-04
      unconfirmedFixtures,
    }

    steps.push(step)

    // Advance FT state for the next step
    currentFT = computeNextFTState(currentFT.available, transfersUsed, null)
  }

  return {
    steps,
    horizon,
    startingGw,
  }
}
