// @vitest-environment node
// Phase 101 (GWT-01): computeGwXpts unit tests.
import { describe, it, expect } from 'vitest'
import { computeGwXpts } from './gw-xpts'
import type { MergedPlayer, FixtureEntry } from './types'

function makeFixture(event_id: number, defensive_difficulty: number | undefined = 0.5): FixtureEntry {
  return {
    opponent_team: 'ARS',
    is_home: true,
    event_id,
    difficulty_score: 0.4,
    difficulty_tier: 'medium',
    defensive_difficulty,
  } as FixtureEntry
}

type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(o: PlayerOverrides): MergedPlayer {
  return {
    web_name: `P${o.id}`,
    team: 1, team_short_name: 'T1', now_cost: 50,
    selected_by_percent: '5.0', form: '0.0', status: 'a',
    minutes: 900, starts: 10, total_points: 50,
    goals_scored: 2, assists: 1, expected_goals: 1.5, expected_assists: 1.0,
    pts_last3gw: 12, pts_last5gw: 20, pts_gw_count: 5,
    defensive_contribution: null, clearances_blocks_interceptions: null,
    direct_freekicks_order: null, penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '', direct_freekicks_text: '', corners_and_indirect_freekicks_text: '',
    news: '', cost_change_event: 0, cost_change_start: 0,
    understat_id: null, xg_per90: 0.5, xa_per90: 0.3,
    minutes_per90: 80, form_pts_per90: 5.0,
    fixtures: [], xmins: 80, start_prob: 0.9, mins_risk: 'nailed',
    xPts_1gw: 5.0, xPts_3gw: 14.0, xPts_5gw: 22.0, xPts_90th_1gw: 7.0,
    ...o,
  } as MergedPlayer
}

describe('computeGwXpts', () => {
  it('returns 0 when player has no fixture matching targetGw (BGW)', () => {
    const p = makePlayer({ id: 1, element_type: 3, fixtures: [makeFixture(30), makeFixture(31)] })
    expect(computeGwXpts(p, 33)).toBe(0)
  })

  it('returns a positive number for a single matching fixture', () => {
    const p = makePlayer({ id: 1, element_type: 3, fixtures: [makeFixture(33, 0.5)] })
    expect(computeGwXpts(p, 33)).toBeGreaterThan(0)
  })

  it('sums xPts across both DGW fixtures (not max, not average)', () => {
    const single = makePlayer({ id: 1, element_type: 3, fixtures: [makeFixture(33, 0.3)] })
    const dgw    = makePlayer({ id: 1, element_type: 3, fixtures: [makeFixture(33, 0.3), makeFixture(33, 0.7)] })
    const singleXpts = computeGwXpts(single, 33)
    const dgwXpts    = computeGwXpts(dgw, 33)
    expect(dgwXpts).toBeGreaterThan(singleXpts)
    // Sum (not average) — DGW with two fixtures must be > 1.5x single
    expect(dgwXpts).toBeGreaterThan(singleXpts * 1.5)
  })

  it('returns 0 when xmins <= 0 (guard)', () => {
    const p = makePlayer({ id: 1, element_type: 3, xmins: 0, fixtures: [makeFixture(33)] })
    expect(computeGwXpts(p, 33)).toBe(0)
  })

  it('returns 0 when start_prob <= 0 (guard)', () => {
    const p = makePlayer({ id: 1, element_type: 3, start_prob: 0, fixtures: [makeFixture(33)] })
    expect(computeGwXpts(p, 33)).toBe(0)
  })

  it('falls back to 0.5 when defensive_difficulty is undefined', () => {
    const p = makePlayer({ id: 1, element_type: 3, fixtures: [makeFixture(33, undefined)] })
    expect(() => computeGwXpts(p, 33)).not.toThrow()
    expect(computeGwXpts(p, 33)).toBeGreaterThan(0)
  })

  it('scores GK (element_type=1) higher than MID (3) for same fixture due to CS_PTS GK=6 vs MID=1', () => {
    const gk  = makePlayer({ id: 1, element_type: 1, xg_per90: 0, xa_per90: 0, fixtures: [makeFixture(33, 0.3)] })
    const mid = makePlayer({ id: 2, element_type: 3, xg_per90: 0, xa_per90: 0, fixtures: [makeFixture(33, 0.3)] })
    expect(computeGwXpts(gk, 33)).toBeGreaterThan(computeGwXpts(mid, 33))
  })

  it('falls back to 0 when xg_per90/xa_per90 are null (does not throw)', () => {
    const p = makePlayer({
      id: 1, element_type: 3,
      xg_per90: null, xa_per90: null,
      fixtures: [makeFixture(33)],
    })
    expect(() => computeGwXpts(p, 33)).not.toThrow()
    // With xg=0 and xa=0, only csPts + bonusPts + appPts contribute — still positive
    expect(computeGwXpts(p, 33)).toBeGreaterThan(0)
  })
})
