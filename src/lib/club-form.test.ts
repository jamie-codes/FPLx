// @vitest-environment node
// Phase 111 FIX-01: unit tests for computeClubForm current_gw_played builder.
import { describe, it, expect } from 'vitest'
import { computeClubForm } from './club-form'

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
})
