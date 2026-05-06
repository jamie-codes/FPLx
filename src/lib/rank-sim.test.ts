// @vitest-environment node
// Phase 62 (MC-03): rank-sim trajectory math unit tests.
// Sources:
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-CONTEXT.md §decisions D-06..D-09
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-02-PLAN.md <behavior> tests 1-12
import { describe, it, expect } from 'vitest'
import { computeXITrajectory, computeXIPerGwStats, computeBeatTheAverageProb } from './rank-sim'
import type { MergedPlayer } from './types'

// Minimal MergedPlayer factory — only the fields rank-sim.ts uses
function p(id: number, xPts: number, p10: number, p90: number): MergedPlayer {
  return {
    id,
    xPts_1gw: xPts,
    p10_pts: p10,
    p90_pts: p90,
    // Required MergedPlayer fields — minimally satisfied for type-checking
    web_name: `Player${id}`,
    team: 1,
    team_short_name: 'TST',
    element_type: 3,
    now_cost: 60,
    selected_by_percent: '5.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 100,
    goals_scored: 5,
    assists: 3,
    expected_goals: 3.5,
    expected_assists: 2.1,
    pts_last3gw: 15,
    pts_last5gw: 25,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 90,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 90,
    start_prob: 1.0,
    mins_risk: 'nailed',
  } as MergedPlayer
}

describe('Phase 62: computeXITrajectory', () => {
  it('Test 1: returns 6 ChartPoints with empty input — all zeros', () => {
    const result = computeXITrajectory([], 0, new Map())
    expect(result).toHaveLength(6)
    expect(result.every(pt => pt.mean === 0 && pt.p10 === 0 && pt.p90 === 0)).toBe(true)
  })

  it('Test 2: returns ChartPoints labelled Start, GW+1, ..., GW+5', () => {
    const result = computeXITrajectory([], 0, new Map())
    expect(result.map(pt => pt.gw)).toEqual(['Start', 'GW+1', 'GW+2', 'GW+3', 'GW+4', 'GW+5'])
  })

  it('Test 3: Start point has mean=p10=p90=0', () => {
    const result = computeXITrajectory([1], -1, new Map([[1, p(1, 5, 3, 8)]]))
    expect(result[0]).toEqual({ gw: 'Start', mean: 0, p10: 0, p90: 0 })
  })

  it('Test 4: sums xPts_1gw across XI for GW+1 mean (no captain, captainId=-1)', () => {
    // 11 players each with xPts=5, captain=-1 (no captain)
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const map = new Map(ids.map(id => [id, p(id, 5, 4, 8)]))
    const result = computeXITrajectory(ids, -1, map)
    expect(result[1].mean).toBe(55)  // 11 × 5
  })

  it('Test 5: doubles captain xPts_1gw contribution (captain with xPts=5 → 10)', () => {
    // 11 players each with xPts=5; captain is player 1 → contributes 10
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const map = new Map(ids.map(id => [id, p(id, 5, 4, 8)]))
    const result = computeXITrajectory(ids, 1, map)  // captainId=1
    // Captain contributes 10 (doubled), other 10 contribute 5 each = 10+50 = 60
    expect(result[1].mean).toBe(60)
  })

  it('Test 6: GW+1 band half-width = √(Σ σ_player²) for 11 players (no captain)', () => {
    // All players have p10=4, p90=8 → σ_player = (8-4)/2.56 = 1.5625
    // σ_XI = √(11 × 1.5625²) = √(11 × 2.44140625) = √26.85546875 ≈ 5.1824
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const map = new Map(ids.map(id => [id, p(id, 5, 4, 8)]))
    const result = computeXITrajectory(ids, -1, map)
    const sigmaPlayer = (8 - 4) / 2.56  // 1.5625
    const sigmaXI = Math.sqrt(11 * sigmaPlayer * sigmaPlayer)  // ≈ 5.1824
    const halfBand = result[1].p90 - result[1].mean
    expect(halfBand).toBeCloseTo(sigmaXI, 3)
  })

  it('Test 7: captain σ doubling — (2σ)² - σ² = 3σ² added to varSum', () => {
    // 11 players all with p10=4, p90=8 → σ=1.5625; captain is player 1
    // Without captain: varSum = 11 × 1.5625²
    // With captain (σ doubled to 3.125): varSum = 10 × 1.5625² + 1 × 3.125²
    //   = 10 × 2.44140625 + 9.765625 = 24.4140625 + 9.765625 = 34.1796875
    // Extra vs no-captain: 34.18 - 26.86 = 7.32 ≈ 3 × 2.44 = 7.32 ✓
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const map = new Map(ids.map(id => [id, p(id, 5, 4, 8)]))
    const result = computeXITrajectory(ids, 1, map)  // captainId=1
    const sigmaPlayer = (8 - 4) / 2.56
    const varWithCaptain = 10 * sigmaPlayer * sigmaPlayer + (2 * sigmaPlayer) * (2 * sigmaPlayer)
    const sigmaXI = Math.sqrt(varWithCaptain)
    const halfBand = result[1].p90 - result[1].mean
    expect(halfBand).toBeCloseTo(sigmaXI, 3)
  })

  it('Test 8: GW+4 cumulative — mean=4×gwMean, band=mean ± √4×σ_XI', () => {
    // 11 players each xPts=5, no captain, p10=4, p90=8
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const map = new Map(ids.map(id => [id, p(id, 5, 4, 8)]))
    const result = computeXITrajectory(ids, -1, map)
    const { gwMean, gwSigma } = computeXIPerGwStats(ids, -1, map)
    expect(result[4].mean).toBeCloseTo(4 * gwMean, 3)
    const halfBand = result[4].p90 - result[4].mean
    expect(halfBand).toBeCloseTo(Math.sqrt(4) * gwSigma, 3)  // √4 = 2
  })

  it('Test 9: BGW player (xPts=0, p10=0, p90=0) contributes 0 to mean and σ²', () => {
    // 10 normal players (xPts=5) + 1 BGW (xPts=0) → GW+1 mean = 50
    const normalIds = Array.from({ length: 10 }, (_, i) => i + 1)
    const bgwId = 11
    const map = new Map([
      ...normalIds.map(id => [id, p(id, 5, 4, 8)] as [number, MergedPlayer]),
      [bgwId, p(bgwId, 0, 0, 0)],
    ])
    const result = computeXITrajectory([...normalIds, bgwId], -1, map)
    expect(result[1].mean).toBe(50)  // BGW contributes 0
  })
})

describe('Phase 62: computeBeatTheAverageProb', () => {
  it('Test 10: Φ(2) ≈ 0.9772 when cumMean=60, cumSigma=5, threshold=50', () => {
    // z = (60-50)/5 = 2; P(X>50) = 1 - Φ(-2) = Φ(2) ≈ 0.9772
    const prob = computeBeatTheAverageProb(60, 5, 50)
    expect(prob).toBeCloseTo(0.9772, 3)
  })

  it('Test 11: returns 0.5 when cumMean === threshold (z=0)', () => {
    const prob = computeBeatTheAverageProb(50, 5, 50)
    expect(prob).toBeCloseTo(0.5, 4)
  })

  it('Test 12: handles large z (Φ(4) ≈ 0.99997) — cumMean=100, cumSigma=10, threshold=60', () => {
    // z = (100-60)/10 = 4; P(X>60) ≈ 0.99997
    const prob = computeBeatTheAverageProb(100, 10, 60)
    expect(prob).toBeCloseTo(0.99997, 3)
  })
})
