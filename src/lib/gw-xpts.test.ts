// @vitest-environment node
// Phase 101 (GWT-01): computeGwXpts unit tests.
import { describe, it, expect } from 'vitest'
import { computeGwXpts, computeHoldLabel } from './gw-xpts'
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

describe('computeHoldLabel', () => {
  // HL-01: BGW — no fixture at targetGw → null (no chip)
  it('HL-01: returns null when player has no fixture at targetGw (BGW)', () => {
    const p = makePlayer({ id: 10, element_type: 3, fixtures: [] })
    expect(computeHoldLabel(p, 33)).toBeNull()
  })

  // HL-02: sustained hold — identical easy fixtures across GW33/34/35 → avg = gwScore → 100% >= 70%
  it('HL-02: returns "GW33+" when avgAfter >= 70% of gwScore (identical fixtures)', () => {
    const p = makePlayer({
      id: 11, element_type: 3,
      fixtures: [makeFixture(33, 0.3), makeFixture(34, 0.3), makeFixture(35, 0.3)],
    })
    expect(computeHoldLabel(p, 33)).toBe('GW33+')
  })

  // HL-03: spike with residual — GK with great GW33 fixture (low def_diff) but hard GW34/35.
  // Math: csProb(0.1, 80)=0.37 → gwScore≈4.29; csProb(0.9, 80)=0.13 → afterScore≈2.85.
  // avgAfter (2.85) < 0.7 × gwScore (3.00), but avgAfter > 0 → "GW33 mainly".
  it('HL-03: returns "GW33 mainly" when 0 < avgAfter < 70% of gwScore', () => {
    const p = makePlayer({
      id: 12, element_type: 1,   // GK: CS-dominated scoring
      xg_per90: 0, xa_per90: 0,
      fixtures: [
        makeFixture(33, 0.1),    // very easy: high CS prob for GW33
        makeFixture(34, 0.9),    // very hard: low CS prob for GW34
        makeFixture(35, 0.9),    // very hard: low CS prob for GW35
      ],
    })
    expect(computeHoldLabel(p, 33)).toBe('GW33 mainly')
  })

  // HL-04: pure rental — fixture only at targetGw, none at +1 or +2 → avg=0
  it('HL-04: returns "GW33 only" when avgAfter === 0 (no post-target fixtures)', () => {
    const p = makePlayer({ id: 13, element_type: 3, fixtures: [makeFixture(33)] })
    expect(computeHoldLabel(p, 33)).toBe('GW33 only')
  })

  // HL-05: end of season — GW38 is final GW, no GW39/40
  it('HL-05: returns "GW38 only" at end of season (no fixtures after GW38)', () => {
    const p = makePlayer({ id: 14, element_type: 3, fixtures: [makeFixture(38)] })
    expect(computeHoldLabel(p, 38)).toBe('GW38 only')
  })

  // HL-06: DGW at targetGw, no fixtures afterwards → high gwScore but avg=0 → "GW33 only"
  it('HL-06: returns "GW33 only" for DGW at targetGw with no post-target fixtures', () => {
    const p = makePlayer({
      id: 15, element_type: 3,
      fixtures: [makeFixture(33, 0.3), makeFixture(33, 0.3)],  // two GW33 fixtures, none after
    })
    expect(computeHoldLabel(p, 33)).toBe('GW33 only')
  })

  // HL-07: targetGw number appears in the label string
  it('HL-07: label string includes targetGw number ("GW36+")', () => {
    const p = makePlayer({
      id: 16, element_type: 3,
      fixtures: [makeFixture(36, 0.3), makeFixture(37, 0.3), makeFixture(38, 0.3)],
    })
    expect(computeHoldLabel(p, 36)).toBe('GW36+')
  })

  // HL-08: start_prob=0 guard — gwScore=0 even with fixtures present → null
  it('HL-08: returns null when start_prob=0 (gwScore will be 0)', () => {
    const p = makePlayer({
      id: 17, element_type: 3,
      start_prob: 0,
      fixtures: [makeFixture(33), makeFixture(34), makeFixture(35)],
    })
    expect(computeHoldLabel(p, 33)).toBeNull()
  })
})
