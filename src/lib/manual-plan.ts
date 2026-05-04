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

// ---------------------------------------------------------------------------
// freshPlan
// ---------------------------------------------------------------------------

export function freshPlan(horizon: PlannerHorizon, startingGw: number): ManualPlan {
  return {
    version: 1,
    horizon,
    steps: Array.from({ length: horizon }, (_, i) => ({
      gw: startingGw + i,
      chip: null as PlannerChip,
      transfers: [],
    })),
  }
}

// ---------------------------------------------------------------------------
// truncateOrExtendSteps
// ---------------------------------------------------------------------------

export function truncateOrExtendSteps(
  steps: ManualStep[],
  newHorizon: PlannerHorizon,
  startingGw: number,
): ManualStep[] {
  if (newHorizon < steps.length) return steps.slice(0, newHorizon)
  if (newHorizon > steps.length) {
    const additions = Array.from({ length: newHorizon - steps.length }, (_, i) => ({
      gw: startingGw + steps.length + i,
      chip: null as PlannerChip,
      transfers: [],
    }))
    return [...steps, ...additions]
  }
  return [...steps]
}

// ---------------------------------------------------------------------------
// deriveStepStates
// ---------------------------------------------------------------------------

export function deriveStepStates(args: DeriveStepStatesArgs): DerivedStep[] {
  const { initialPicks, initialFT, initialBank, sellPrices, playerMap, plan } = args

  // Mutable working state
  let currentSquad: number[] = initialPicks.map(p => p.element)
  let currentPositions: Record<number, number> = Object.fromEntries(
    initialPicks.map(p => [p.element, p.position]),
  )
  let bank = initialBank
  let ft: FTState = { ...initialFT }

  const derived: DerivedStep[] = []

  for (const step of plan.steps) {
    // Snapshot state BEFORE applying this step's transfers (needed for Free Hit revert)
    const preStepSquad = snapshotSquad(currentSquad)
    const preStepPositions: Record<number, number> = { ...currentPositions }

    // FTs available BEFORE consuming them this step
    const freeTransfersAvailable = ft.available

    // Hit cost for this step (0 for WC/FH, -4 per extra transfer otherwise)
    const hitCost = computeHitCost(ft.available, step.transfers.length, step.chip)

    // Apply transfers to squad + bank
    for (const t of step.transfers) {
      // Sell price: exact from sellPrices if present, else now_cost, else 0 (T-59-04 graceful)
      const sellPriceTenths = sellPrices?.get(t.sellId) ?? playerMap.get(t.sellId)?.now_cost ?? 0
      const buyCostTenths = playerMap.get(t.buyId)?.now_cost ?? 0
      bank = bank + sellPriceTenths - buyCostTenths

      // Update squad: replace sellId with buyId
      const sellIndex = currentSquad.indexOf(t.sellId)
      if (sellIndex !== -1) {
        currentSquad[sellIndex] = t.buyId
        // Transfer position from sell to buy
        const pos = currentPositions[t.sellId]
        delete currentPositions[t.sellId]
        currentPositions[t.buyId] = pos
      } else {
        // T-59-04: sellId not in current squad — graceful fallback
        // Still add buyId if not already present
        if (!currentSquad.includes(t.buyId)) {
          currentSquad.push(t.buyId)
          // Assign a next free position (max + 1 fallback)
          const maxPos = Math.max(0, ...Object.values(currentPositions))
          currentPositions[t.buyId] = maxPos + 1
        }
      }
    }

    // Compute FT state for the NEXT step
    const ftNext = computeNextFTState(ft.available, step.transfers.length, step.chip)

    // Build derived step
    derived.push({
      gw: step.gw,
      chip: step.chip,
      transfers: step.transfers,
      hitCost,
      freeTransfersAvailable,
      bankAfter: bank,
      squadAfter: snapshotSquad(currentSquad),
      positionsAfter: { ...currentPositions },
      ftAfter: ftNext,
    })

    // Free Hit: squad reverts to pre-chip state for subsequent steps
    // The FH lineup is reflected in THIS step's squadAfter for display, but the
    // next step starts from the pre-FH squad (the manager's actual registered squad).
    if (step.chip === 'freehit') {
      currentSquad = preStepSquad
      currentPositions = preStepPositions
    }

    ft = ftNext
  }

  return derived
}

// ---------------------------------------------------------------------------
// computeManualPlanSummary
// ---------------------------------------------------------------------------

export function computeManualPlanSummary(
  derived: DerivedStep[],
  playerMap: Map<number, ScoredPlayer>,
): ManualPlanSummary {
  let totalTransfers = 0
  let totalHits = 0
  let totalHitCostPts = 0
  const breakEvens: number[] = []  // only positive-delta hit transfers contribute

  for (const step of derived) {
    totalTransfers += step.transfers.length
    totalHitCostPts += step.hitCost  // already 0 or negative

    // WC/FH: no hits regardless of transfer count
    if (step.chip === 'wildcard' || step.chip === 'freehit') continue

    const free = step.freeTransfersAvailable
    // The first `free` transfers are free; the remainder are hits
    const hitTransfers = step.transfers.slice(free)
    totalHits += hitTransfers.length

    for (const t of hitTransfers) {
      const xBuy = playerMap.get(t.buyId)?.xPts_1gw ?? 0
      const xSell = playerMap.get(t.sellId)?.xPts_1gw ?? 0
      const delta = xBuy - xSell
      if (delta > 0) breakEvens.push(4 / delta)
    }
  }

  const avgBreakEvenGws =
    breakEvens.length > 0
      ? breakEvens.reduce((a, b) => a + b, 0) / breakEvens.length
      : null

  return { totalTransfers, totalHits, totalHitCostPts, avgBreakEvenGws }
}

// ---------------------------------------------------------------------------
// Persistence helpers (T-59-01, T-59-02 mitigations)
// ---------------------------------------------------------------------------

export function persistManualPlan(plan: ManualPlan): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MANUAL_PLAN_KEY, JSON.stringify(plan))
  } catch {
    // Silently ignore storage errors (private mode, quota exceeded, etc.)
  }
}

export function loadManualPlan(): ManualPlan | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(MANUAL_PLAN_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const p = parsed as Partial<ManualPlan>
    // T-59-01: validate version
    if (p.version !== 1) return null
    // T-59-02: reject over-length plans (max horizon = 5)
    if (typeof p.horizon !== 'number' || p.horizon < 1 || p.horizon > 5) return null
    if (!Array.isArray(p.steps) || p.steps.length === 0 || p.steps.length > 5) return null
    // T-59-01: validate each step is shape-compatible
    for (const s of p.steps) {
      if (typeof s.gw !== 'number') return null
      if (!Array.isArray(s.transfers)) return null
    }
    return p as ManualPlan
  } catch {
    // T-59-01: JSON.parse errors → return null (caller falls back to fresh)
    return null
  }
}

export function clearManualPlan(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(MANUAL_PLAN_KEY)
  } catch {
    // Silently ignore storage errors
  }
}
