import { describe, it, expect } from 'vitest'
import { computeCaptaincyCandidates } from '@/lib/captaincy-engine'
import type { CaptaincyCandidate } from '@/lib/captaincy-engine'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Test factory helpers
// ---------------------------------------------------------------------------

function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id: 1,
    web_name: 'Test',
    team: 1,
    team_short_name: 'TST',
    element_type: 3,
    now_cost: 70,
    selected_by_percent: '10.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 5,
    assists: 3,
    expected_goals: 0,
    expected_assists: 0,
    pts_last3gw: 15,
    pts_last5gw: 25,
    pts_gw_count: 30,
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
    understat_id: 100,
    xg_per90: 0.3,
    xa_per90: 0.15,
    minutes_per90: 85,
    form_pts_per90: 5.0,
    fixtures: [
      { opponent_team: 'ARS', is_home: true, event_id: 10, difficulty_score: 0.6, difficulty_tier: 'medium' },
    ],
    proj_pts_1gw: 4.5,
    proj_pts_3gw: 12.0,
    proj_pts_5gw: 18.5,
    xmins: 78.0,
    start_prob: 0.87,
    mins_risk: 'nailed' as const,
    gem_score: 0.5,
    fdr_score: 0.5,
    form_score: 0.5,
    xg_score: 0.5,
    xa_score: 0.5,
    ownership_score: 0.5,
    minutes_score: 0.5,
    set_piece_score: 0.5,
    ...overrides,
  }
}

function makeSquadPick(overrides: Partial<SquadPick> = {}): SquadPick {
  return {
    element: 1,
    position: 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeCaptaincyCandidates', () => {
  it('returns top-5 candidates sorted by projected_captain_pts descending', () => {
    // 7 starting-XI players with different proj_pts_1gw values
    const projPts = [8.0, 6.5, 5.5, 4.0, 3.5, 3.0, 2.0]
    const allPlayers = projPts.map((pts, i) =>
      makeScoredPlayer({ id: i + 1, proj_pts_1gw: pts }),
    )
    const squadPicks = projPts.map((_, i) =>
      makeSquadPick({ element: i + 1, position: i + 1 }),  // positions 1-7, all starting
    )

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.length).toBe(5)
    expect(result[0].projected_captain_pts).toBe(16.0)  // 8.0 * 2
    expect(result[4].projected_captain_pts).toBe(7.0)   // 3.5 * 2
  })

  it('projected_captain_pts equals proj_pts_1gw * 2', () => {
    const player = makeScoredPlayer({ id: 1, proj_pts_1gw: 7.2 })
    const pick = makeSquadPick({ element: 1, position: 1 })

    const result = computeCaptaincyCandidates([pick], [player])

    expect(result.length).toBe(1)
    expect(result[0].projected_captain_pts).toBeCloseTo(14.4)
  })

  it('only starting-XI picks (position 1-11) considered', () => {
    // Bench player (position 12) has higher proj_pts_1gw than starting player (position 1)
    const startingPlayer = makeScoredPlayer({ id: 1, proj_pts_1gw: 5.0 })
    const benchPlayer = makeScoredPlayer({ id: 2, proj_pts_1gw: 9.0 })
    const allPlayers = [startingPlayer, benchPlayer]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 1 }),   // starting
      makeSquadPick({ element: 2, position: 12 }),  // bench
    ]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.length).toBe(1)
    expect(result[0].player.id).toBe(1)  // only the starting player
    // bench player with id=2 must NOT be in result
    expect(result.find(c => c.player.id === 2)).toBeUndefined()
  })

  it('excludes injured players (mins_risk === "injured")', () => {
    const injuredPlayer = makeScoredPlayer({ id: 1, mins_risk: 'injured', proj_pts_1gw: 0.0 })
    const healthyPlayer = makeScoredPlayer({ id: 2, proj_pts_1gw: 5.0 })
    const allPlayers = [injuredPlayer, healthyPlayer]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.find(c => c.player.id === 1)).toBeUndefined()
    expect(result.find(c => c.player.id === 2)).toBeDefined()
  })

  it('excludes goalkeepers (element_type === 1) even with high proj_pts_1gw', () => {
    const goalkeeper = makeScoredPlayer({ id: 1, element_type: 1, proj_pts_1gw: 9.0, mins_risk: 'nailed' })
    const outfielder = makeScoredPlayer({ id: 2, element_type: 4, proj_pts_1gw: 6.0 })
    const allPlayers = [goalkeeper, outfielder]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.find(c => c.player.id === 1)).toBeUndefined()
    expect(result.find(c => c.player.id === 2)).toBeDefined()
  })

  it('excludes players with proj_pts_1gw <= 0', () => {
    const zeroProjectionPlayer = makeScoredPlayer({ id: 1, proj_pts_1gw: 0.0, mins_risk: 'nailed' })
    const normalPlayer = makeScoredPlayer({ id: 2, proj_pts_1gw: 4.0 })
    const allPlayers = [zeroProjectionPlayer, normalPlayer]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.find(c => c.player.id === 1)).toBeUndefined()
    expect(result.find(c => c.player.id === 2)).toBeDefined()
  })

  it('captain_type is "safe" when mins_risk="nailed" AND gem_score >= position average', () => {
    // 20 MIDs in allPlayers with gem_score 0.50 (avg = 0.50)
    const allMids = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 1, element_type: 3, gem_score: 0.50, proj_pts_1gw: 3.0 }),
    )
    // Squad MID with mins_risk='nailed', gem_score=0.60 (above avg of 0.50)
    const squadMid = makeScoredPlayer({
      id: 99,
      element_type: 3,
      mins_risk: 'nailed',
      gem_score: 0.60,
      proj_pts_1gw: 6.0,
    })
    const allPlayers = [...allMids, squadMid]
    const squadPicks = [makeSquadPick({ element: 99, position: 1 })]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.length).toBe(1)
    expect(result[0].captain_type).toBe('safe')
  })

  it('captain_type is "upside" for rotation_risk player regardless of gem_score', () => {
    const player = makeScoredPlayer({
      id: 1,
      mins_risk: 'rotation_risk',
      gem_score: 0.80,
      proj_pts_1gw: 5.0,
    })
    const squadPicks = [makeSquadPick({ element: 1, position: 1 })]

    const result = computeCaptaincyCandidates(squadPicks, [player])

    expect(result.length).toBe(1)
    expect(result[0].captain_type).toBe('upside')
  })

  it('captain_type is "upside" for likely_start player even with high gem_score', () => {
    const player = makeScoredPlayer({
      id: 1,
      mins_risk: 'likely_start',
      gem_score: 0.80,
      proj_pts_1gw: 5.0,
    })
    const squadPicks = [makeSquadPick({ element: 1, position: 1 })]

    const result = computeCaptaincyCandidates(squadPicks, [player])

    expect(result.length).toBe(1)
    expect(result[0].captain_type).toBe('upside')
  })

  it('captain_type is "upside" for nailed player with gem_score below position average', () => {
    // allPlayers avg gem_score 0.50 for MIDs
    const allMids = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 1, element_type: 3, gem_score: 0.50, proj_pts_1gw: 3.0 }),
    )
    // Squad MID with mins_risk='nailed', gem_score=0.40 (below avg of 0.50)
    const squadMid = makeScoredPlayer({
      id: 99,
      element_type: 3,
      mins_risk: 'nailed',
      gem_score: 0.40,
      proj_pts_1gw: 6.0,
    })
    const allPlayers = [...allMids, squadMid]
    const squadPicks = [makeSquadPick({ element: 99, position: 1 })]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.length).toBe(1)
    expect(result[0].captain_type).toBe('upside')
  })

  it('DGW player with high proj_pts_1gw ranks first', () => {
    const dgwPlayer = makeScoredPlayer({ id: 1, proj_pts_1gw: 12.0 })
    const normalPlayer = makeScoredPlayer({ id: 2, proj_pts_1gw: 6.0 })
    const allPlayers = [dgwPlayer, normalPlayer]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result[0].projected_captain_pts).toBe(24.0)  // 12.0 * 2
    expect(result[0].player.id).toBe(1)
  })

  it('returns empty array when no viable candidates', () => {
    // All bench players
    const player1 = makeScoredPlayer({ id: 1, proj_pts_1gw: 5.0 })
    const player2 = makeScoredPlayer({ id: 2, proj_pts_1gw: 4.0 })
    const allPlayers = [player1, player2]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 12 }),  // bench
      makeSquadPick({ element: 2, position: 13 }),  // bench
    ]

    const result = computeCaptaincyCandidates(squadPicks, allPlayers)

    expect(result.length).toBe(0)
  })

  it('returns fewer than 5 when fewer than 5 viable candidates exist', () => {
    // Only 3 starting-XI players with proj_pts_1gw > 0
    const players = [
      makeScoredPlayer({ id: 1, proj_pts_1gw: 5.0 }),
      makeScoredPlayer({ id: 2, proj_pts_1gw: 4.0 }),
      makeScoredPlayer({ id: 3, proj_pts_1gw: 3.0 }),
    ]
    const squadPicks = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
      makeSquadPick({ element: 3, position: 3 }),
    ]

    const result = computeCaptaincyCandidates(squadPicks, players)

    expect(result.length).toBe(3)
  })

  it('respects custom topN parameter', () => {
    // 5 viable candidates, topN=3
    const players = [
      makeScoredPlayer({ id: 1, proj_pts_1gw: 8.0 }),
      makeScoredPlayer({ id: 2, proj_pts_1gw: 6.0 }),
      makeScoredPlayer({ id: 3, proj_pts_1gw: 5.0 }),
      makeScoredPlayer({ id: 4, proj_pts_1gw: 4.0 }),
      makeScoredPlayer({ id: 5, proj_pts_1gw: 3.0 }),
    ]
    const squadPicks = players.map((p, i) =>
      makeSquadPick({ element: p.id, position: i + 1 }),
    )

    const result = computeCaptaincyCandidates(squadPicks, players, 3)

    expect(result.length).toBe(3)
  })
})
