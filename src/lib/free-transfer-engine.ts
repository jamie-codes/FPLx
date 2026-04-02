import type { PlannerChip, FTState } from './types'

export function computeNextFTState(
  currentAvailable: number,
  transfersUsed: number,
  chip: PlannerChip,
): FTState {
  // Wildcard: resets bank to 1 next GW
  if (chip === 'wildcard') {
    return { available: 1, banked: 0 }
  }
  // Free Hit: bank passes through unchanged (as if GW didn't happen for FT purposes)
  if (chip === 'freehit') {
    const banked = Math.min(1, currentAvailable - 1)
    const nextAvailable = 1 + banked
    return { available: nextAvailable, banked }
  }
  // Normal GW (including bboost and 3xc which don't affect FTs)
  const unused = Math.max(0, currentAvailable - transfersUsed)
  const banked = Math.min(1, unused)
  const nextAvailable = 1 + banked
  return { available: nextAvailable, banked }
}

export function computeHitCost(
  available: number,
  transfersUsed: number,
  chip: PlannerChip,
): number {
  if (chip === 'wildcard' || chip === 'freehit') return 0
  const hits = Math.max(0, transfersUsed - available)
  if (hits === 0) return 0
  return hits * -4
}

export function snapshotSquad<T>(squad: T[]): T[] {
  return structuredClone(squad)
}
