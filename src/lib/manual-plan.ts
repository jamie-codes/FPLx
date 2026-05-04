import type { PlannerHorizon, PlannerChip, FTState, ScoredPlayer } from './types'
import type { SquadPick } from './squad-adapter'
import { computeNextFTState, computeHitCost, snapshotSquad } from './free-transfer-engine'

export const MANUAL_PLAN_KEY = 'fplx_manual_plan'

export interface ManualTransfer {
  sellId: number
  buyId: number
}

export interface ManualStep {
  gw: number
  chip: PlannerChip
  transfers: ManualTransfer[]  // unlimited per D-07
}

export interface ManualPlan {
  version: 1
  horizon: PlannerHorizon
  steps: ManualStep[]
}

export interface DerivedStep {
  gw: number
  chip: PlannerChip
  transfers: ManualTransfer[]
  hitCost: number                                 // 0 or negative multiple of 4
  freeTransfersAvailable: number                  // FTs available BEFORE this step
  bankAfter: number                               // tenths of £1m, after this step's transfers settle
  squadAfter: number[]                            // 15 player IDs (post-step)
  positionsAfter: Record<number, number>          // playerId → 1..15 lineup slot
  ftAfter: FTState                                // FT state ENTERING the next step
}

export interface ManualPlanSummary {
  totalTransfers: number
  totalHits: number               // count of transfers that incurred -4 cost
  totalHitCostPts: number         // total negative pts cost (sum of step.hitCost; <= 0)
  avgBreakEvenGws: number | null  // mean over positive-delta hit transfers; null when none
}

export interface DeriveStepStatesArgs {
  initialPicks: SquadPick[]                       // length 15 (from useSquad or useMyTeam)
  initialFT: FTState
  initialBank: number                             // tenths of £1m
  sellPrices: Map<number, number> | undefined     // exact selling_price by playerId; undefined → use now_cost (D-13)
  playerMap: Map<number, ScoredPlayer>            // for now_cost lookup + xPts deltas
  plan: ManualPlan
}

export function freshPlan(horizon: PlannerHorizon, startingGw: number): ManualPlan {
  throw new Error('not implemented')
}

export function truncateOrExtendSteps(
  steps: ManualStep[],
  newHorizon: PlannerHorizon,
  startingGw: number,
): ManualStep[] {
  throw new Error('not implemented')
}

export function deriveStepStates(args: DeriveStepStatesArgs): DerivedStep[] {
  throw new Error('not implemented')
}

export function computeManualPlanSummary(
  derived: DerivedStep[],
  playerMap: Map<number, ScoredPlayer>,
): ManualPlanSummary {
  throw new Error('not implemented')
}

export function persistManualPlan(plan: ManualPlan): void {
  throw new Error('not implemented')
}

export function loadManualPlan(): ManualPlan | null {
  throw new Error('not implemented')
}

export function clearManualPlan(): void {
  throw new Error('not implemented')
}

