import { describe, it, expect } from 'vitest'
import { computeAllGemScores } from '@/lib/gem-score'
import type { MergedPlayer } from '@/lib/types'

function makeMergedPlayer(overrides: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1, web_name: 'Test', team: 1, team_short_name: 'TST',
    element_type: 3, now_cost: 70, selected_by_percent: '10.0',
    form: '5.0', status: 'a', minutes: 900, starts: 10, total_points: 50,
    goals_scored: 5, assists: 3,
    expected_goals: 0, expected_assists: 0,
    pts_last3gw: 15, pts_last5gw: 25, pts_gw_count: 30,
    defensive_contribution: null, clearances_blocks_interceptions: null,
    direct_freekicks_order: null, penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '', direct_freekicks_text: '', corners_and_indirect_freekicks_text: '',
    news: '',
    cost_change_event: 0, cost_change_start: 0,
    understat_id: 100, xg_per90: 0.3, xa_per90: 0.15,
    minutes_per90: 85, form_pts_per90: 5.0,
    fixtures: [
      { opponent_team: 'ARS', is_home: true, event_id: 10, difficulty_score: 0.6, difficulty_tier: 'medium' },
      { opponent_team: 'BUR', is_home: false, event_id: 11, difficulty_score: 0.2, difficulty_tier: 'easy' },
    ],
    proj_pts_1gw: 4.5,
    proj_pts_3gw: 12.0,
    proj_pts_5gw: 18.5,
    xmins: 78.0,
    start_prob: 0.87,
    mins_risk: 'nailed',
    ...overrides,
  }
}

describe('computeAllGemScores', () => {
  it('returns ScoredPlayer with gem_score between 0.0 and 1.0', () => {
    const player = makeMergedPlayer()
    const [scored] = computeAllGemScores([player])
    expect(scored.gem_score).toBeGreaterThanOrEqual(0.0)
    expect(scored.gem_score).toBeLessThanOrEqual(1.0)
  })

  it('single player normalisation returns 0.5 for all dimension scores', () => {
    const player = makeMergedPlayer()
    const [scored] = computeAllGemScores([player])
    // When min === max for all dimensions, normalise returns 0.5
    expect(scored.gem_score).toBeCloseTo(0.5)
    expect(scored.fdr_score).toBeCloseTo(0.5)
    expect(scored.form_score).toBeCloseTo(0.5)
    expect(scored.xg_score).toBeCloseTo(0.5)
    expect(scored.xa_score).toBeCloseTo(0.5)
    expect(scored.ownership_score).toBeCloseTo(0.5)
    expect(scored.minutes_score).toBeCloseTo(0.5)
    expect(scored.set_piece_score).toBeCloseTo(0.5)
  })

  it('null xg_per90 produces null xg_score', () => {
    const player = makeMergedPlayer({ xg_per90: null })
    const [scored] = computeAllGemScores([player])
    expect(scored.xg_score).toBeNull()
  })

  it('null xa_per90 produces null xa_score', () => {
    const player = makeMergedPlayer({ xa_per90: null })
    const [scored] = computeAllGemScores([player])
    expect(scored.xa_score).toBeNull()
  })

  it('null xg AND xa produces gem_score from 5 dimensions', () => {
    const player = makeMergedPlayer({ xg_per90: null, xa_per90: null })
    const [scored] = computeAllGemScores([player])
    expect(scored.xg_score).toBeNull()
    expect(scored.xa_score).toBeNull()
    // gem_score still valid (from 5 dims): 0.5 for single player
    expect(scored.gem_score).toBeCloseTo(0.5)
    expect(scored.gem_score).toBeGreaterThanOrEqual(0.0)
    expect(scored.gem_score).toBeLessThanOrEqual(1.0)
  })

  it('higher form_pts_per90 gives higher form_score', () => {
    const lowForm = makeMergedPlayer({ id: 1, form_pts_per90: 1.0 })
    const highForm = makeMergedPlayer({ id: 2, form_pts_per90: 8.0 })
    const scored = computeAllGemScores([lowForm, highForm])
    const lowScored = scored.find(p => p.id === 1)!
    const highScored = scored.find(p => p.id === 2)!
    expect(highScored.form_score).toBeGreaterThan(lowScored.form_score)
  })

  it('easy fixtures (low difficulty_score) give high fdr_score', () => {
    const easyFixtures = makeMergedPlayer({
      id: 1,
      fixtures: [
        { opponent_team: 'BUR', is_home: true, event_id: 10, difficulty_score: 0.1, difficulty_tier: 'easy' },
      ],
    })
    const hardFixtures = makeMergedPlayer({
      id: 2,
      fixtures: [
        { opponent_team: 'MCI', is_home: false, event_id: 10, difficulty_score: 0.9, difficulty_tier: 'hard' },
      ],
    })
    const scored = computeAllGemScores([easyFixtures, hardFixtures])
    const easy = scored.find(p => p.id === 1)!
    const hard = scored.find(p => p.id === 2)!
    expect(easy.fdr_score).toBeGreaterThan(hard.fdr_score)
  })

  it('low ownership gives higher ownership_score', () => {
    const lowOwn = makeMergedPlayer({ id: 1, selected_by_percent: '5.0' })
    const highOwn = makeMergedPlayer({ id: 2, selected_by_percent: '80.0' })
    const scored = computeAllGemScores([lowOwn, highOwn])
    const low = scored.find(p => p.id === 1)!
    const high = scored.find(p => p.id === 2)!
    expect(low.ownership_score).toBeGreaterThan(high.ownership_score)
  })

  it('penalty taker scores higher set_piece_score than non-taker', () => {
    const penaltyTaker = makeMergedPlayer({ id: 1, penalties_order: 1 })
    const nonTaker = makeMergedPlayer({ id: 2, penalties_order: null })
    const scored = computeAllGemScores([penaltyTaker, nonTaker])
    const taker = scored.find(p => p.id === 1)!
    const none = scored.find(p => p.id === 2)!
    expect(taker.set_piece_score).toBeGreaterThan(none.set_piece_score)
  })

  it('empty fixtures array uses 0.5 neutral for FDR', () => {
    const player = makeMergedPlayer({ fixtures: [] })
    const [scored] = computeAllGemScores([player])
    // Single player with empty fixtures: fdr raw = 1.0 - 0.5 = 0.5, normalised to 0.5
    expect(scored.fdr_score).toBeCloseTo(0.5)
  })

  it('gem_score is between 0.0 and 1.0 for all players in a multi-player set', () => {
    const players = [
      makeMergedPlayer({ id: 1, form_pts_per90: 1.0, selected_by_percent: '50.0', xg_per90: 0.1 }),
      makeMergedPlayer({ id: 2, form_pts_per90: 5.0, selected_by_percent: '10.0', xg_per90: null }),
      makeMergedPlayer({ id: 3, form_pts_per90: 9.0, selected_by_percent: '2.0', xg_per90: 0.8, penalties_order: 1 }),
      makeMergedPlayer({ id: 4, form_pts_per90: 0.0, selected_by_percent: '80.0', xa_per90: null }),
    ]
    const scored = computeAllGemScores(players)
    for (const s of scored) {
      expect(s.gem_score).toBeGreaterThanOrEqual(0.0)
      expect(s.gem_score).toBeLessThanOrEqual(1.0)
    }
  })
})
