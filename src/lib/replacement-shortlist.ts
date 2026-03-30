import type { ScoredPlayer } from '@/lib/types'

export interface ShortlistEntry {
  player: ScoredPlayer
  pts_delta: number
  budget_sufficient: boolean
}

export function computeReplacementShortlist(
  sellPlayer: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  squadIds: Set<number>,
  bankBalance: number,
  count = 5,
): ShortlistEntry[] {
  return []
}
