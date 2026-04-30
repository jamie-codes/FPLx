import { describe, it, expect } from 'vitest'
import { generatePlan, fixtureCountForGw } from '@/lib/planning-engine'
import type { ScoredPlayer, FTState, PlannerHorizon } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    // MergedPlayer fields
    id: 1,
    web_name: 'TestPlayer',
    team: 1,
    team_short_name: 'TST',
    element_type: 3, // MID
    now_cost: 50,    // Â£5.0m in tenths
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
    pts_gw_count: 10,
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
    fixtures: [
      {
        opponent_team: 'ARS',
        is_home: true,
        event_id: 34,
        difficulty_score: 0.5,
        difficulty_tier: 'medium',
      },
    ],
    xPts_1gw: 4.0,
    xPts_3gw: 12.0,
    xPts_5gw: 20.0,
    xmins: 90,
    start_prob: 1.0,
    mins_risk: 'nailed',
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
  }
}

function makeSquadPick(element: number, position: number): SquadPick {
  return {
    element,
    position,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
  }
}

// ---------------------------------------------------------------------------
// Helper to create a starting XI (positions 1-11) + bench (12-15)
// with 11 MID players as default
// ---------------------------------------------------------------------------
function makeDefaultSquad(ids: number[]): SquadPick[] {
  return ids.map((id, i) => makeSquadPick(id, i + 1))
}

// ---------------------------------------------------------------------------
// describe('generatePlan â€” basic shape')
// ---------------------------------------------------------------------------

describe('generatePlan â€” basic shape', () => {
  it('returns a PlanResult with steps.length === 1 when horizon === 1', () => {
    const squadPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.3 })
    const candidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 50, gem_score: 0.8, xPts_1gw: 8.0 })
    const picks = makeDefaultSquad([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    const allPlayers = [
      squadPlayer,
      makeScoredPlayer({ id: 2 }),
      makeScoredPlayer({ id: 3 }),
      makeScoredPlayer({ id: 4 }),
      makeScoredPlayer({ id: 5 }),
      makeScoredPlayer({ id: 6 }),
      makeScoredPlayer({ id: 7 }),
      makeScoredPlayer({ id: 8 }),
      makeScoredPlayer({ id: 9 }),
      makeScoredPlayer({ id: 10 }),
      makeScoredPlayer({ id: 11 }),
      makeScoredPlayer({ id: 12 }),
      makeScoredPlayer({ id: 13 }),
      makeScoredPlayer({ id: 14 }),
      makeScoredPlayer({ id: 15 }),
      candidate,
    ]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    expect(result.steps).toHaveLength(1)
    expect(result.horizon).toBe(1)
    expect(result.startingGw).toBe(34)
  })

  it('returns steps.length === 3 when horizon === 3', () => {
    const picks = makeDefaultSquad([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    const allPlayers = Array.from({ length: 20 }, (_, i) =>
      makeScoredPlayer({ id: i + 1, fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' }, { opponent_team: 'CHE', is_home: false, event_id: 35, difficulty_score: 0.6, difficulty_tier: 'medium' }, { opponent_team: 'LIV', is_home: true, event_id: 36, difficulty_score: 0.7, difficulty_tier: 'hard' }] })
    )
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 3, 34, ftState, 0)

    expect(result.steps).toHaveLength(3)
  })

  it('step 0 includes transfersIn with the better player ID when 1 player worse than a candidate', () => {
    // Player 1 has low proj_pts, player 100 is a strong replacement
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 2.0 })
    const strongCandidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 50, gem_score: 0.9, xPts_1gw: 9.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      weakPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      strongCandidate,
    ]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    expect(result.steps[0].transfersIn).toContain(100)
  })
})

// ---------------------------------------------------------------------------
// describe('generatePlan â€” DGW/BGW scoring')
// ---------------------------------------------------------------------------

describe('generatePlan â€” DGW/BGW scoring', () => {
  it('DGW player (2 fixtures in target GW) is preferred over equally-rated single-GW player', () => {
    const singleGwCandidate = makeScoredPlayer({
      id: 100,
      element_type: 3,
      now_cost: 50,
      gem_score: 0.8,
      xPts_1gw: 5.0,
      fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' }],
    })
    const dgwCandidate = makeScoredPlayer({
      id: 200,
      element_type: 3,
      now_cost: 50,
      gem_score: 0.8, // same gem_score
      xPts_1gw: 5.0, // same proj_pts
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'CHE', is_home: false, event_id: 34, difficulty_score: 0.6, difficulty_tier: 'medium' },
      ],
    })
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      weakPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      singleGwCandidate,
      dgwCandidate,
    ]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    // DGW candidate should be chosen over single-GW candidate (2x score vs 1x)
    expect(result.steps[0].transfersIn).toContain(200)
    expect(result.steps[0].transfersIn).not.toContain(100)
  })

  it('BGW player (0 fixtures in target GW) scores 0 and is not suggested over a normal-GW player', () => {
    const bgwCandidate = makeScoredPlayer({
      id: 100,
      element_type: 3,
      now_cost: 50,
      gem_score: 0.9,
      xPts_1gw: 10.0,
      // No fixture in GW 34
      fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' }],
    })
    const normalCandidate = makeScoredPlayer({
      id: 200,
      element_type: 3,
      now_cost: 50,
      gem_score: 0.5,
      xPts_1gw: 5.0,
      fixtures: [{ opponent_team: 'CHE', is_home: false, event_id: 34, difficulty_score: 0.6, difficulty_tier: 'medium' }],
    })
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      weakPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      bgwCandidate,
      normalCandidate,
    ]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    // normal GW candidate should win over BGW candidate despite lower gem score
    expect(result.steps[0].transfersIn).toContain(200)
    expect(result.steps[0].transfersIn).not.toContain(100)
  })

  it('fixtureCountForGw returns 2 for a DGW player', () => {
    const dgwPlayer = makeScoredPlayer({
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'CHE', is_home: false, event_id: 34, difficulty_score: 0.6, difficulty_tier: 'medium' },
      ],
    })
    expect(fixtureCountForGw(dgwPlayer, 34)).toBe(2)
  })

  it('fixtureCountForGw returns 0 for a BGW player', () => {
    const bgwPlayer = makeScoredPlayer({
      fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' }],
    })
    expect(fixtureCountForGw(bgwPlayer, 34)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// describe('generatePlan â€” hit cost and FT state')
// ---------------------------------------------------------------------------

describe('generatePlan â€” hit cost and FT state', () => {
  it('hitCost === 0 when 1 FT available and engine suggests 1 transfer', () => {
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0 })
    const strongCandidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 50, gem_score: 0.9, xPts_1gw: 9.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      weakPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      strongCandidate,
    ]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    expect(result.steps[0].hitCost).toBe(0)
  })

  it('hitCost === -4 when 0 FTs available and engine suggests 1 transfer (only if netGain > 0)', () => {
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0 })
    // Large gain to ensure netGain > 0 after -4 deduction
    const strongCandidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 50, gem_score: 0.9, xPts_1gw: 12.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      weakPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      strongCandidate,
    ]
    const ftState: FTState = { available: 0, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    expect(result.steps[0].hitCost).toBe(-4)
  })

  it('hit NOT suggested when netGain <= 0 after -4 deduction (candidate with only +3 delta)', () => {
    // weakPlayer: xPts_1gw = 4.0, strongCandidate: xPts_1gw = 7.0 â†’ delta = 3.0
    // With 0 FTs: hitCost = -4, netGain = 3 - 4 = -1 â†’ no transfer suggested
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 4.0 })
    const marginalCandidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 50, gem_score: 0.8, xPts_1gw: 7.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      weakPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      marginalCandidate,
    ]
    const ftState: FTState = { available: 0, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    // No transfer should be suggested since netGain <= 0
    expect(result.steps[0].transfersIn).toHaveLength(0)
    expect(result.steps[0].transfersOut).toHaveLength(0)
  })

  it('FT state chains correctly: use 1 FT in step 1 â†’ step 2 has 1 FT', () => {
    // Start with 1 FT, use it in step 1 â†’ computeNextFTState(1, 1, null) = {available:1, banked:0}
    const weakPlayer1 = makeScoredPlayer({
      id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0,
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'BHA', is_home: true, event_id: 35, difficulty_score: 0.4, difficulty_tier: 'easy' },
      ],
    })
    const strongCandidate = makeScoredPlayer({
      id: 100, element_type: 3, now_cost: 50, gem_score: 0.9, xPts_1gw: 9.0,
      fixtures: [
        { opponent_team: 'CHE', is_home: false, event_id: 34, difficulty_score: 0.6, difficulty_tier: 'medium' },
        { opponent_team: 'MCI', is_home: false, event_id: 35, difficulty_score: 0.8, difficulty_tier: 'hard' },
      ],
    })
    const restOfSquad = Array.from({ length: 14 }, (_, i) =>
      makeScoredPlayer({
        id: i + 2,
        fixtures: [
          { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
          { opponent_team: 'BHA', is_home: true, event_id: 35, difficulty_score: 0.4, difficulty_tier: 'easy' },
        ],
      })
    )
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [weakPlayer1, ...restOfSquad, strongCandidate]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 2, 34, ftState, 0)

    // step 1 uses 1 FT â†’ step 2 should have 1 FT available
    expect(result.steps[0].freeTransfersAvailable).toBe(1)
    expect(result.steps[1].freeTransfersAvailable).toBe(1)
  })

  it('FT state chains correctly: save step 1 FT â†’ step 2 has 2 FTs', () => {
    // All players equal quality â€” no beneficial transfer, so FT is saved
    const picks = makeDefaultSquad([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    const allPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({
        id: i + 1,
        fixtures: [
          { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
          { opponent_team: 'BHA', is_home: true, event_id: 35, difficulty_score: 0.4, difficulty_tier: 'easy' },
        ],
      })
    )
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 2, 34, ftState, 0)

    // No beneficial transfer in step 1 â†’ FT saved â†’ step 2 has 2 FTs
    expect(result.steps[0].transfersIn).toHaveLength(0)
    expect(result.steps[1].freeTransfersAvailable).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// describe('generatePlan â€” look-ahead')
// ---------------------------------------------------------------------------

describe('generatePlan â€” look-ahead', () => {
  it('prefers player with strong GW+1 fixtures over equally-rated player with weak GW+1', () => {
    // Both candidates score the same in target GW (GW 34)
    // But candidate A has a great GW 35; candidate B has a terrible GW 35
    const weakSellPlayer = makeScoredPlayer({
      id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0,
      fixtures: [
        { opponent_team: 'TST', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'TST', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' },
      ],
    })
    const candidateGoodLookAhead = makeScoredPlayer({
      id: 100, element_type: 3, now_cost: 50, gem_score: 0.7, xPts_1gw: 6.0,
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'NOR', is_home: true, event_id: 35, difficulty_score: 0.2, difficulty_tier: 'easy' },
      ],
    })
    const candidateBadLookAhead = makeScoredPlayer({
      id: 200, element_type: 3, now_cost: 50, gem_score: 0.7, xPts_1gw: 6.0,
      // Same GW34 score, but BGW in GW35
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        // No GW35 fixture â†’ BGW next GW
      ],
    })
    const restOfSquad = Array.from({ length: 14 }, (_, i) =>
      makeScoredPlayer({ id: i + 2 })
    )
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [weakSellPlayer, ...restOfSquad, candidateGoodLookAhead, candidateBadLookAhead]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 2, 34, ftState, 0)

    // candidateGoodLookAhead (100) should be preferred due to stronger GW+1 score
    expect(result.steps[0].transfersIn).toContain(100)
    expect(result.steps[0].transfersIn).not.toContain(200)
  })
})

// ---------------------------------------------------------------------------
// describe('generatePlan â€” budget')
// ---------------------------------------------------------------------------

describe('generatePlan â€” budget', () => {
  it('unaffordable buy (too expensive) is never in transfersIn', () => {
    const squadPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0 })
    // Expensive candidate: costs 150 (Â£15m), squad player sells for 50 (Â£5m), bank = 0
    // budget = 0 + 50 = 50 â†’ 150 > 50 â†’ unaffordable
    const expensiveCandidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 150, gem_score: 0.99, xPts_1gw: 20.0 })
    const affordableCandidate = makeScoredPlayer({ id: 200, element_type: 3, now_cost: 50, gem_score: 0.8, xPts_1gw: 9.0 })
    const picks = [
      makeSquadPick(1, 1),
      ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2)),
    ]
    const allPlayers = [
      squadPlayer,
      ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })),
      expensiveCandidate,
      affordableCandidate,
    ]
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0) // bankBalance = 0

    expect(result.steps[0].transfersIn).not.toContain(100)
    expect(result.steps[0].transfersIn).toContain(200)
  })

  it('budget updates across steps (sell price reclaimed, buy price deducted from bank)', () => {
    // Step 1: sell player (id=1, cost=50), buy candidate (id=100, cost=80)
    // bank starts at 40 â†’ after step 1: bank = 40 + 50 - 80 = 10
    // Step 2: buy candidate (id=200, cost=60) â€” should be affordable (10 + 80 = 90, and 60 <= 90)
    const weakPlayer1 = makeScoredPlayer({
      id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0,
      fixtures: [
        { opponent_team: 'TST', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'TST', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' },
      ],
    })
    const weakPlayer2 = makeScoredPlayer({
      id: 2, element_type: 3, now_cost: 60, gem_score: 0.15, xPts_1gw: 1.5,
      fixtures: [
        { opponent_team: 'TST', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'TST', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' },
      ],
    })
    const candidate1 = makeScoredPlayer({
      id: 100, element_type: 3, now_cost: 80, gem_score: 0.9, xPts_1gw: 9.0,
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'BHA', is_home: true, event_id: 35, difficulty_score: 0.4, difficulty_tier: 'easy' },
      ],
    })
    const candidate2 = makeScoredPlayer({
      id: 200, element_type: 3, now_cost: 60, gem_score: 0.85, xPts_1gw: 8.0,
      fixtures: [
        { opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
        { opponent_team: 'BHA', is_home: true, event_id: 35, difficulty_score: 0.4, difficulty_tier: 'easy' },
      ],
    })
    const restOfSquad = Array.from({ length: 13 }, (_, i) =>
      makeScoredPlayer({
        id: i + 3,
        fixtures: [
          { opponent_team: 'TST', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' },
          { opponent_team: 'TST', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' },
        ],
      })
    )
    const picks = [
      makeSquadPick(1, 1),
      makeSquadPick(2, 2),
      ...Array.from({ length: 13 }, (_, i) => makeSquadPick(i + 3, i + 3)),
    ]
    const allPlayers = [weakPlayer1, weakPlayer2, ...restOfSquad, candidate1, candidate2]
    const ftState: FTState = { available: 2, banked: 1 }
    const bankBalance = 40

    const result = generatePlan(picks, allPlayers, 2, 34, ftState, bankBalance)

    // Both steps should have transfers (strong candidates available)
    // Step 2 candidate (200) should be affordable after budget adjustment from step 1
    expect(result.steps).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// describe('generatePlan â€” unconfirmed fixtures')
// ---------------------------------------------------------------------------

describe('generatePlan â€” unconfirmed fixtures', () => {
  it('step has unconfirmedFixtures === true when no player has fixture data for that GW', () => {
    const picks = makeDefaultSquad([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    // All players only have fixtures for GW 35, not GW 34
    const allPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({
        id: i + 1,
        fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' }],
      })
    )
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    expect(result.steps[0].unconfirmedFixtures).toBe(true)
  })

  it('step has unconfirmedFixtures === false when at least one player has fixture data for that GW', () => {
    const picks = makeDefaultSquad([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    const allPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({
        id: i + 1,
        fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' }],
      })
    )
    const ftState: FTState = { available: 1, banked: 0 }

    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)

    expect(result.steps[0].unconfirmedFixtures).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// describe('generatePlan - positionsAfter')
// ---------------------------------------------------------------------------

describe('generatePlan - positionsAfter', () => {
  it('each step includes positionsAfter with 15 entries matching squad positions', () => {
    const picks = makeDefaultSquad([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
    const allPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({
        id: i + 1,
        fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' }],
      })
    )
    const ftState: FTState = { available: 1, banked: 0 }
    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)
    const pa = result.steps[0].positionsAfter
    expect(Object.keys(pa)).toHaveLength(15)
    // Each player ID maps to its original pick position
    for (let i = 1; i <= 15; i++) {
      expect(pa[i]).toBe(i)
    }
  })

  it('after transfer, bought player inherits sold player position in positionsAfter', () => {
    const weakPlayer = makeScoredPlayer({ id: 1, element_type: 3, now_cost: 50, gem_score: 0.1, xPts_1gw: 1.0 })
    const strongCandidate = makeScoredPlayer({ id: 100, element_type: 3, now_cost: 50, gem_score: 0.9, xPts_1gw: 9.0 })
    const picks = [makeSquadPick(1, 1), ...Array.from({ length: 14 }, (_, i) => makeSquadPick(i + 2, i + 2))]
    const allPlayers = [weakPlayer, ...Array.from({ length: 14 }, (_, i) => makeScoredPlayer({ id: i + 2 })), strongCandidate]
    const ftState: FTState = { available: 1, banked: 0 }
    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)
    expect(result.steps[0].transfersIn).toContain(100)
    // Bought player 100 should have position 1 (was player 1's position)
    expect(result.steps[0].positionsAfter[100]).toBe(1)
    // Sold player 1 should NOT be in positionsAfter
    expect(result.steps[0].positionsAfter[1]).toBeUndefined()
  })

  it('hold step has positionsAfter with all 15 player IDs', () => {
    const picks = makeDefaultSquad([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
    const allPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({
        id: i + 1,
        fixtures: [{ opponent_team: 'ARS', is_home: true, event_id: 34, difficulty_score: 0.5, difficulty_tier: 'medium' }],
      })
    )
    const ftState: FTState = { available: 1, banked: 0 }
    const result = generatePlan(picks, allPlayers, 1, 34, ftState, 0)
    // All players equal quality -> hold step
    expect(result.steps[0].transfersIn).toHaveLength(0)
    expect(Object.keys(result.steps[0].positionsAfter)).toHaveLength(15)
  })
})
