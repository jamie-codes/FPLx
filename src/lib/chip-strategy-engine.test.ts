// Phase 34: chip-strategy-engine — pure function unit tests
import { describe, it, expect } from 'vitest'
import {
  buildClubFormMap,
  computeBBScore,
  computeTCScore,
  computeFHResult,
  BGW_NEUTRAL_EASE,
  TC_CANDIDATE_COUNT,
} from './chip-strategy-engine'
import type { ScoredPlayer, ClubForm, ClubFormFixture } from './types'
import type { SquadPick } from './squad-adapter'

function makeFx(overrides: Partial<ClubFormFixture> & { event_id: number; attacking_difficulty: number }): ClubFormFixture {
  return {
    opponent_team: overrides.opponent_team ?? 'OPP',
    is_home: overrides.is_home ?? true,
    event_id: overrides.event_id,
    difficulty_score: overrides.difficulty_score ?? 0.5,
    difficulty_tier: overrides.difficulty_tier ?? 'medium',
    attacking_difficulty: overrides.attacking_difficulty,
    defensive_difficulty: overrides.defensive_difficulty ?? 0.5,
  }
}

function makeClubForm(team_id: number, fixtures: ClubFormFixture[]): ClubForm {
  return {
    team_id,
    team_name: `Team${team_id}`,
    team_short_name: `T${team_id}`,
    wins: 0, draws: 0, losses: 0, goals_scored: 0, goals_conceded: 0,
    upcoming_fixtures: fixtures,
    attacking_ease_1gw: null, attacking_ease_3gw: null, attacking_ease_5gw: null,
    defensive_ease_1gw: null, defensive_ease_3gw: null, defensive_ease_5gw: null,
  }
}

function makePlayer(overrides: Partial<ScoredPlayer> & { id: number; element_type: 1|2|3|4; team: number }): ScoredPlayer {
  // Cast — only fields used by the engine matter; the test fixture is a partial.
  return {
    id: overrides.id,
    web_name: overrides.web_name ?? `P${overrides.id}`,
    element_type: overrides.element_type,
    team: overrides.team,
    now_cost: overrides.now_cost ?? 50,
    status: overrides.status ?? 'a',
    xPts_1gw: overrides.xPts_1gw ?? 5.0,
    xPts_90th_1gw: overrides.xPts_90th_1gw,
    proj_pts_1gw: overrides.proj_pts_1gw ?? 4.0,
    mins_risk: overrides.mins_risk ?? 'starter',
    // Required MergedPlayer fields
    team_short_name: `T${overrides.team}`,
    now_cost: overrides.now_cost ?? 50,
    selected_by_percent: '5.0',
    form: '5.0',
    minutes: 900,
    starts: 10,
    total_points: 60,
    goals_scored: 5,
    assists: 3,
    expected_goals: 0,
    expected_assists: 0,
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
    proj_pts_3gw: 15.0,
    proj_pts_5gw: 25.0,
    xmins: 90,
    start_prob: 1.0,
    // ScoredPlayer fields
    gem_score: 0.5,
    fdr_score: 0.5,
    form_score: 0.5,
    xg_score: null,
    xa_score: null,
    ownership_score: 0.5,
    minutes_score: 0.5,
    set_piece_score: 0.0,
    ...overrides,
  } as ScoredPlayer
}

function makeBenchPick(element: number, position: 12|13|14|15): SquadPick {
  return { element, position, multiplier: 0, is_captain: false, is_vice_captain: false }
}

describe('Phase 34: chip-strategy-engine', () => {
  describe('buildClubFormMap', () => {
    it('returns Map keyed by team_id with upcoming_fixtures arrays', () => {
      const cf = [makeClubForm(1, [makeFx({ event_id: 35, attacking_difficulty: 0.2 })])]
      const map = buildClubFormMap(cf)
      expect(map.size).toBe(1)
      expect(map.get(1)?.[0].event_id).toBe(35)
    })

    it('returns an empty map when given an empty array', () => {
      expect(buildClubFormMap([]).size).toBe(0)
    })
  })

  describe('computeBBScore (CHIP-01)', () => {
    it('returns 5 GWEaseScore entries for the next 5 GWs', () => {
      const team1Fx = [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.5 }))
      const map = buildClubFormMap([makeClubForm(1, team1Fx)])
      const players = [makePlayer({ id: 100, element_type: 2, team: 1 })]
      const bench = [makeBenchPick(100, 12)]
      const result = computeBBScore(bench, players, map, 35)
      expect(result.length).toBe(5)
      expect(result.map(r => r.gw)).toEqual([35,36,37,38,39])
    })

    it('inverts attacking_difficulty to ease (ease = 1 - attacking_difficulty)', () => {
      const map = buildClubFormMap([
        makeClubForm(1, [makeFx({ event_id: 35, attacking_difficulty: 0.2 }),
                        ...([36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.5 })))]),
      ])
      const players = [makePlayer({ id: 100, element_type: 2, team: 1 })]
      const bench = [makeBenchPick(100, 12)]
      const result = computeBBScore(bench, players, map, 35)
      expect(result[0].ease).toBeCloseTo(0.8, 5)
    })

    it('falls back to BGW_NEUTRAL_EASE when bench player has no fixture for target GW', () => {
      const map = buildClubFormMap([makeClubForm(1, [])]) // BGW for all 5
      const players = [makePlayer({ id: 100, element_type: 2, team: 1 })]
      const bench = [makeBenchPick(100, 12)]
      const result = computeBBScore(bench, players, map, 35)
      expect(result[0].ease).toBeCloseTo(BGW_NEUTRAL_EASE, 5)
    })

    it('marks the highest-ease GW as isBest', () => {
      const fx = [
        makeFx({ event_id: 35, attacking_difficulty: 0.9 }),  // ease 0.1
        makeFx({ event_id: 36, attacking_difficulty: 0.1 }),  // ease 0.9 — best
        makeFx({ event_id: 37, attacking_difficulty: 0.5 }),
        makeFx({ event_id: 38, attacking_difficulty: 0.5 }),
        makeFx({ event_id: 39, attacking_difficulty: 0.5 }),
      ]
      const map = buildClubFormMap([makeClubForm(1, fx)])
      const players = [makePlayer({ id: 100, element_type: 2, team: 1 })]
      const result = computeBBScore([makeBenchPick(100, 12)], players, map, 35)
      const best = result.find(r => r.isBest)
      expect(best?.gw).toBe(36)
    })

    it('tie-break on isBest goes to earliest GW', () => {
      const fx = [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.5 })) // all equal
      const map = buildClubFormMap([makeClubForm(1, fx)])
      const players = [makePlayer({ id: 100, element_type: 2, team: 1 })]
      const result = computeBBScore([makeBenchPick(100, 12)], players, map, 35)
      const best = result.find(r => r.isBest)
      expect(best?.gw).toBe(35) // earliest GW wins the tie
    })

    it('averages ease across multiple bench players', () => {
      // Team 1: ease 0.8 (difficulty 0.2); Team 2: ease 0.2 (difficulty 0.8)
      const map = buildClubFormMap([
        makeClubForm(1, [makeFx({ event_id: 35, attacking_difficulty: 0.2 })]),
        makeClubForm(2, [makeFx({ event_id: 35, attacking_difficulty: 0.8 })]),
      ])
      const players = [
        makePlayer({ id: 100, element_type: 2, team: 1 }),
        makePlayer({ id: 101, element_type: 3, team: 2 }),
      ]
      const bench = [makeBenchPick(100, 12), makeBenchPick(101, 13)]
      const result = computeBBScore(bench, players, map, 35)
      // average ease = (0.8 + 0.2) / 2 = 0.5
      expect(result[0].ease).toBeCloseTo(0.5, 5)
    })
  })

  describe('computeTCScore (CHIP-02)', () => {
    it('uses TC_CANDIDATE_COUNT (3) as the candidate pool size', () => {
      expect(TC_CANDIDATE_COUNT).toBe(3)
    })

    it('selects top-3 by xPts_90th_1gw and scores GW by max ease', () => {
      // 5 outfield players on teams 1-5; teams 1-5 all have fixtures GW35
      const fxPerTeam = (teamId: number, diff: number) =>
        makeClubForm(teamId, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: diff })))
      const map = buildClubFormMap([
        fxPerTeam(1, 0.1), fxPerTeam(2, 0.3), fxPerTeam(3, 0.9), fxPerTeam(4, 0.5), fxPerTeam(5, 0.5),
      ])
      // Ranked top-3 by xPts_90th_1gw: players on team 1 (10), team 2 (8), team 3 (7)
      const players = [
        makePlayer({ id: 1, element_type: 2, team: 1, xPts_90th_1gw: 10 }),
        makePlayer({ id: 2, element_type: 3, team: 2, xPts_90th_1gw: 8 }),
        makePlayer({ id: 3, element_type: 4, team: 3, xPts_90th_1gw: 7 }),
        makePlayer({ id: 4, element_type: 2, team: 4, xPts_90th_1gw: 5 }),
        makePlayer({ id: 5, element_type: 2, team: 5, xPts_90th_1gw: 3 }),
      ]
      const result = computeTCScore(players, map, 35)
      // GW35: team1 ease=0.9, team2 ease=0.7, team3 ease=0.1 -> max = 0.9
      expect(result[0].gw).toBe(35)
      expect(result[0].ease).toBeCloseTo(0.9, 5)
    })

    it('excludes element_type === 1 (GK) from candidates', () => {
      const map = buildClubFormMap([
        makeClubForm(1, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.5 }))),
        makeClubForm(2, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.1 }))),
      ])
      const players = [
        makePlayer({ id: 1, element_type: 1, team: 2, xPts_90th_1gw: 100 }), // GK on easiest team — should be excluded
        makePlayer({ id: 2, element_type: 2, team: 1, xPts_90th_1gw: 5 }),   // DEF on harder team
      ]
      const result = computeTCScore(players, map, 35)
      // Only non-GK players selected; team1 ease=0.5
      expect(result[0].ease).toBeCloseTo(0.5, 5)
    })

    it('excludes mins_risk === "injured" players from candidates', () => {
      const map = buildClubFormMap([
        makeClubForm(1, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.1 }))),
        makeClubForm(2, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.5 }))),
      ])
      const players = [
        makePlayer({ id: 1, element_type: 2, team: 1, xPts_90th_1gw: 100, mins_risk: 'injured' }), // top but injured
        makePlayer({ id: 2, element_type: 3, team: 2, xPts_90th_1gw: 5 }),
      ]
      const result = computeTCScore(players, map, 35)
      // Injured player excluded; only team2 (ease=0.5) remains
      expect(result[0].ease).toBeCloseTo(0.5, 5)
    })

    it('falls back to xPts_1gw when xPts_90th_1gw is undefined', () => {
      const map = buildClubFormMap([
        makeClubForm(1, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.1 }))),
        makeClubForm(2, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.9 }))),
      ])
      // Player on team1 has no xPts_90th_1gw but high xPts_1gw (should win rank)
      const players = [
        makePlayer({ id: 1, element_type: 2, team: 1, xPts_1gw: 10, xPts_90th_1gw: undefined }),
        makePlayer({ id: 2, element_type: 3, team: 2, xPts_1gw: 3, xPts_90th_1gw: undefined }),
      ]
      const result = computeTCScore(players, map, 35)
      // Top candidate is on team1 (ease=0.9), so GW35 score should be 0.9
      expect(result[0].ease).toBeCloseTo(0.9, 5)
    })

    it('falls back to proj_pts_1gw when both xPts_90th_1gw and xPts_1gw are undefined', () => {
      const map = buildClubFormMap([
        makeClubForm(1, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.1 }))),
      ])
      const players = [
        makePlayer({ id: 1, element_type: 2, team: 1, xPts_1gw: undefined, xPts_90th_1gw: undefined, proj_pts_1gw: 9 }),
      ]
      // Should still produce valid scores (no crash)
      const result = computeTCScore(players, map, 35)
      expect(result.length).toBe(5)
      expect(result[0].ease).toBeCloseTo(0.9, 5)
    })

    it('per-GW score uses MAX ease across candidates (not sum)', () => {
      const map = buildClubFormMap([
        makeClubForm(1, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.1 }))), // ease 0.9
        makeClubForm(2, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.8 }))), // ease 0.2
        makeClubForm(3, [35,36,37,38,39].map(gw => makeFx({ event_id: gw, attacking_difficulty: 0.6 }))), // ease 0.4
      ])
      const players = [
        makePlayer({ id: 1, element_type: 2, team: 1, xPts_90th_1gw: 10 }),
        makePlayer({ id: 2, element_type: 3, team: 2, xPts_90th_1gw: 8 }),
        makePlayer({ id: 3, element_type: 4, team: 3, xPts_90th_1gw: 6 }),
      ]
      const result = computeTCScore(players, map, 35)
      // MAX ease = 0.9 (team1), not sum 0.9+0.2+0.4=1.5
      expect(result[0].ease).toBeCloseTo(0.9, 5)
    })

    it('falls back to BGW_NEUTRAL_EASE when best candidate has no fixture', () => {
      const map = buildClubFormMap([makeClubForm(1, [])]) // BGW
      const players = [makePlayer({ id: 1, element_type: 2, team: 1, xPts_90th_1gw: 10 })]
      const result = computeTCScore(players, map, 35)
      expect(result[0].ease).toBeCloseTo(BGW_NEUTRAL_EASE, 5)
    })
  })

  describe('computeFHResult (CHIP-03)', () => {
    // Helper: build 25 players across 5 teams to exercise team cap
    function makePlayerPool(): ScoredPlayer[] {
      const pool: ScoredPlayer[] = []
      let id = 200
      // 5 teams, each with 5 players: 1 GK, 2 DEF, 1 MID, 1 FWD
      for (let team = 1; team <= 5; team++) {
        pool.push(makePlayer({ id: id++, element_type: 1, team, now_cost: 45, xPts_1gw: 4.0 })) // GK
        pool.push(makePlayer({ id: id++, element_type: 2, team, now_cost: 55, xPts_1gw: 5.0 })) // DEF
        pool.push(makePlayer({ id: id++, element_type: 2, team, now_cost: 50, xPts_1gw: 4.5 })) // DEF
        pool.push(makePlayer({ id: id++, element_type: 3, team, now_cost: 65, xPts_1gw: 6.0 })) // MID
        pool.push(makePlayer({ id: id++, element_type: 4, team, now_cost: 60, xPts_1gw: 5.5 })) // FWD
      }
      return pool
    }

    function makeMapFor5Teams(): Map<number, import('./types').ClubFormFixture[]> {
      const teams: ClubForm[] = []
      for (let team = 1; team <= 5; team++) {
        teams.push(makeClubForm(team, [35,36,37,38,39].map(gw =>
          makeFx({ event_id: gw, attacking_difficulty: 0.3 }),
        )))
      }
      return buildClubFormMap(teams)
    }

    it('returns suggestedSquad with at most 15 players', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 0, undefined, undefined, 35)
      expect(result.suggestedSquad.length).toBeLessThanOrEqual(15)
    })

    it('returns 5 GWEaseScore entries', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 0, undefined, undefined, 35)
      expect(result.scores.length).toBe(5)
    })

    it('respects formation: exactly 2 GK in squad', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      const gkCount = result.suggestedSquad.filter(p => p.element_type === 1).length
      expect(gkCount).toBe(2)
    })

    it('respects formation: 3-5 DEF in squad', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      const defCount = result.suggestedSquad.filter(p => p.element_type === 2).length
      expect(defCount).toBeGreaterThanOrEqual(3)
      expect(defCount).toBeLessThanOrEqual(5)
    })

    it('respects formation: 2-5 MID in squad', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      const midCount = result.suggestedSquad.filter(p => p.element_type === 3).length
      expect(midCount).toBeGreaterThanOrEqual(2)
      expect(midCount).toBeLessThanOrEqual(5)
    })

    it('respects formation: 1-3 FWD in squad', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      const fwdCount = result.suggestedSquad.filter(p => p.element_type === 4).length
      expect(fwdCount).toBeGreaterThanOrEqual(1)
      expect(fwdCount).toBeLessThanOrEqual(3)
    })

    it('respects 3-player team cap (no team appears more than 3 times)', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      const teamCounts = new Map<number, number>()
      for (const p of result.suggestedSquad) {
        teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1)
      }
      for (const [, count] of teamCounts) {
        expect(count).toBeLessThanOrEqual(3)
      }
    })

    it('respects budget: total now_cost <= budget', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      // Provide a small explicit squad so budget = bankBalance + squad sell prices
      // Squad of 2 players each worth 10 tenths; bank=0 -> budget=20 (very tight)
      // Players 200/201 cost 45/55 normally, but we override sell prices to 10
      const currentSquadIds = [200, 201]
      const sellPrices: Record<number, number> = { 200: 10, 201: 10 }
      const result = computeFHResult(players, map, 0, sellPrices, currentSquadIds, 35)
      const totalCost = result.suggestedSquad.reduce((sum, p) => sum + p.now_cost, 0)
      expect(totalCost).toBeLessThanOrEqual(20)
    })

    it('uses bankBalance + squad sell prices as full budget (Pitfall 5)', () => {
      const players = makePlayerPool()
      const map = makeMapFor5Teams()
      // Squad of 2 players worth 100 tenths each; bank=0 -> budget=200
      const currentSquadIds = [200, 201]
      const sellPrices: Record<number, number> = { 200: 100, 201: 100 }
      const result = computeFHResult(players, map, 0, sellPrices, currentSquadIds, 35)
      const totalCost = result.suggestedSquad.reduce((sum, p) => sum + p.now_cost, 0)
      expect(totalCost).toBeLessThanOrEqual(200)
    })

    it('selects the GW where weighted top-11 xPts is maximised as bestGw', () => {
      // GW36 has easier fixtures (attacking_difficulty 0.1) vs GW35 (0.9)
      const teams: ClubForm[] = []
      for (let team = 1; team <= 5; team++) {
        teams.push(makeClubForm(team, [
          makeFx({ event_id: 35, attacking_difficulty: 0.9 }), // hard
          makeFx({ event_id: 36, attacking_difficulty: 0.1 }), // easy — should be bestGw
          makeFx({ event_id: 37, attacking_difficulty: 0.5 }),
          makeFx({ event_id: 38, attacking_difficulty: 0.5 }),
          makeFx({ event_id: 39, attacking_difficulty: 0.5 }),
        ]))
      }
      const map = buildClubFormMap(teams)
      const players = makePlayerPool()
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      expect(result.bestGw).toBe(36)
    })

    it('tie-break for bestGw goes to earliest GW', () => {
      // All GWs identical difficulty -> bestGw should be 35
      const players = makePlayerPool()
      const map = makeMapFor5Teams() // all 0.3 difficulty
      const result = computeFHResult(players, map, 1000, undefined, undefined, 35)
      expect(result.bestGw).toBe(35)
    })

    it('returns empty suggestedSquad and bestGw=startGw when players is empty', () => {
      const map = makeMapFor5Teams()
      const result = computeFHResult([], map, 1000, undefined, undefined, 35)
      expect(result.suggestedSquad).toEqual([])
      expect(result.bestGw).toBe(35)
    })
  })
})
