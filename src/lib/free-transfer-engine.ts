import type { PlannerChip, FTState } from './types'

export function computeNextFTState(
  currentAvailable: number,
  transfersUsed: number,
  chip: PlannerChip,
): FTState {
  throw new Error('not implemented')
}

export function computeHitCost(
  available: number,
  transfersUsed: number,
  chip: PlannerChip,
): number {
  throw new Error('not implemented')
}

export function snapshotSquad<T>(squad: T[]): T[] {
  throw new Error('not implemented')
}
