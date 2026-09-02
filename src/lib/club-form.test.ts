// @vitest-environment node
// Phase 111 FIX-01: unit tests for computeClubForm current_gw_played builder.
import { describe, it, expect } from 'vitest'
import { computeClubForm, windowEaseStats } from './club-form'
import type { ClubFormFixture } from '@/lib/types'

// --- Planner (2026-08-29): windowEaseStats — per-GW-slot ease over a window ---

function wf(gw: number, att: number): ClubFormFixture {
  return {
    opponent_team: 'OPP', is_home: true, event_id: gw,
    difficulty_score: att, difficulty_tier: 'medium',
    attacking_difficulty: att, defensive_difficulty: att,
  } as ClubFormFixture
}

describe('windowEaseStats', () => {
  it('averages ease over window SLOTS, so blank GWs drag the score down', () => {
    // one fixture at ease 0.8 across a 4-slot window → 0.2, not 0.8
    const { ease, count } = windowEaseStats([wf(4, 0.2)], new Set([4, 5, 6, 7]), 'attacking_difficulty')
    expect(count).toBe(1)
    expect(ease).toBeCloseTo(0.2)
  })

  it('DGWs boost the score above a single fixture ease', () => {
    const { ease, count } = windowEaseStats(
      [wf(4, 0.4), wf(4, 0.4)], new Set([4]), 'attacking_difficulty')
    expect(count).toBe(2)
    expect(ease).toBeCloseTo(1.2)   // two 0.6-ease games in one slot
  })

  it('ignores fixtures outside the window and supports the DEF key', () => {
    const { ease, count } = windowEaseStats(
      [wf(4, 0.5), wf(99, 0.0)], new Set([4, 5]), 'defensive_difficulty')
    expect(count).toBe(1)
    expect(ease).toBeCloseTo(0.25)
  })

  it('returns null ease / 0 count when no fixtures fall inside the window', () => {
    expect(windowEaseStats([wf(99, 0.5)], new Set([4]), 'attacking_difficulty'))
      .toEqual({ ease: null, count: 0 })
    expect(windowEaseStats([], new Set([4]), 'attacking_difficulty'))
      .toEqual({ ease: null, count: 0 })
  })
})

// ---------------------------------------------------------------------------
// Test data factories (mirror internal shapes from club-form.ts)
// ---------------------------------------------------------------------------

interface RawFixtureOpts {
  teamH: number
  teamA: number
  hDiff?: number
  aDiff?: number
  event: number
  finished: boolean
  hScore?: number | null
  aScore?: number | null
}

function rawFixture(opts: RawFixtureOpts) {
  return {
    team_h: opts.teamH,
    team_a: opts.teamA,
    team_h_score: opts.hScore ?? null,
    team_a_score: opts.aScore ?? null,
    team_h_difficulty: opts.hDiff ?? 2,
    team_a_difficulty: opts.aDiff ?? 4,
    event: opts.event,
    finished: opts.finished,
  }
}

function rawTeam(id: number, name: string, shortName: string) {
  return { id, name, short_name: shortName }
}

function rawEvent(id: number, isCurrent: boolean, finished: boolean) {
  return { id, is_current: isCurrent, finished }
}

// ---------------------------------------------------------------------------
// Teams used across tests
// ---------------------------------------------------------------------------
const teamA = rawTeam(1, 'Team A', 'TMA')
const teamB = rawTeam(2, 'Team B', 'TMB')
const teamC = rawTeam(3, 'Team C', 'TMC')

describe('computeClubForm — current_gw_played (Phase 111 FIX-01)', () => {
  it('populates current_gw_played with finished fixtures from the active GW only', () => {
    // 3 events: gw34/35/36; is_current on event 35
    const events = [
      rawEvent(34, false, true),
      rawEvent(35, true, false),
      rawEvent(36, false, false),
    ]
    // 4 fixtures:
    //   A vs B finished gw34 (historical)
    //   A vs C finished gw35 (current, should appear)
    //   B vs C upcoming gw35 (not finished)
    //   A vs B upcoming gw36
    const fixtures = [
      rawFixture({ teamH: 1, teamA: 2, event: 34, finished: true, hScore: 1, aScore: 0 }),
      rawFixture({ teamH: 1, teamA: 3, event: 35, finished: true, hScore: 2, aScore: 1, hDiff: 2, aDiff: 4 }),
      rawFixture({ teamH: 2, teamA: 3, event: 35, finished: false }),
      rawFixture({ teamH: 1, teamA: 2, event: 36, finished: false }),
    ]
    const result = computeClubForm({ teams: [teamA, teamB, teamC], events }, fixtures)

    const tA = result.find(r => r.team_id === 1)!
    const tB = result.find(r => r.team_id === 2)!
    const tC = result.find(r => r.team_id === 3)!

    // Team A played GW35 (home vs C) — should have 1 entry
    expect(tA.current_gw_played).toHaveLength(1)
    expect(tA.current_gw_played[0].event_id).toBe(35)
    expect(tA.current_gw_played[0].opponent_team).toBe('TMC')

    // Team C played GW35 (away at A) — should have 1 entry
    expect(tC.current_gw_played).toHaveLength(1)
    expect(tC.current_gw_played[0].event_id).toBe(35)
    expect(tC.current_gw_played[0].opponent_team).toBe('TMA')

    // Team B's only finished fixture was GW34 (historical) — should be []
    expect(tB.current_gw_played).toHaveLength(0)
  })

  it('leaves current_gw_played empty when no fixtures are finished in current GW', () => {
    const events = [
      rawEvent(34, false, true),
      rawEvent(35, true, false),
      rawEvent(36, false, false),
    ]
    // Only upcoming fixtures — nothing finished in current GW
    const fixtures = [
      rawFixture({ teamH: 1, teamA: 2, event: 35, finished: false }),
      rawFixture({ teamH: 2, teamA: 3, event: 36, finished: false }),
    ]
    const result = computeClubForm({ teams: [teamA, teamB, teamC], events }, fixtures)

    for (const team of result) {
      expect(team.current_gw_played).toHaveLength(0)
    }
  })

  it('does NOT include historical finished fixtures in current_gw_played', () => {
    const events = [
      rawEvent(34, false, true),
      rawEvent(35, true, false),
    ]
    // Only a historical finished fixture at GW34
    const fixtures = [
      rawFixture({ teamH: 1, teamA: 2, event: 34, finished: true, hScore: 1, aScore: 0 }),
    ]
    const result = computeClubForm({ teams: [teamA, teamB, teamC], events }, fixtures)

    for (const team of result) {
      expect(team.current_gw_played).toHaveLength(0)
    }
  })

  it('populates current_gw_played for both home and away teams of a finished fixture', () => {
    const events = [rawEvent(35, true, false)]
    const fixtures = [
      // A (home) vs B (away) at GW35
      rawFixture({ teamH: 1, teamA: 2, event: 35, finished: true, hScore: 1, aScore: 0, hDiff: 2, aDiff: 4 }),
    ]
    const result = computeClubForm({ teams: [teamA, teamB, teamC], events }, fixtures)

    const tA = result.find(r => r.team_id === 1)!
    const tB = result.find(r => r.team_id === 2)!

    // Team A is home: is_home = true, opponent = B
    expect(tA.current_gw_played).toHaveLength(1)
    expect(tA.current_gw_played[0].is_home).toBe(true)
    expect(tA.current_gw_played[0].opponent_team).toBe(teamB.short_name)

    // Team B is away: is_home = false, opponent = A
    expect(tB.current_gw_played).toHaveLength(1)
    expect(tB.current_gw_played[0].is_home).toBe(false)
    expect(tB.current_gw_played[0].opponent_team).toBe(teamA.short_name)

    // Verify difficulty fields are numeric on both entries
    expect(typeof tA.current_gw_played[0].difficulty_score).toBe('number')
    expect(typeof tA.current_gw_played[0].attacking_difficulty).toBe('number')
    expect(typeof tA.current_gw_played[0].defensive_difficulty).toBe('number')
    expect(typeof tB.current_gw_played[0].difficulty_score).toBe('number')
    expect(typeof tB.current_gw_played[0].attacking_difficulty).toBe('number')
    expect(typeof tB.current_gw_played[0].defensive_difficulty).toBe('number')
  })

  it('current_gw_played is [] when events array is not provided (backward compat)', () => {
    // Call computeClubForm with no events key — backward compatibility
    const fixtures = [
      rawFixture({ teamH: 1, teamA: 2, event: 35, finished: true, hScore: 1, aScore: 0 }),
    ]
    // No events property passed — raw bootstrap without events
    const result = computeClubForm({ teams: [teamA, teamB, teamC] }, fixtures)

    for (const team of result) {
      expect(team.current_gw_played).toHaveLength(0)
    }
  })

  it('falls back to last finished event when no event has is_current', () => {
    // events = none have is_current; GW35 is finished, GW36 is not
    const events = [
      rawEvent(35, false, true),
      rawEvent(36, false, false),
    ]
    // Fixture finished at event 35 (fallback current GW)
    const fixtures = [
      rawFixture({ teamH: 1, teamA: 2, event: 35, finished: true, hScore: 1, aScore: 0, hDiff: 2, aDiff: 4 }),
    ]
    const result = computeClubForm({ teams: [teamA, teamB, teamC], events }, fixtures)

    const tA = result.find(r => r.team_id === 1)!
    const tB = result.find(r => r.team_id === 2)!

    // Both teams should have the GW35 fixture in current_gw_played (event_id === 35)
    expect(tA.current_gw_played).toHaveLength(1)
    expect(tA.current_gw_played[0].event_id).toBe(35)

    expect(tB.current_gw_played).toHaveLength(1)
    expect(tB.current_gw_played[0].event_id).toBe(35)

    // Difficulty fields should be numeric
    expect(typeof tA.current_gw_played[0].difficulty_score).toBe('number')
    expect(typeof tB.current_gw_played[0].difficulty_score).toBe('number')
  })

  it('CR-02: fallback picks max finished event id regardless of array order', () => {
    // events in DESCENDING id order — both finished, neither is_current
    const events = [rawEvent(36, false, true), rawEvent(35, false, true)]
    // Fixture finished at event 36 — should be picked as current GW when fallback sort works correctly
    const fixtures = [
      rawFixture({ teamH: 1, teamA: 2, event: 36, finished: true, hScore: 1, aScore: 0, hDiff: 2, aDiff: 4 }),
    ]
    const result = computeClubForm({ teams: [teamA, teamB, teamC], events }, fixtures)

    const tA = result.find(r => r.team_id === 1)!
    // Without .sort((a, b) => a.id - b.id) the fallback would pick event 35 (last element of
    // the unsorted descending array). With the sort, it correctly picks event 36 (max id).
    expect(tA.current_gw_played).toHaveLength(1)
    expect(tA.current_gw_played[0].event_id).toBe(36)
  })
})

// ---------------------------------------------------------------------------
// SWING-02 (2026-09-02): the Fixture Swing Detector was empty all season.
// past_ease_3gw required exactly three finished fixtures, so two gameweeks in
// every team's swing was null, every row was filtered out, and the panel
// rendered nothing — while Newcastle's fixtures were plainly improving.
// ---------------------------------------------------------------------------
describe('fixture swing baseline (SWING-02)', () => {
  function inputs(finishedCount: number) {
    const teams = [{ id: 1, name: 'Newcastle', short_name: 'NEW' },
                   { id: 2, name: 'Leeds', short_name: 'LEE' }]
    const fixtures: Parameters<typeof computeClubForm>[1] = []
    for (let gw = 1; gw <= finishedCount; gw++) {
      fixtures.push({
        event: gw, team_h: 1, team_a: 2, finished: true,
        team_h_score: 1, team_a_score: 1,
        team_h_difficulty: 5, team_a_difficulty: 2,   // NEW hard, LEE easy so far
      })
    }
    for (let gw = finishedCount + 1; gw <= finishedCount + 5; gw++) {
      fixtures.push({
        event: gw, team_h: 1, team_a: 2, finished: false,
        team_h_score: null, team_a_score: null,
        team_h_difficulty: 2, team_a_difficulty: 5,   // now NEW easy, LEE hard
      })
    }
    return { bootstrap: { teams, events: [] }, fixtures }
  }

  it('produces a swing after two finished games, not three', () => {
    const { bootstrap, fixtures } = inputs(2)
    const [newcastle] = computeClubForm(bootstrap, fixtures)
    expect(newcastle.past_ease_3gw).not.toBeNull()
    expect(newcastle.swing_3gw).not.toBeNull()
  })

  it('signs the swing correctly: improving positive, worsening negative', () => {
    const { bootstrap, fixtures } = inputs(2)
    const form = computeClubForm(bootstrap, fixtures)
    const newcastle = form.find(t => t.team_short_name === 'NEW')!
    const leeds = form.find(t => t.team_short_name === 'LEE')!
    expect(newcastle.swing_3gw!).toBeGreaterThan(0)   // hard -> easy
    expect(leeds.swing_3gw!).toBeLessThan(0)          // easy -> hard
  })

  it('still withholds a swing with only one game played', () => {
    const { bootstrap, fixtures } = inputs(1)
    const [team] = computeClubForm(bootstrap, fixtures)
    expect(team.past_ease_3gw).toBeNull()
    expect(team.swing_3gw).toBeNull()
  })
})
