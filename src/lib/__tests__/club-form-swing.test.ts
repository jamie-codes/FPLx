import { describe, it, expect } from 'vitest'
import { computeClubForm } from '@/lib/club-form'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal RawFixture for computeClubForm.
 * Defaults: team_h_difficulty=3, team_a_difficulty=3, finished fixture (score 1-0).
 */
function makeFixture(opts: {
  team_h: number
  team_a: number
  event: number
  finished: boolean
  team_h_difficulty?: number
  team_a_difficulty?: number
  team_h_score?: number | null
  team_a_score?: number | null
}) {
  return {
    team_h: opts.team_h,
    team_a: opts.team_a,
    team_h_score: opts.team_h_score ?? (opts.finished ? 1 : null),
    team_a_score: opts.team_a_score ?? (opts.finished ? 0 : null),
    team_h_difficulty: opts.team_h_difficulty ?? 3,
    team_a_difficulty: opts.team_a_difficulty ?? 3,
    event: opts.event,
    finished: opts.finished,
  }
}

/**
 * Build a minimal bootstrap with the given team IDs.
 * Each team gets a synthetic name derived from its ID.
 */
function makeBootstrap(teamIds: number[]) {
  return {
    teams: teamIds.map(id => ({
      id,
      name: `Team${id}`,
      short_name: `T${id}`,
    })),
  }
}

// FPL difficulty -> attacking_difficulty: fplToAttDiff(d) = (d - 1) / 4
const fplToAttDiff = (d: number) => (d - 1) / 4
// attacking_ease = 1 - attacking_difficulty
const fplToEase = (d: number) => 1 - fplToAttDiff(d)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeClubForm swing fields', () => {

  // -------------------------------------------------------------------------
  // Test 1: 5 finished fixtures (diff=3) + 5 upcoming (diff=1) — improving.
  // past_ease_3gw = 1 - (3-1)/4 = 0.5
  // attacking_ease_1gw = 1 - (1-1)/4 = 1.0
  // swing_1gw = 1.0 - 0.5 = 0.5 > 0.2 (improving)
  // -------------------------------------------------------------------------
  it('Test 1: team with easier upcoming than past gets positive swing_1gw > 0.2', () => {
    const FOCAL = 1
    const OPP = 2
    const bootstrap = makeBootstrap([FOCAL, OPP])

    // 5 finished: focal is home, difficulty 3 (medium-hard)
    const finished = Array.from({ length: 5 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 1, finished: true, team_h_difficulty: 3, team_a_difficulty: 3 })
    )

    // 5 upcoming: focal is home, difficulty 1 (very easy)
    const upcoming = Array.from({ length: 5 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 6, finished: false, team_h_difficulty: 1, team_a_difficulty: 1 })
    )

    const result = computeClubForm(bootstrap, [...finished, ...upcoming])
    const team = result.find(r => r.team_id === FOCAL)!

    // past_ease_3gw: mean ease over last 3 finished (all diff=3) = 1 - (3-1)/4 = 0.5
    expect(team.past_ease_3gw).toBeCloseTo(0.5, 5)

    // attacking_ease_1gw: diff=1 → ease = 1.0
    expect(team.attacking_ease_1gw).toBeCloseTo(1.0, 5)

    // swing_1gw = 1.0 - 0.5 = 0.5 — strictly improving (> 0.2)
    expect(team.swing_1gw).not.toBeNull()
    expect(team.swing_1gw!).toBeGreaterThan(0.2)

    // swing_1gw / swing_3gw / swing_5gw all positive
    expect(team.swing_3gw).not.toBeNull()
    expect(team.swing_3gw!).toBeGreaterThan(0)
    expect(team.swing_5gw).not.toBeNull()
    expect(team.swing_5gw!).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Test 2: 5 finished fixtures (diff=1) + 5 upcoming (diff=5) — worsening.
  // past_ease_3gw = 1 - 0 = 1.0
  // attacking_ease_1gw = 1 - (5-1)/4 = 0.0
  // swing_1gw = 0.0 - 1.0 = -1.0 ≤ -0.2 (worsening)
  // -------------------------------------------------------------------------
  it('Test 2: team with harder upcoming than past gets negative swing_1gw ≤ -0.2', () => {
    const FOCAL = 1
    const OPP = 2
    const bootstrap = makeBootstrap([FOCAL, OPP])

    // 5 finished: focal is home, difficulty 1 (very easy past)
    const finished = Array.from({ length: 5 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 1, finished: true, team_h_difficulty: 1, team_a_difficulty: 1 })
    )

    // 5 upcoming: focal is home, difficulty 5 (very hard)
    const upcoming = Array.from({ length: 5 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 6, finished: false, team_h_difficulty: 5, team_a_difficulty: 5 })
    )

    const result = computeClubForm(bootstrap, [...finished, ...upcoming])
    const team = result.find(r => r.team_id === FOCAL)!

    // past_ease_3gw: last 3 finished difficulty=1 → ease = 1.0
    expect(team.past_ease_3gw).toBeCloseTo(1.0, 5)

    // attacking_ease_1gw: difficulty=5 → ease = 0.0
    expect(team.attacking_ease_1gw).toBeCloseTo(0.0, 5)

    // swing_1gw = 0.0 - 1.0 = -1.0 — strictly worsening (≤ -0.2)
    expect(team.swing_1gw).not.toBeNull()
    expect(team.swing_1gw!).toBeLessThanOrEqual(-0.2)
  })

  // -------------------------------------------------------------------------
  // Test 3: Team with 0 finished fixtures (early season).
  // past_ease_3gw = null; swing_1gw / swing_3gw / swing_5gw = null.
  // -------------------------------------------------------------------------
  it('Test 3: team with 0 finished fixtures (early season) gets null swing values', () => {
    const FOCAL = 1
    const OPP = 2
    const bootstrap = makeBootstrap([FOCAL, OPP])

    // No finished fixtures, 5 upcoming
    const upcoming = Array.from({ length: 5 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 1, finished: false, team_h_difficulty: 2, team_a_difficulty: 2 })
    )

    const result = computeClubForm(bootstrap, upcoming)
    const team = result.find(r => r.team_id === FOCAL)!

    expect(team.past_ease_3gw).toBeNull()
    expect(team.swing_1gw).toBeNull()
    expect(team.swing_3gw).toBeNull()
    expect(team.swing_5gw).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Test 4: Team with 0 upcoming fixtures (BGW — entire 5 GW lookahead empty).
  // attacking_ease_1gw = null AND swing_1gw = null (either-side-null contract).
  // -------------------------------------------------------------------------
  it('Test 4: BGW team with 0 upcoming fixtures gets null attacking_ease_1gw and null swing_1gw', () => {
    const FOCAL = 1
    const OPP = 2
    const bootstrap = makeBootstrap([FOCAL, OPP])

    // 5 finished fixtures only, no upcoming
    const finished = Array.from({ length: 5 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 1, finished: true, team_h_difficulty: 3, team_a_difficulty: 3 })
    )

    const result = computeClubForm(bootstrap, finished)
    const team = result.find(r => r.team_id === FOCAL)!

    // BGW: no upcoming fixtures → attacking_ease_1gw is null
    expect(team.attacking_ease_1gw).toBeNull()

    // swing_1gw is null because attacking_ease_1gw is null (either-side-null contract)
    expect(team.swing_1gw).toBeNull()
    expect(team.swing_3gw).toBeNull()
    expect(team.swing_5gw).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Test 5: Team with 2 finished fixtures (fewer than 3).
  // The implementation guards: `finishedFx.length >= 3`, so past_ease_3gw = null
  // when fewer than 3 finished fixtures exist. This is the actual production
  // behaviour — past_ease_3gw requires exactly 3 finished fixtures to be non-null.
  // swing_1gw is therefore also null (past_ease_3gw side is null).
  // -------------------------------------------------------------------------
  it('Test 5: team with 2 finished fixtures gets past_ease_3gw=null (< 3 guard)', () => {
    const FOCAL = 1
    const OPP = 2
    const bootstrap = makeBootstrap([FOCAL, OPP])

    // 2 finished fixtures (not enough to satisfy the >= 3 guard)
    const finished = [
      makeFixture({ team_h: FOCAL, team_a: OPP, event: 1, finished: true, team_h_difficulty: 2, team_a_difficulty: 2 }),
      makeFixture({ team_h: FOCAL, team_a: OPP, event: 2, finished: true, team_h_difficulty: 2, team_a_difficulty: 2 }),
    ]
    // 3 upcoming
    const upcoming = Array.from({ length: 3 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 3, finished: false, team_h_difficulty: 1, team_a_difficulty: 1 })
    )

    const result = computeClubForm(bootstrap, [...finished, ...upcoming])
    const team = result.find(r => r.team_id === FOCAL)!

    // Implementation requires >= 3 finished fixtures for past_ease_3gw to be non-null.
    // With only 2 finished fixtures, past_ease_3gw is null.
    expect(team.past_ease_3gw).toBeNull()

    // swing values are null because past_ease_3gw is null
    expect(team.swing_1gw).toBeNull()
    expect(team.swing_3gw).toBeNull()
    expect(team.swing_5gw).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Test 6: Past window selects the LAST 3 finished fixtures, not the first 3.
  // 5 finished fixtures with strictly increasing difficulty: 1,2,3,4,5.
  // The LAST 3 are events with difficulty 3,4,5.
  // fplToAttDiff: (3-1)/4=0.5, (4-1)/4=0.75, (5-1)/4=1.0
  // mean attacking_difficulty = (0.5 + 0.75 + 1.0) / 3 = 0.75
  // past_ease_3gw = 1 - 0.75 = 0.25
  // -------------------------------------------------------------------------
  it('Test 6: past window selects only the LAST 3 of 5 finished fixtures', () => {
    const FOCAL = 1
    const OPP = 2
    const bootstrap = makeBootstrap([FOCAL, OPP])

    // 5 finished fixtures with strictly increasing difficulty 1..5 (ascending events)
    const difficulties = [1, 2, 3, 4, 5]
    const finished = difficulties.map((d, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 1, finished: true, team_h_difficulty: d, team_a_difficulty: d })
    )

    // 3 upcoming (neutral difficulty=3) to ensure attacking_ease_1gw is non-null
    const upcoming = Array.from({ length: 3 }, (_, i) =>
      makeFixture({ team_h: FOCAL, team_a: OPP, event: i + 6, finished: false, team_h_difficulty: 3, team_a_difficulty: 3 })
    )

    const result = computeClubForm(bootstrap, [...finished, ...upcoming])
    const team = result.find(r => r.team_id === FOCAL)!

    // Last 3 difficulties: 3, 4, 5
    // mean attacking_difficulty = ((3-1)/4 + (4-1)/4 + (5-1)/4) / 3 = (0.5 + 0.75 + 1.0) / 3 = 0.75
    // past_ease_3gw = 1 - 0.75 = 0.25
    const expectedPastEase = 1 - (fplToAttDiff(3) + fplToAttDiff(4) + fplToAttDiff(5)) / 3
    expect(team.past_ease_3gw).toBeCloseTo(expectedPastEase, 5)
    expect(team.past_ease_3gw).toBeCloseTo(0.25, 5)

    // swing_1gw: attacking_ease_1gw = fplToEase(3) = 0.5; swing = 0.5 - 0.25 = 0.25
    expect(team.past_ease_3gw).not.toBeNull()
    expect(team.swing_1gw).not.toBeNull()
    // swing_1gw should be attacking_ease_1gw - past_ease_3gw
    expect(team.swing_1gw).toBeCloseTo(fplToEase(3) - expectedPastEase, 5)
  })

})
