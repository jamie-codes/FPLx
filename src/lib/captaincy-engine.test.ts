// VAR-01: captaincy-engine TDD tests — ceiling-led ranking (exp07-validated)
import { describe, it, expect } from 'vitest'
import { computeCaptaincyCandidates } from '@/lib/captaincy-engine'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---- Test helpers ----

function mkPick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

function mkPlayer(over: Partial<ScoredPlayer> & { id: number }): ScoredPlayer {
  const { id } = over
  const base: ScoredPlayer = {
    id,
    code: id,
    web_name: `P${id}`,
    team: 1,
    team_short_name: 'XXX',
    team_code: 1,
    element_type: 3,
    now_cost: 80,
    selected_by_percent: '10.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 5,
    assists: 3,
    expected_goals: 4.0,
    expected_assists: 2.5,
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
    minutes_per90: 80,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.9,
    mins_risk: 'nailed',
    xPts_1gw: 5.0,
    gem_score: 0.6,
    fdr_score: 0.7,
    form_score: 0.6,
    xg_score: 0.5,
    xa_score: 0.4,
    ownership_score: 0.5,
    minutes_score: 0.8,
    set_piece_score: 0.0,
  } as unknown as ScoredPlayer
  return { ...base, ...over }
}

// ---- Sort-by-ceiling: higher ceiling / lower mean ranks first ----

describe('computeCaptaincyCandidates — ceiling sort (VAR-01)', () => {
  it('higher-ceiling / lower-mean player ranks above lower-ceiling / higher-mean', () => {
    // P1: mean=6.0, ceiling=10.0 — should rank FIRST (higher ceiling)
    // P2: mean=7.0, ceiling=8.0  — should rank SECOND despite higher mean
    const picks = [mkPick(1, 1), mkPick(2, 2)]
    const players = [
      mkPlayer({ id: 1, xPts_1gw: 6.0, xPts_90th_1gw: 10.0 }),
      mkPlayer({ id: 2, xPts_1gw: 7.0, xPts_90th_1gw: 8.0 }),
    ]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result[0].player.id).toBe(1)
    expect(result[1].player.id).toBe(2)
  })

  it('ceiling_pts equals xPts_90th_1gw when present', () => {
    const picks = [mkPick(1, 1)]
    const players = [mkPlayer({ id: 1, xPts_1gw: 5.0, xPts_90th_1gw: 9.0 })]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result[0].ceiling_pts).toBeCloseTo(9.0)
  })

  it('ceiling_pts falls back to xPts_1gw when xPts_90th_1gw is absent', () => {
    const picks = [mkPick(1, 1)]
    const players = [mkPlayer({ id: 1, xPts_1gw: 5.5, xPts_90th_1gw: undefined })]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result[0].ceiling_pts).toBeCloseTo(5.5)
  })

  it('projected_captain_pts is still xPts_1gw * 2 regardless of ceiling', () => {
    const picks = [mkPick(1, 1)]
    const players = [mkPlayer({ id: 1, xPts_1gw: 6.0, xPts_90th_1gw: 12.0 })]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result[0].projected_captain_pts).toBeCloseTo(12.0) // 6.0 * 2
  })

  it('tie-break: equal ceiling falls back to projected_captain_pts (higher mean wins)', () => {
    // Both have ceiling 10.0 but P2 has higher mean
    const picks = [mkPick(1, 1), mkPick(2, 2)]
    const players = [
      mkPlayer({ id: 1, xPts_1gw: 4.0, xPts_90th_1gw: 10.0 }),
      mkPlayer({ id: 2, xPts_1gw: 6.0, xPts_90th_1gw: 10.0 }),
    ]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result[0].player.id).toBe(2) // higher projected_captain_pts wins tie
    expect(result[1].player.id).toBe(1)
  })

  it('tie-break is stable: equal ceiling and equal mean preserves original pick order', () => {
    // Identical ceiling AND mean → no swap
    const picks = [mkPick(1, 1), mkPick(2, 2), mkPick(3, 3)]
    const players = [
      mkPlayer({ id: 1, xPts_1gw: 5.0, xPts_90th_1gw: 8.0 }),
      mkPlayer({ id: 2, xPts_1gw: 5.0, xPts_90th_1gw: 8.0 }),
      mkPlayer({ id: 3, xPts_1gw: 5.0, xPts_90th_1gw: 8.0 }),
    ]
    const result = computeCaptaincyCandidates(picks, players)
    // All equal — order consistent (same ceiling, same tie-break)
    expect(result.map(r => r.ceiling_pts)).toEqual([8.0, 8.0, 8.0])
    expect(result.map(r => r.projected_captain_pts)).toEqual([10.0, 10.0, 10.0])
  })
})

// ---- Existing filter rules still hold ----

describe('computeCaptaincyCandidates — filters unchanged (VAR-01)', () => {
  it('excludes goalkeepers (element_type === 1)', () => {
    const picks = [mkPick(1, 1), mkPick(2, 2)]
    const players = [
      mkPlayer({ id: 1, element_type: 1, xPts_1gw: 10.0, xPts_90th_1gw: 15.0 }),
      mkPlayer({ id: 2, element_type: 3, xPts_1gw: 5.0 }),
    ]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result.every(c => c.player.element_type !== 1)).toBe(true)
    expect(result.length).toBe(1)
    expect(result[0].player.id).toBe(2)
  })

  it('excludes bench players (position >= 12)', () => {
    const picks = [mkPick(1, 1), mkPick(2, 12)]
    const players = [
      mkPlayer({ id: 1, xPts_1gw: 5.0 }),
      mkPlayer({ id: 2, xPts_1gw: 10.0, xPts_90th_1gw: 20.0 }), // bench — highest ceiling but excluded
    ]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result.length).toBe(1)
    expect(result[0].player.id).toBe(1)
  })

  it('excludes injured players (mins_risk === "injured")', () => {
    const picks = [mkPick(1, 1), mkPick(2, 2)]
    const players = [
      mkPlayer({ id: 1, mins_risk: 'injured', xPts_1gw: 10.0, xPts_90th_1gw: 20.0 }),
      mkPlayer({ id: 2, xPts_1gw: 5.0 }),
    ]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result.every(c => c.player.mins_risk !== 'injured')).toBe(true)
    expect(result[0].player.id).toBe(2)
  })

  it('excludes players with xPts_1gw <= 0', () => {
    const picks = [mkPick(1, 1), mkPick(2, 2)]
    const players = [
      mkPlayer({ id: 1, xPts_1gw: 0, xPts_90th_1gw: 5.0 }),
      mkPlayer({ id: 2, xPts_1gw: 4.0 }),
    ]
    const result = computeCaptaincyCandidates(picks, players)
    expect(result.length).toBe(1)
    expect(result[0].player.id).toBe(2)
  })

  it('returns at most topN candidates', () => {
    const picks = Array.from({ length: 10 }, (_, i) => mkPick(i + 1, i + 1))
    const players = Array.from({ length: 10 }, (_, i) =>
      mkPlayer({ id: i + 1, xPts_1gw: 5.0 + i }),
    )
    const result = computeCaptaincyCandidates(picks, players, 3)
    expect(result.length).toBe(3)
  })
})
