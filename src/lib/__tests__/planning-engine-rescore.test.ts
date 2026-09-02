import { describe, it, expect } from 'vitest'
import { generatePlanFrom, squadPicksFromStep, ftStateAfterStepIndex } from '../planning-engine'
import type { ScoredPlayer, FTState } from '../types'
import type { SquadPick } from '../squad-adapter'

// ---------------------------------------------------------------------------
// Minimal mock helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<ScoredPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }): ScoredPlayer {
  return {
    id: overrides.id,
    web_name: overrides.web_name ?? `Player${overrides.id}`,
    team: overrides.team ?? 1,
    team_short_name: 'TST',
    element_type: overrides.element_type,
    now_cost: overrides.now_cost ?? 60,
    selected_by_percent: '5.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 80,
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
    fixtures: overrides.fixtures ?? [
      { opponent_team: 'OPP', is_home: true, event_id: 30, difficulty_score: 0.3, difficulty_tier: 'easy' },
      { opponent_team: 'OPP', is_home: true, event_id: 31, difficulty_score: 0.3, difficulty_tier: 'easy' },
      { opponent_team: 'OPP', is_home: true, event_id: 32, difficulty_score: 0.3, difficulty_tier: 'easy' },
    ],
    xPts_1gw: overrides.xPts_1gw ?? 5.0,
    xmins: 90,
    start_prob: 1.0,
    mins_risk: 'nailed',
    gem_score: overrides.gem_score ?? 0.5,
    merit_score: 0.5,
    fdr_score: 0.5,
    form_score: 0.5,
    xg_score: null,
    xa_score: null,
    ownership_score: 0.5,
    minutes_score: 0.5,
    set_piece_score: 0.0,
  }
}

/** Build a minimal 15-player squad (11 starters + 4 bench) of GKs/DEFs/MIDs/FWDs */
function makeSquadPicks(): SquadPick[] {
  // 1 GK (pos 1), 4 DEF (pos 2-5), 4 MID (pos 6-9), 2 FWD (pos 10-11),
  // 1 bench GK (pos 12), 1 bench DEF (pos 13), 1 bench MID (pos 14), 1 bench FWD (pos 15)
  return [
    { element: 1, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 3, position: 3, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 4, position: 4, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 5, position: 5, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 6, position: 6, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 7, position: 7, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 8, position: 8, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 9, position: 9, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 12, position: 12, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 13, position: 13, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 14, position: 14, multiplier: 1, is_captain: false, is_vice_captain: false },
    { element: 15, position: 15, multiplier: 1, is_captain: false, is_vice_captain: false },
  ]
}

function makeSquadPlayers(): ScoredPlayer[] {
  // 1 GK, 5 DEF, 5 MID, 4 FWD (15 players)
  return [
    makePlayer({ id: 1, element_type: 1 }),
    makePlayer({ id: 2, element_type: 2 }),
    makePlayer({ id: 3, element_type: 2 }),
    makePlayer({ id: 4, element_type: 2 }),
    makePlayer({ id: 5, element_type: 2 }),
    makePlayer({ id: 6, element_type: 3 }),
    makePlayer({ id: 7, element_type: 3 }),
    makePlayer({ id: 8, element_type: 3 }),
    makePlayer({ id: 9, element_type: 3 }),
    makePlayer({ id: 10, element_type: 4 }),
    makePlayer({ id: 11, element_type: 4 }),
    makePlayer({ id: 12, element_type: 1 }),
    makePlayer({ id: 13, element_type: 2 }),
    makePlayer({ id: 14, element_type: 3 }),
    makePlayer({ id: 15, element_type: 4 }),
  ]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generatePlanFrom', () => {
  it('Test 1: 2-step horizon from a mid-plan squad returns 2 PlanStep objects with correct gw numbers', () => {
    const picks = makeSquadPicks()
    const players = makeSquadPlayers()
    const ftState: FTState = { available: 1, banked: 0 }

    const steps = generatePlanFrom(picks, players, 2, 30, ftState, 50)

    expect(steps).toHaveLength(2)
    expect(steps[0].gw).toBe(30)
    expect(steps[1].gw).toBe(31)
  })

  it('Test 4: horizon 0 returns empty steps array', () => {
    const picks = makeSquadPicks()
    const players = makeSquadPlayers()
    const ftState: FTState = { available: 1, banked: 0 }

    const steps = generatePlanFrom(picks, players, 0, 30, ftState, 50)

    expect(steps).toHaveLength(0)
  })
})

describe('FT state propagation via ftStateAfterStepIndex', () => {
  it('Test 2: if step X used 1 free transfer, step X+1 should have freeTransfersAvailable=1 (banked=0)', () => {
    // Use ftStateAfterStepIndex directly with a synthetic step array to test
    // FT propagation logic without relying on the engine choosing to transfer.
    // Synthetic step: 1 transfer used (transfersIn.length === 1), no chip.
    const syntheticSteps = [
      {
        gw: 30,
        chip: null,
        transfersIn: [99],  // 1 transfer used
        transfersOut: [1],
        freeTransfersAvailable: 1,
        hitCost: 0,
        scoredTransfers: [],
        squadAfter: [99, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        positionsAfter: {},
        unconfirmedFixtures: false,
      } as Parameters<typeof ftStateAfterStepIndex>[0][0],
    ]

    const ftState: FTState = { available: 1, banked: 0 }
    // After step 0 with 1 transfer used from available=1:
    // unused = max(0, 1-1) = 0, banked = min(1, 0) = 0, next available = 1+0 = 1
    const ftAfterStep0 = ftStateAfterStepIndex(syntheticSteps, 0, ftState)
    expect(ftAfterStep0.available).toBe(1)
    expect(ftAfterStep0.banked).toBe(0)
  })

  it('Test 3: if step X held (0 transfers used), step X+1 should have freeTransfersAvailable=2 (banked=1)', () => {
    // We need a scenario where no transfer is made (hold).
    // If we supply a squad with very high xPts players, no swap will have positive netGain.
    const picks = makeSquadPicks()

    // Squad players all have xPts=10 and same cost, no outside player can beat them
    const squadPlayers = makeSquadPlayers().map(p => ({
      ...p,
      xPts_1gw: 10.0,
      gem_score: 0.8,
    }))

    // Outside candidates with low xPts — no positive netGain possible
    const outsider = makePlayer({ id: 100, element_type: 2, xPts_1gw: 1.0, gem_score: 0.1 })
    const allPlayers = [...squadPlayers, outsider]

    const ftState: FTState = { available: 1, banked: 0 }
    const steps = generatePlanFrom(picks, allPlayers, 2, 30, ftState, 50)

    expect(steps).toHaveLength(2)

    // Find a hold step (transfersIn.length === 0)
    const holdSteps = steps.filter(s => s.transfersIn.length === 0)
    expect(holdSteps.length).toBeGreaterThan(0)

    const holdStepIndex = steps.findIndex(s => s.transfersIn.length === 0)
    const ftAfterHold = ftStateAfterStepIndex(steps, holdStepIndex, ftState)
    // After holding (0 transfers used from available=1): unused=1, banked=min(1,1)=1, next=2
    expect(ftAfterHold.available).toBe(2)
    expect(ftAfterHold.banked).toBe(1)
  })
})

describe('squadPicksFromStep', () => {
  it('returns SquadPick array matching step squadAfter with correct element IDs', () => {
    const picks = makeSquadPicks()
    const players = makeSquadPlayers()
    const ftState: FTState = { available: 1, banked: 0 }

    const steps = generatePlanFrom(picks, players, 1, 30, ftState, 50)
    expect(steps).toHaveLength(1)

    const resultPicks = squadPicksFromStep(steps[0])
    expect(resultPicks).toHaveLength(steps[0].squadAfter.length)

    // Each element in resultPicks should match squadAfter IDs
    const resultIds = resultPicks.map(p => p.element).sort((a, b) => a - b)
    const expectedIds = [...steps[0].squadAfter].sort((a, b) => a - b)
    expect(resultIds).toEqual(expectedIds)

    // Each pick should have correct fields
    for (const pick of resultPicks) {
      expect(typeof pick.element).toBe('number')
      expect(typeof pick.position).toBe('number')
      expect(pick.multiplier).toBe(1)
      expect(pick.is_captain).toBe(false)
      expect(pick.is_vice_captain).toBe(false)
    }
  })
})
