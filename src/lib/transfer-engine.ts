import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

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

// Stub — not yet implemented
export function computeTransferSuggestions(
  _picks: SquadPick[],
  _allPlayers: ScoredPlayer[],
  _bankBalance: number,
  _freeTransfers: number,
  _activeChip: ChipState,
): TransferResult {
  throw new Error('Not implemented')
}
