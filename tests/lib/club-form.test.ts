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
    { team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 2, team_a_score: 1, event: 1, finished: true },
    { team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 2, finished: true },
    { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 3, team_a_score: 0, event: 3, finished: true },
    { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 2, event: 4, finished: true },
    { team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 1, event: 5, finished: true },
    { team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 2, event: 6, finished: true },
    // Upcoming fixtures
    { team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: null, team_a_score: null, event: 30, finished: false },
    { team_h: 3, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: null, team_a_score: null, event: 31, finished: false },
    { team_h: 1, team_a: 3, team_h_difficulty: 2, team_a_difficulty: 3, team_h_score: null, team_a_score: null, event: 32, finished: false },
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
      { team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 2, team_a_score: 0, event: 7, finished: true },
      { team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 2, event: 7, finished: true },
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 8, finished: true },
      { team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 3, event: 9, finished: true },
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
      { team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 1, finished: true },
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 1, event: 2, finished: true },
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

  it('FDR++: emits attacking_difficulty and defensive_difficulty per upcoming fixture', () => {
    const result = computeClubForm(bootstrap, makeFixtures())
    const ars = result.find(r => r.team_id === 1)!
    expect(ars.upcoming_fixtures.length).toBeGreaterThan(0)
    for (const f of ars.upcoming_fixtures) {
      expect(typeof f.attacking_difficulty).toBe('number')
      expect(typeof f.defensive_difficulty).toBe('number')
      expect(f.attacking_difficulty).toBeGreaterThanOrEqual(0)
      expect(f.attacking_difficulty).toBeLessThanOrEqual(1)
      expect(f.defensive_difficulty).toBeGreaterThanOrEqual(0)
      expect(f.defensive_difficulty).toBeLessThanOrEqual(1)
    }
  })

  it('FDR++: attacking_difficulty equals difficulty_score (DATA-01 D-01)', () => {
    const result = computeClubForm(bootstrap, makeFixtures())
    for (const team of result) {
      for (const f of team.upcoming_fixtures) {
        expect(f.attacking_difficulty).toBe(f.difficulty_score)
      }
    }
  })

  it('FDR++: ease arrays present for 1/3/5 GW windows on each ClubForm row', () => {
    const result = computeClubForm(bootstrap, makeFixtures())
    for (const team of result) {
      for (const k of [
        'attacking_ease_1gw', 'attacking_ease_3gw', 'attacking_ease_5gw',
        'defensive_ease_1gw', 'defensive_ease_3gw', 'defensive_ease_5gw',
      ] as const) {
        const v = team[k]
        expect(v === null || (typeof v === 'number' && v >= 0 && v <= 1)).toBe(true)
      }
    }
  })

  it('FDR++: BGW — team with zero upcoming fixtures returns null ease for all windows', () => {
    // bootstrap teams 1,2,3 — but we only schedule upcoming fixtures involving 1 and 2.
    // Team 3 (BUR) has zero upcoming → all six ease fields must be null.
    const fixtures = [
      { team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 1, finished: true },
      { team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 2, finished: true },
      { team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: null, team_a_score: null, event: 30, finished: false },
    ]
    const result = computeClubForm(bootstrap, fixtures)
    const bur = result.find(r => r.team_id === 3)!
    expect(bur.attacking_ease_1gw).toBeNull()
    expect(bur.attacking_ease_3gw).toBeNull()
    expect(bur.attacking_ease_5gw).toBeNull()
    expect(bur.defensive_ease_1gw).toBeNull()
    expect(bur.defensive_ease_3gw).toBeNull()
    expect(bur.defensive_ease_5gw).toBeNull()
  })

  it('FDR++: defensive_difficulty uses 3-game goals-scored window (not 6) and is NOT inverted', () => {
    // Construct fixtures where team 1 (ARS) scored:
    //   game 1: 0 goals, game 2: 0, game 3: 0  (last 3 → mean 0)
    //   game 4: 5 goals, game 5: 5, game 6: 5  (last 3 → mean 5 — they're the hot streak)
    // Team 1's defensive_difficulty (from their 3-game goals-scored avg) should be HIGH
    // because the LAST 3 are the high-scoring ones.
    // Team 2 (CHE) is the low-scoring team.
    // We then schedule an upcoming fixture team_2 vs team_1 — CHE's upcoming fixture
    // against ARS should have high defensive_difficulty (ARS scores a lot lately).
    const fixtures = [
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 1, finished: true }, // ARS 0
      { team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 2, finished: true }, // ARS 0
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 3, finished: true }, // ARS 0
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 5, team_a_score: 0, event: 4, finished: true }, // ARS 5
      { team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 5, event: 5, finished: true }, // ARS 5
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 5, team_a_score: 0, event: 6, finished: true }, // ARS 5
      // Make CHE consistently 0-scoring for contrast
      { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 1, finished: true },
      { team_h: 3, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 2, finished: true },
      { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 3, finished: true },
      { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 4, finished: true },
      { team_h: 3, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 5, finished: true },
      { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 6, finished: true },
      // Upcoming: CHE vs ARS at event 30
      { team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: null, team_a_score: null, event: 30, finished: false },
    ]
    const result = computeClubForm(bootstrap, fixtures)
    const che = result.find(r => r.team_id === 2)!
    const cheVsArs = che.upcoming_fixtures.find(f => f.opponent_team === 'ARS')!
    // ARS scored 5+5+5 in the last 3 games → highest goals-scored team → CHE's defensive_difficulty against them is HIGH
    expect(cheVsArs.defensive_difficulty).toBeGreaterThan(0.5)
    // If 6-game window were used, ARS's avg would be (0+0+0+5+5+5)/6=2.5 — but we want only the last 3 (=5).
    // To make this test sensitive to the window, we also assert defensive_difficulty equals 1.0 (highest).
    // ARS scored 5/game last 3, max in dataset; CHE scored 0/game last 3, min. So ARS xgs=5 = max, → defensive_difficulty = 1.0
    expect(cheVsArs.defensive_difficulty).toBe(1)
  })

  it('FDR++: high-scoring opponent yields LOW defensive_ease (hard to keep CS)', () => {
    // Same fixtures as previous test but assert defensive_ease (1 - difficulty)
    const fixtures = [
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 5, team_a_score: 0, event: 4, finished: true },
      { team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 5, event: 5, finished: true },
      { team_h: 1, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 5, team_a_score: 0, event: 6, finished: true },
      { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 4, finished: true },
      { team_h: 3, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 1, team_a_score: 0, event: 5, finished: true },
      { team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: 0, team_a_score: 0, event: 6, finished: true },
      { team_h: 2, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, team_h_score: null, team_a_score: null, event: 30, finished: false },
    ]
    const result = computeClubForm(bootstrap, fixtures)
    const che = result.find(r => r.team_id === 2)!
    // CHE has 1 upcoming fixture (vs the highest-scoring ARS) → defensive_ease_1gw should be LOW
    expect(che.defensive_ease_1gw).not.toBeNull()
    expect(che.defensive_ease_1gw!).toBeLessThan(0.5)
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
