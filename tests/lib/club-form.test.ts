import { describe, it, expect } from 'vitest'
import { computeClubForm } from '@/lib/club-form'

const bootstrap = {
  teams: [
    { id: 1, name: 'Arsenal', short_name: 'ARS' },
    { id: 2, name: 'Chelsea', short_name: 'CHE' },
    { id: 3, name: 'Burnley', short_name: 'BUR' },
  ],
}

function makeFixtures() {
  return [
    // 6 finished fixtures between ARS and CHE
    { team_h: 1, team_a: 2, team_h_score: 2, team_a_score: 1, event: 1, finished: true },
    { team_h: 2, team_a: 1, team_h_score: 0, team_a_score: 0, event: 2, finished: true },
    { team_h: 1, team_a: 3, team_h_score: 3, team_a_score: 0, event: 3, finished: true },
    { team_h: 2, team_a: 3, team_h_score: 1, team_a_score: 2, event: 4, finished: true },
    { team_h: 3, team_a: 1, team_h_score: 1, team_a_score: 1, event: 5, finished: true },
    { team_h: 1, team_a: 2, team_h_score: 1, team_a_score: 2, event: 6, finished: true },
    // Upcoming fixtures
    { team_h: 2, team_a: 1, team_h_score: null, team_a_score: null, event: 30, finished: false },
    { team_h: 3, team_a: 2, team_h_score: null, team_a_score: null, event: 31, finished: false },
    { team_h: 1, team_a: 3, team_h_score: null, team_a_score: null, event: 32, finished: false },
  ]
}

describe('computeClubForm', () => {
  it('returns correct W/D/L/GS/GC for a rolling window per team', () => {
    const fixtures = makeFixtures()
    const result = computeClubForm(bootstrap, fixtures)
    const ars = result.find(r => r.team_id === 1)!

    // ARS last 5 finished: events 2,3,4(not involved),5,6 -> events 1,2,3,5,6
    // event 1: ARS home vs CHE -> 2-1 W
    // event 2: ARS away at CHE -> 0-0 D
    // event 3: ARS home vs BUR -> 3-0 W
    // event 5: ARS away at BUR -> 1-1 D
    // event 6: ARS home vs CHE -> 1-2 L
    expect(ars.wins).toBe(2)
    expect(ars.draws).toBe(2)
    expect(ars.losses).toBe(1)
    expect(ars.goals_scored).toBe(7) // 2+0+3+1+1
    expect(ars.goals_conceded).toBe(4) // 1+0+0+1+2
  })

  it('returns correct club count matching bootstrap teams', () => {
    const result = computeClubForm(bootstrap, makeFixtures())
    expect(result.length).toBe(3)
  })

  it('each result has team_id, team_name, team_short_name', () => {
    const result = computeClubForm(bootstrap, makeFixtures())
    for (const r of result) {
      expect(r.team_id).toBeGreaterThan(0)
      expect(r.team_name).toBeTruthy()
      expect(r.team_short_name).toBeTruthy()
    }
  })

  it('DGW team with 2 fixtures in 1 GW gets individual fixture entries (not 5 GWs)', () => {
    // ARS plays twice in event 7 (DGW)
    const fixtures = [
      { team_h: 1, team_a: 2, team_h_score: 2, team_a_score: 0, event: 7, finished: true },
      { team_h: 3, team_a: 1, team_h_score: 1, team_a_score: 2, event: 7, finished: true },
      { team_h: 1, team_a: 3, team_h_score: 1, team_a_score: 0, event: 8, finished: true },
      { team_h: 2, team_a: 1, team_h_score: 0, team_a_score: 3, event: 9, finished: true },
    ]
    const result = computeClubForm(bootstrap, fixtures)
    const ars = result.find(r => r.team_id === 1)!
    // ARS has 4 individual matches (2 in event 7 + 2 more)
    // last 5 = all 4 since there are only 4
    // event 7 home vs CHE: 2-0 W, event 7 away at BUR (3-1, ARS scores 2): W
    // event 8 home vs BUR: 1-0 W, event 9 away at CHE (0-3, ARS scores 3): W
    expect(ars.wins).toBe(4)
    expect(ars.losses).toBe(0)
    expect(ars.draws).toBe(0)
  })

  it('team with fewer than 5 finished fixtures returns stats for available fixtures only', () => {
    const fixtures = [
      { team_h: 1, team_a: 2, team_h_score: 1, team_a_score: 0, event: 1, finished: true },
      { team_h: 1, team_a: 3, team_h_score: 0, team_a_score: 1, event: 2, finished: true },
    ]
    const result = computeClubForm(bootstrap, fixtures)
    const ars = result.find(r => r.team_id === 1)!
    expect(ars.wins).toBe(1)
    expect(ars.losses).toBe(1)
    expect(ars.draws).toBe(0)
  })

  it('upcoming fixtures are populated with opponent, is_home, difficulty_tier', () => {
    const result = computeClubForm(bootstrap, makeFixtures())
    const ars = result.find(r => r.team_id === 1)!
    // ARS upcoming: event 30 (away at CHE), event 32 (home vs BUR)
    expect(ars.upcoming_fixtures.length).toBeGreaterThan(0)
    for (const f of ars.upcoming_fixtures) {
      expect(f.opponent_team).toBeTruthy()
      expect(typeof f.is_home).toBe('boolean')
      expect(['easy', 'medium', 'hard']).toContain(f.difficulty_tier)
      expect(f.event_id).toBeGreaterThan(0)
    }
  })

  it('assigns difficulty tier correctly — strong team is hard, weak team is easy', () => {
    // BUR (id=3) has the worst defensive record: conceded 3+2+1=6 goals in 3 games (events 3,4,5).
    // ARS (id=1) conceded 1+0+0+1+2=4 goals in 5 games.
    // Playing BUR (high xGA / easy to score against) should be the easiest fixture.
    // Playing ARS (low xGA / hard to score against) should be harder.
    const result = computeClubForm(bootstrap, makeFixtures())
    const ars = result.find(r => r.team_id === 1)!

    // ARS's upcoming fixtures: event 30 (away at CHE), event 32 (home vs BUR)
    const vsBur = ars.upcoming_fixtures.find(f => f.opponent_team === 'BUR')
    const vsChe = ars.upcoming_fixtures.find(f => f.opponent_team === 'CHE')

    // BUR has conceded the most goals — facing them should be easy or at least not hard
    expect(vsBur).toBeDefined()
    expect(vsBur!.difficulty_tier).not.toBe('hard')

    // ARS vs CHE: CHE's defensive record is stronger than BUR's, so CHE should not be easier than BUR
    if (vsChe) {
      // If vs BUR is 'easy', vs CHE should be 'medium' or 'hard'
      if (vsBur!.difficulty_tier === 'easy') {
        expect(['medium', 'hard']).toContain(vsChe.difficulty_tier)
      }
    }

    // Verify that difficulty_score is correct direction:
    // BUR's diffScore should be lower (weak team = low difficulty score after 1-inversion)
    // The tier for BUR should not be 'hard'
    expect(vsBur!.difficulty_score).toBeLessThan(0.5)
  })
})
