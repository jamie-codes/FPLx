import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

function isRotationRisk(p: ScoredPlayer): boolean {
  return p.mins_risk === 'rotation_risk' || p.mins_risk === 'cameo'
}

/** Count fixtures the player has in their immediately upcoming GW (DGW = 2, BGW = 0). */
function nextGwFixtureCount(p: ScoredPlayer): number {
  if (!p.fixtures.length) return 0
  const nextGwId = p.fixtures[0].event_id
  return p.fixtures.filter(f => f.event_id === nextGwId).length
}

export type ChipState = 'freehit' | 'wildcard' | 'bboost' | '3xc' | null

export interface SingleTransfer {
  sell: ScoredPlayer
  buy: ScoredPlayer
  gem_delta: number           // buy.gem_score - sell.gem_score
  approx_cost: number         // buy.now_cost/10 - sell.now_cost/10 (positive = costs more)
  available_budget: number    // bankBalance/10 + sell.now_cost/10 (approx)
  budget_sufficient: boolean  // buy.now_cost/10 <= available_budget
}

export interface TransferResult {
  type: 'SUGGESTIONS' | 'SAVE' | 'CHIP_WARNING'
  chip?: ChipState             // populated when type === 'CHIP_WARNING'
  suggestions?: SingleTransfer[]
  two_transfer_combo?: [SingleTransfer, SingleTransfer]  // if freeTransfers >= 2
  message?: string
}

/**
 * Compute transfer suggestions for a manager's squad.
 *
 * Pure function — no side effects. Takes data in, returns result out.
 *
 * @param picks        Squad picks from the picks endpoint (positions 1-11 = starting XI)
 * @param allPlayers   All scored players (from computeAllGemScores)
 * @param bankBalance  entry_history.bank — raw tenths of £1m (e.g. 15 = £1.5m)
 * @param freeTransfers  Number of free transfers available this gameweek
 * @param activeChip   Active chip state, or null if none active
 */
export function computeTransferSuggestions(
  picks: SquadPick[],
  allPlayers: ScoredPlayer[],
  bankBalance: number,
  freeTransfers: number,
  activeChip: ChipState,
): TransferResult {
  // Step 1: Chip guard — freehit and wildcard block transfer suggestions
  if (activeChip === 'freehit' || activeChip === 'wildcard') {
    return { type: 'CHIP_WARNING', chip: activeChip }
  }

  // Step 2: Build fast lookup structures
  const squadIds = new Set(picks.map(p => p.element))
  const playerMap = new Map(allPlayers.map(p => [p.id, p]))

  // Step 3: Identify starting XI sell candidates (positions 1-11), sorted by gem_score ascending
  const startingXI = picks
    .filter(p => p.position >= 1 && p.position <= 11)
    .map(p => playerMap.get(p.element))
    .filter((p): p is ScoredPlayer => p !== undefined)
    .sort((a, b) => a.gem_score - b.gem_score)

  // Step 4: For each sell candidate, find up to 3 replacements
  const allSuggestions: SingleTransfer[] = []

  for (const sellPlayer of startingXI) {
    const available_budget = bankBalance / 10 + sellPlayer.now_cost / 10

    // Find replacements: same position, not in squad, sorted by gem_score desc
    const replacements = allPlayers
      .filter(
        candidate =>
          candidate.element_type === sellPlayer.element_type &&
          !squadIds.has(candidate.id)
      )
      .sort((a, b) => b.gem_score - a.gem_score)
      .slice(0, 3)

    for (const buyPlayer of replacements) {
      const gem_delta = buyPlayer.gem_score - sellPlayer.gem_score
      const approx_cost = buyPlayer.now_cost / 10 - sellPlayer.now_cost / 10
      const budget_sufficient = buyPlayer.now_cost / 10 <= available_budget

      allSuggestions.push({
        sell: sellPlayer,
        buy: buyPlayer,
        gem_delta,
        approx_cost,
        available_budget,
        budget_sufficient,
      })
    }
  }

  // Step 5: Sort — budget tier > rotation risk on buy > gem_delta desc
  allSuggestions.sort((a, b) => {
    // Tier 1: affordable before unaffordable
    if (a.budget_sufficient !== b.budget_sufficient) {
      return a.budget_sufficient ? -1 : 1
    }
    // Tier 2: non-rotation-risk buy before rotation-risk buy
    const aRisk = isRotationRisk(a.buy)
    const bRisk = isRotationRisk(b.buy)
    if (aRisk !== bRisk) return aRisk ? 1 : -1
    // Tier 3: DGW buy (2 fixtures next GW) before single-fixture buy; BGW (0) ranks last
    const aDgw = nextGwFixtureCount(a.buy)
    const bDgw = nextGwFixtureCount(b.buy)
    if (aDgw !== bDgw) return bDgw - aDgw
    // Tier 4: higher gem_delta first
    return b.gem_delta - a.gem_delta
  })

  // Step 6: Save check — if no positive gem_delta, recommend saving the transfer
  const hasPositiveDelta = allSuggestions.some(s => s.gem_delta > 0)
  if (!hasPositiveDelta) {
    return {
      type: 'SAVE',
      message: 'No transfer improves your squad Gem rating. Save your transfer and bank it for next week.',
    }
  }

  // Step 7: Build two-transfer combo if freeTransfers >= 2
  let two_transfer_combo: [SingleTransfer, SingleTransfer] | undefined

  if (freeTransfers >= 2 && allSuggestions.length >= 2) {
    const first = allSuggestions[0]
    // Find second: must have different buy target AND different sell target
    const second = allSuggestions.find(
      s => s.buy.id !== first.buy.id && s.sell.id !== first.sell.id
    )
    if (second) {
      two_transfer_combo = [first, second]
    }
  }

  return {
    type: 'SUGGESTIONS',
    suggestions: allSuggestions,
    two_transfer_combo,
  }
}
