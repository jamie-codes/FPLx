import { describe, it, expect } from 'vitest'
import type { ScoredPlayer } from './types'
import type { SquadPick } from './squad-adapter'
import type { ManualStep } from './manual-plan'
import {
  freshPlan,
  truncateOrExtendSteps,
  deriveStepStates,
  computeManualPlanSummary,
} from './manual-plan'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

function makeScored(
  id: number,
  opts: { element_type?: 1 | 2 | 3 | 4; now_cost?: number; xPts_1gw?: number } = {},
): ScoredPlayer {
  return {
    id,
    element_type: opts.element_type ?? 4,
    now_cost: opts.now_cost ?? 60,
    xPts_1gw: opts.xPts_1gw,
    web_name: `Player${id}`,
    // Minimal required fields to satisfy ScoredPlayer (MergedPlayer base)
    team: 1,
    selected_by_percent: '5.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    defensive_contribution: null,
    defensive_contribution_per_90: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 90,
    form_pts_per90: 5,
    fixtures: [],
    xmins: 90,
    start_prob: 0.9,
    mins_risk: 'nailed',
    gem_score: 0,
    value_score: 0,
    xg_score: 0,
    xa_score: 0,
    form_score: 0,
    fixture_score: 0,
    minutes_score: 0,
    pts_last3gw: 15,
    pts_last5gw: 25,
  } as unknown as ScoredPlayer
}

/** Build initial picks for 15 players with IDs 1..15 */
function makeInitialPicks(ids: number[] = Array.from({ length: 15 }, (_, i) => i + 1)): SquadPick[] {
  return ids.map((id, i) => makePick(id, i + 1))
}

// ---------------------------------------------------------------------------
// describe block
// ---------------------------------------------------------------------------

describe('manual-plan', () => {
  // -------------------------------------------------------------------------
  // freshPlan
  // -------------------------------------------------------------------------

  it('Test 1 (freshPlan): freshPlan(3, 33) returns 3 steps with gw 33, 34, 35; chip=null, transfers=[]', () => {
    const plan = freshPlan(3, 33)
    expect(plan.version).toBe(1)
    expect(plan.horizon).toBe(3)
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps[0]).toEqual({ gw: 33, chip: null, transfers: [] })
    expect(plan.steps[1]).toEqual({ gw: 34, chip: null, transfers: [] })
    expect(plan.steps[2]).toEqual({ gw: 35, chip: null, transfers: [] })
  })

  // -------------------------------------------------------------------------
  // truncateOrExtendSteps
  // -------------------------------------------------------------------------

  it('Test 2 (truncate): truncateOrExtendSteps(stepsLen5, 2, 33) returns length 2, first 2 unchanged, original not mutated', () => {
    const original: ManualStep[] = Array.from({ length: 5 }, (_, i) => ({
      gw: 33 + i,
      chip: null,
      transfers: [],
    }))
    const originalRef = original[0]
    const result = truncateOrExtendSteps(original as ManualStep[], 2, 33)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(original[0])
    expect(result[1]).toEqual(original[1])
    // Original array not mutated — still 5 elements
    expect(original).toHaveLength(5)
    // The result is a new array (not a reference to original)
    expect(result).not.toBe(original)
  })

  it('Test 3 (extend): truncateOrExtendSteps(stepsLen2, 4, 33) returns length 4 with correct sequential gws', () => {
    const original: ManualStep[] = [
      { gw: 33, chip: null, transfers: [] },
      { gw: 34, chip: null, transfers: [] },
    ]
    const result = truncateOrExtendSteps(original as ManualStep[], 4, 33)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual(original[0])
    expect(result[1]).toEqual(original[1])
    expect(result[2]).toEqual({ gw: 35, chip: null, transfers: [] })
    expect(result[3]).toEqual({ gw: 36, chip: null, transfers: [] })
  })

  // -------------------------------------------------------------------------
  // deriveStepStates — bank calculations
  // -------------------------------------------------------------------------

  it('Test 4 (derive bank): sell £8.0m (id=10), buy £7.5m (id=99), starting bank £1.0m → bankAfter = £1.5m (tenths)', () => {
    const picks = makeInitialPicks()
    // Replace player at position 1 (id=1) with id=10 (£8.0m) so we can sell id=10
    picks[0] = makePick(10, 1)
    // Put filler first, then specific entries last so they override any filler conflicts
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 14 }, (_, i) => [i + 2, makeScored(i + 2)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 80 })],  // sell £8.0m — overrides filler for id=10
      [99, makeScored(99, { now_cost: 75 })],  // buy £7.5m
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 10,  // £1.0m in tenths
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{ gw: 33, chip: null, transfers: [{ sellId: 10, buyId: 99 }] }],
      },
    })
    expect(derived).toHaveLength(1)
    // bank = 10 + 80 - 75 = 15 tenths = £1.5m
    expect(derived[0].bankAfter).toBe(15)
  })

  it('Test 5 (derive bank with sellPrices): sellPrices.set(10, 75) → bankAfter uses 75 not now_cost 80', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 14 }, (_, i) => [i + 2, makeScored(i + 2)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 80 })],  // specific entry overrides filler
      [99, makeScored(99, { now_cost: 75 })],
    ])
    const sellPrices = new Map<number, number>([[10, 75]])  // exact selling price £7.5m
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 10,
      sellPrices,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{ gw: 33, chip: null, transfers: [{ sellId: 10, buyId: 99 }] }],
      },
    })
    // bank = 10 + 75 (sell price) - 75 (buy price) = 10
    expect(derived[0].bankAfter).toBe(10)
  })

  it('Test 6 (derive bank without sellPrices): undefined sellPrices → falls back to now_cost for sell', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 14 }, (_, i) => [i + 2, makeScored(i + 2)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 80 })],  // specific entry overrides filler
      [99, makeScored(99, { now_cost: 75 })],
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 10,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{ gw: 33, chip: null, transfers: [{ sellId: 10, buyId: 99 }] }],
      },
    })
    // Undefined sellPrices → uses now_cost 80 for sell
    // bank = 10 + 80 - 75 = 15
    expect(derived[0].bankAfter).toBe(15)
  })

  // -------------------------------------------------------------------------
  // deriveStepStates — FT propagation
  // -------------------------------------------------------------------------

  it('Test 7 (derive FT propagation): step 0 with 1 transfer, initialFT={1,0} → step 0 ftAfter.available=1; step 1 hitCost=0 with 1 transfer', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 13 }, (_, i) => [i + 2, makeScored(i + 2)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60 })],  // specific entry overrides filler
      [99, makeScored(99, { now_cost: 60 })],
      [100, makeScored(100, { now_cost: 60 })],
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 2,
        steps: [
          { gw: 33, chip: null, transfers: [{ sellId: 10, buyId: 99 }] },
          { gw: 34, chip: null, transfers: [{ sellId: 99, buyId: 100 }] },
        ],
      },
    })
    expect(derived).toHaveLength(2)
    // Step 0: used the 1 FT, ftAfter should have available=1, banked=0
    expect(derived[0].ftAfter).toEqual({ available: 1, banked: 0 })
    // Step 1: FT available=1 from ftAfter of step 0; 1 transfer = 0 hits
    expect(derived[1].hitCost).toBe(0)
  })

  it('Test 8 (derive hit cost): step 0 with 2 transfers, FT available=1 → hitCost = -4; freeTransfersAvailable = 1', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    picks[1] = makePick(11, 2)
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 11 }, (_, i) => [i + 3, makeScored(i + 3)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60 })],  // specific entries override filler
      [11, makeScored(11, { now_cost: 60 })],
      [99, makeScored(99, { now_cost: 60 })],
      [100, makeScored(100, { now_cost: 60 })],
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{ gw: 33, chip: null, transfers: [{ sellId: 10, buyId: 99 }, { sellId: 11, buyId: 100 }] }],
      },
    })
    expect(derived[0].hitCost).toBe(-4)
    expect(derived[0].freeTransfersAvailable).toBe(1)
  })

  // -------------------------------------------------------------------------
  // deriveStepStates — chip interactions
  // -------------------------------------------------------------------------

  it('Test 9 (Wildcard): step with chip=wildcard and 5 transfers → hitCost = 0', () => {
    const ids = [10, 11, 12, 13, 14]
    const buyIds = [20, 21, 22, 23, 24]
    const picks = makeInitialPicks()
    ids.forEach((id, i) => { picks[i] = makePick(id, i + 1) })
    const playerMap = new Map<number, ScoredPlayer>([
      ...ids.map(id => [id, makeScored(id, { now_cost: 60 })] as [number, ScoredPlayer]),
      ...buyIds.map(id => [id, makeScored(id, { now_cost: 60 })] as [number, ScoredPlayer]),
      ...Array.from({ length: 10 }, (_, i) => [i + 30, makeScored(i + 30)] as [number, ScoredPlayer]),
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{
          gw: 33,
          chip: 'wildcard',
          transfers: ids.map((sellId, i) => ({ sellId, buyId: buyIds[i] })),
        }],
      },
    })
    expect(derived[0].hitCost).toBe(0)
  })

  it('Test 10 (Free Hit): step with chip=freehit → ftAfter for next step preserves banked FT', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 14 }, (_, i) => [i + 2, makeScored(i + 2)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60 })],  // specific entries override filler
      [99, makeScored(99, { now_cost: 60 })],
    ])
    // Start with 2 FTs banked
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 2, banked: 1 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{ gw: 33, chip: 'freehit', transfers: [{ sellId: 10, buyId: 99 }] }],
      },
    })
    // Free Hit: computeNextFTState('freehit') preserves the banked FT
    // With available=2, banked = min(1, max(0, 2-1)) = 1, nextAvailable = 1+1 = 2
    expect(derived[0].ftAfter.banked).toBe(1)
    expect(derived[0].ftAfter.available).toBe(2)
  })

  // -------------------------------------------------------------------------
  // deriveStepStates — squad replay
  // -------------------------------------------------------------------------

  it('Test 11 (replay squad): initialPicks 15 players; transfer sells id=1, buys id=99 → squadAfter has 99 not 1, position preserved', () => {
    const picks = makeInitialPicks()  // ids 1..15, positions 1..15
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 15 }, (_, i) => [i + 1, makeScored(i + 1)] as [number, ScoredPlayer]),
      [99, makeScored(99, { now_cost: 60 })],
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{ gw: 33, chip: null, transfers: [{ sellId: 1, buyId: 99 }] }],
      },
    })
    expect(derived[0].squadAfter).toContain(99)
    expect(derived[0].squadAfter).not.toContain(1)
    // Position preserved: id=1 was at position 1, so id=99 should be at position 1
    expect(derived[0].positionsAfter[99]).toBe(1)
  })

  it('Test 12 (multi-step squad replay): step 0 sells 1 buys 99; step 1 sells 99 buys 200 → step 1 squadAfter has 200 not 99 nor 1', () => {
    const picks = makeInitialPicks()  // ids 1..15
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 15 }, (_, i) => [i + 1, makeScored(i + 1)] as [number, ScoredPlayer]),
      [99, makeScored(99, { now_cost: 60 })],
      [200, makeScored(200, { now_cost: 60 })],
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 2, banked: 1 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 2,
        steps: [
          { gw: 33, chip: null, transfers: [{ sellId: 1, buyId: 99 }] },
          { gw: 34, chip: null, transfers: [{ sellId: 99, buyId: 200 }] },
        ],
      },
    })
    expect(derived[1].squadAfter).toContain(200)
    expect(derived[1].squadAfter).not.toContain(99)
    expect(derived[1].squadAfter).not.toContain(1)
  })

  // -------------------------------------------------------------------------
  // computeManualPlanSummary
  // -------------------------------------------------------------------------

  it('Test 13 (summary totalHits): 2 hit transfers → totalHits=2, totalHitCostPts=-8', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    picks[1] = makePick(11, 2)
    picks[2] = makePick(12, 3)
    // Filler first, specific entries last so they override any conflicts
    const fillerIds = [4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18]
    const playerMap = new Map<number, ScoredPlayer>([
      ...fillerIds.map(id => [id, makeScored(id)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60, xPts_1gw: 5 })],
      [11, makeScored(11, { now_cost: 60, xPts_1gw: 5 })],
      [12, makeScored(12, { now_cost: 60, xPts_1gw: 5 })],
      [99, makeScored(99, { now_cost: 60, xPts_1gw: 7 })],
      [100, makeScored(100, { now_cost: 60, xPts_1gw: 7 })],
      [101, makeScored(101, { now_cost: 60, xPts_1gw: 7 })],
    ])
    // Step with 1 FT available, 3 transfers → 1 free, 2 hits → hitCost = -8
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{
          gw: 33,
          chip: null,
          transfers: [
            { sellId: 10, buyId: 99 },
            { sellId: 11, buyId: 100 },
            { sellId: 12, buyId: 101 },
          ],
        }],
      },
    })
    const summary = computeManualPlanSummary(derived, playerMap)
    expect(summary.totalHits).toBe(2)
    expect(summary.totalHitCostPts).toBe(-8)
  })

  it('Test 14 (summary breakEven): hit transfer with xPts_buy=8.0, xPts_sell=4.0 (delta 4.0) → avgBreakEvenGws=1.0', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    picks[1] = makePick(11, 2)
    // Filler first, specific entries last so they override any conflicts
    const fillerIds = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16]
    const playerMap = new Map<number, ScoredPlayer>([
      ...fillerIds.map(id => [id, makeScored(id)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60, xPts_1gw: 4 })],
      [11, makeScored(11, { now_cost: 60, xPts_1gw: 4 })],
      [99, makeScored(99, { now_cost: 60, xPts_1gw: 4 })],  // free transfer (same xPts)
      [100, makeScored(100, { now_cost: 60, xPts_1gw: 8 })], // hit transfer, delta = 8-4 = 4
    ])
    // 2 transfers, 1 FT available → first free, second is a hit
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{
          gw: 33,
          chip: null,
          transfers: [
            { sellId: 10, buyId: 99 },   // free
            { sellId: 11, buyId: 100 },  // hit; xPts delta = 8 - 4 = 4; BE = 4/4 = 1.0
          ],
        }],
      },
    })
    const summary = computeManualPlanSummary(derived, playerMap)
    expect(summary.avgBreakEvenGws).toBeCloseTo(1.0)
  })

  it('Test 15 (summary breakEven infinity): hit transfer with xPts_buy=2.0, xPts_sell=8.0 (negative delta) → excluded; avg = null', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    picks[1] = makePick(11, 2)
    // Filler first, specific entries last so they override any conflicts
    const fillerIds = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16]
    const playerMap = new Map<number, ScoredPlayer>([
      ...fillerIds.map(id => [id, makeScored(id)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60, xPts_1gw: 4 })],
      [11, makeScored(11, { now_cost: 60, xPts_1gw: 8 })],
      [99, makeScored(99, { now_cost: 60, xPts_1gw: 4 })],
      [100, makeScored(100, { now_cost: 60, xPts_1gw: 2 })],  // hit; delta = 2-8 = -6 (neg)
    ])
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{
          gw: 33,
          chip: null,
          transfers: [
            { sellId: 10, buyId: 99 },    // free
            { sellId: 11, buyId: 100 },   // hit; delta <= 0 → excluded from avg
          ],
        }],
      },
    })
    const summary = computeManualPlanSummary(derived, playerMap)
    expect(summary.avgBreakEvenGws).toBeNull()
  })

  it('Test 16 (summary all-infinity): all hit transfers have delta ≤ 0 → avgBreakEvenGws === null', () => {
    const picks = makeInitialPicks()
    picks[0] = makePick(10, 1)
    picks[1] = makePick(11, 2)
    picks[2] = makePick(12, 3)
    // Filler first, specific entries last so they override any conflicts
    const fillerIds = [4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18]
    const playerMap = new Map<number, ScoredPlayer>([
      ...fillerIds.map(id => [id, makeScored(id)] as [number, ScoredPlayer]),
      [10, makeScored(10, { now_cost: 60, xPts_1gw: 8 })],
      [11, makeScored(11, { now_cost: 60, xPts_1gw: 8 })],
      [12, makeScored(12, { now_cost: 60, xPts_1gw: 8 })],
      [99, makeScored(99, { now_cost: 60, xPts_1gw: 6 })],
      [100, makeScored(100, { now_cost: 60, xPts_1gw: 3 })],
      [101, makeScored(101, { now_cost: 60, xPts_1gw: 1 })],
    ])
    // 3 transfers, 1 FT → 1 free + 2 hits, all hits have negative delta
    const derived = deriveStepStates({
      initialPicks: picks,
      initialFT: { available: 1, banked: 0 },
      initialBank: 0,
      sellPrices: undefined,
      playerMap,
      plan: {
        version: 1,
        horizon: 1,
        steps: [{
          gw: 33,
          chip: null,
          transfers: [
            { sellId: 10, buyId: 99 },   // free; xPts delta = 6-8 = -2
            { sellId: 11, buyId: 100 },  // hit; delta = 3-8 = -5
            { sellId: 12, buyId: 101 },  // hit; delta = 1-8 = -7
          ],
        }],
      },
    })
    const summary = computeManualPlanSummary(derived, playerMap)
    expect(summary.avgBreakEvenGws).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-59-04: graceful playerMap miss
  // -------------------------------------------------------------------------

  it('Test 17 (graceful playerMap miss): transfer references playerId not in playerMap → does not throw; bankDelta treated as 0; id in squadAfter', () => {
    const picks = makeInitialPicks()  // ids 1..15
    // playerMap is missing id=1 (the sell player) and id=999 (the buy player)
    const playerMap = new Map<number, ScoredPlayer>([
      ...Array.from({ length: 14 }, (_, i) => [i + 2, makeScored(i + 2)] as [number, ScoredPlayer]),
    ])
    let thrown = false
    let derived
    try {
      derived = deriveStepStates({
        initialPicks: picks,
        initialFT: { available: 1, banked: 0 },
        initialBank: 50,
        sellPrices: undefined,
        playerMap,
        plan: {
          version: 1,
          horizon: 1,
          steps: [{ gw: 33, chip: null, transfers: [{ sellId: 1, buyId: 999 }] }],
        },
      })
    } catch {
      thrown = true
    }
    expect(thrown).toBe(false)
    // When playerMap misses sell, fallback now_cost = 0; when misses buy, fallback = 0
    // bank delta = 0 - 0 = 0; bank stays at 50
    expect(derived![0].bankAfter).toBe(50)
    // buyId=999 should appear in squadAfter
    expect(derived![0].squadAfter).toContain(999)
  })
})
