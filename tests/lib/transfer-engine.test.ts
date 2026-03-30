import { describe, it, expect } from 'vitest'
import { computeTransferSuggestions } from '@/lib/transfer-engine'
import type { ChipState } from '@/lib/transfer-engine'
import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Test factory helpers
// ---------------------------------------------------------------------------

function makeScoredPlayer(overrides: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    // MergedPlayer base
    id: 1,
    web_name: 'Test',
    team: 1,
    team_short_name: 'TST',
    element_type: 3,          // MID by default
    now_cost: 70,             // 7.0m
    selected_by_percent: '10.0',
    form: '5.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
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
    // ScoredPlayer dimensions
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
// Build a minimal 15-pick squad (11 starters + 4 bench) for use in tests
// ---------------------------------------------------------------------------
function makeSquadOf15(overrides: Partial<SquadPick>[] = []): SquadPick[] {
  return Array.from({ length: 15 }, (_, i) => ({
    element: i + 1,
    position: i + 1,
    multiplier: i < 11 ? 1 : 0,
    is_captain: i === 0,
    is_vice_captain: i === 1,
    ...overrides[i],
  }))
}

// ---------------------------------------------------------------------------
// CHIP GUARD TESTS
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — chip guard', () => {
  it('returns CHIP_WARNING with chip=freehit when activeChip is "freehit"', () => {
    const result = computeTransferSuggestions([], [], 0, 1, 'freehit')
    expect(result.type).toBe('CHIP_WARNING')
    expect(result.chip).toBe('freehit')
  })

  it('returns CHIP_WARNING with chip=wildcard when activeChip is "wildcard"', () => {
    const result = computeTransferSuggestions([], [], 0, 1, 'wildcard')
    expect(result.type).toBe('CHIP_WARNING')
    expect(result.chip).toBe('wildcard')
  })

  it('does NOT trigger chip warning when activeChip is "bboost"', () => {
    // bboost does not block transfers
    const picks = makeSquadOf15()
    const players = picks.map(p =>
      makeScoredPlayer({ id: p.element, element_type: 3, gem_score: 0.5 })
    )
    const result = computeTransferSuggestions(picks, players, 0, 1, 'bboost')
    expect(result.type).not.toBe('CHIP_WARNING')
  })

  it('does NOT trigger chip warning when activeChip is null', () => {
    const picks = makeSquadOf15()
    const players = picks.map(p =>
      makeScoredPlayer({ id: p.element, element_type: 3, gem_score: 0.5 })
    )
    const result = computeTransferSuggestions(picks, players, 0, 1, null)
    expect(result.type).not.toBe('CHIP_WARNING')
  })
})

// ---------------------------------------------------------------------------
// SELL CANDIDATE TESTS (TRF-01)
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — sell candidates (TRF-01)', () => {
  it('only starting XI players (position 1-11) are sell candidates; bench (12-15) are excluded', () => {
    // Bench player (position 12) has the worst gem_score — should NOT be in suggestions
    const benchPlayer = makeScoredPlayer({ id: 12, element_type: 3, gem_score: 0.0 })
    const picks: SquadPick[] = [
      ...Array.from({ length: 11 }, (_, i) => makeSquadPick({ element: i + 1, position: i + 1 })),
      makeSquadPick({ element: 12, position: 12 }), // bench
      makeSquadPick({ element: 13, position: 13 }),
      makeSquadPick({ element: 14, position: 14 }),
      makeSquadPick({ element: 15, position: 15 }),
    ]
    const players = [
      ...Array.from({ length: 11 }, (_, i) => makeScoredPlayer({ id: i + 1, element_type: 3, gem_score: 0.5 + i * 0.01 })),
      makeScoredPlayer({ id: 12, element_type: 3, gem_score: 0.0 }), // bench — worst but excluded
      makeScoredPlayer({ id: 13, element_type: 3, gem_score: 0.4 }),
      makeScoredPlayer({ id: 14, element_type: 3, gem_score: 0.4 }),
      makeScoredPlayer({ id: 15, element_type: 3, gem_score: 0.4 }),
    ]
    // Add a potential replacement (not in squad)
    players.push(makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.9 }))

    const result = computeTransferSuggestions(picks, players, 0, 1, null)
    if (result.type === 'SUGGESTIONS') {
      const sellIds = result.suggestions?.map(s => s.sell.id) ?? []
      expect(sellIds).not.toContain(12) // bench player not a sell candidate
    }
  })

  it('sell candidates are ordered by gem_score ascending (worst gem first)', () => {
    // Build a squad where we can identify the worst player
    const picks: SquadPick[] = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
      makeSquadPick({ element: 3, position: 3 }),
    ]
    const sqPlayers = [
      makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.8 }),
      makeScoredPlayer({ id: 2, element_type: 3, gem_score: 0.3 }), // worst — should be first sell candidate
      makeScoredPlayer({ id: 3, element_type: 3, gem_score: 0.6 }),
    ]
    const replacement = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.95 })
    const result = computeTransferSuggestions(picks, [...sqPlayers, replacement], 0, 1, null)
    expect(result.type).toBe('SUGGESTIONS')
    // The first suggestion should have sell.id === 2 (worst gem_score)
    expect(result.suggestions?.[0].sell.id).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// REPLACEMENT TESTS (TRF-02, TRF-03)
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — replacements (TRF-02, TRF-03)', () => {
  it('all replacements for a DEF sell candidate have element_type=2', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const defender = makeScoredPlayer({ id: 1, element_type: 2, gem_score: 0.2 })
    const replacements = [
      makeScoredPlayer({ id: 10, element_type: 2, gem_score: 0.9 }), // DEF — valid
      makeScoredPlayer({ id: 11, element_type: 3, gem_score: 0.9 }), // MID — invalid
      makeScoredPlayer({ id: 12, element_type: 4, gem_score: 0.9 }), // FWD — invalid
      makeScoredPlayer({ id: 13, element_type: 1, gem_score: 0.9 }), // GK  — invalid
    ]
    const result = computeTransferSuggestions(
      picks,
      [defender, ...replacements],
      0,
      1,
      null,
    )
    expect(result.type).toBe('SUGGESTIONS')
    for (const s of result.suggestions ?? []) {
      if (s.sell.id === 1) {
        expect(s.buy.element_type).toBe(2)
      }
    }
  })

  it('no replacement is a player already in the squad', () => {
    const picks = makeSquadOf15()
    // squad members IDs 1-15
    const squadPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({ id: i + 1, element_type: 3, gem_score: 0.4 + i * 0.01 })
    )
    // Player ID 5 is in the squad — should never appear as a buy candidate
    const nonSquadPlayer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.99 })
    const result = computeTransferSuggestions(
      picks,
      [...squadPlayers, nonSquadPlayer],
      0,
      1,
      null,
    )
    for (const s of result.suggestions ?? []) {
      expect(picks.map(p => p.element)).not.toContain(s.buy.id)
    }
  })

  it('at most 3 replacements per sell candidate', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.2 })
    // 5 potential replacements
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeScoredPlayer({ id: 10 + i, element_type: 3, gem_score: 0.7 + i * 0.01 })
    )
    const result = computeTransferSuggestions(
      picks,
      [seller, ...candidates],
      0,
      1,
      null,
    )
    expect(result.type).toBe('SUGGESTIONS')
    const forSeller = (result.suggestions ?? []).filter(s => s.sell.id === 1)
    expect(forSeller.length).toBeLessThanOrEqual(3)
  })

  it('replacements for a given sell candidate are sorted by gem_score descending', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.2 })
    const candidates = [
      makeScoredPlayer({ id: 10, element_type: 3, gem_score: 0.6 }),
      makeScoredPlayer({ id: 11, element_type: 3, gem_score: 0.9 }),
      makeScoredPlayer({ id: 12, element_type: 3, gem_score: 0.75 }),
    ]
    const result = computeTransferSuggestions(
      picks,
      [seller, ...candidates],
      0,
      1,
      null,
    )
    expect(result.type).toBe('SUGGESTIONS')
    const forSeller = (result.suggestions ?? []).filter(s => s.sell.id === 1)
    // gem_deltas should be descending (best buy first)
    for (let i = 1; i < forSeller.length; i++) {
      expect(forSeller[i - 1].gem_delta).toBeGreaterThanOrEqual(forSeller[i].gem_delta)
    }
  })

  it('gem_delta equals buy.gem_score minus sell.gem_score', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.3 })
    const buyer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.8 })
    const result = computeTransferSuggestions(picks, [seller, buyer], 0, 1, null)
    expect(result.type).toBe('SUGGESTIONS')
    const s = result.suggestions?.[0]
    expect(s?.gem_delta).toBeCloseTo(0.8 - 0.3)
  })
})

// ---------------------------------------------------------------------------
// BUDGET TESTS (TRF-04)
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — budget (TRF-04)', () => {
  it('available_budget equals bankBalance/10 + sell.now_cost/10', () => {
    // bankBalance raw = 20 (2.0m), sell.now_cost = 70 (7.0m) → available = 9.0
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.3, now_cost: 70 })
    const buyer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.8, now_cost: 80 })
    const result = computeTransferSuggestions(picks, [seller, buyer], 20, 1, null)
    expect(result.type).toBe('SUGGESTIONS')
    const s = result.suggestions?.[0]
    expect(s?.available_budget).toBeCloseTo(20 / 10 + 70 / 10) // 9.0
  })

  it('budget_sufficient is true when buy.now_cost/10 <= available_budget', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.3, now_cost: 70 })
    // buyer costs 8.0m, available = 2.0 + 7.0 = 9.0 → sufficient
    const buyer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.8, now_cost: 80 })
    const result = computeTransferSuggestions(picks, [seller, buyer], 20, 1, null)
    expect(result.suggestions?.[0].budget_sufficient).toBe(true)
  })

  it('budget_sufficient is false when buy.now_cost/10 > available_budget', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.3, now_cost: 70 })
    // buyer costs 15.0m, available = 0 + 7.0 = 7.0 → NOT sufficient
    const buyer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.8, now_cost: 150 })
    const result = computeTransferSuggestions(picks, [seller, buyer], 0, 1, null)
    expect(result.suggestions?.[0].budget_sufficient).toBe(false)
  })

  it('unaffordable suggestions are still returned (budget_sufficient=false) but sorted below affordable ones', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const seller = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.3, now_cost: 70 })
    // affordable buyer: 7.0m, available = 7.0
    const affordBuyer = makeScoredPlayer({ id: 98, element_type: 3, gem_score: 0.7, now_cost: 70 })
    // unaffordable buyer: 15.0m > 7.0 available, but higher gem_score
    const expBuyer = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.9, now_cost: 150 })
    const result = computeTransferSuggestions(picks, [seller, affordBuyer, expBuyer], 0, 1, null)
    expect(result.type).toBe('SUGGESTIONS')
    // Both should be present
    const buyIds = result.suggestions?.map(s => s.buy.id)
    expect(buyIds).toContain(98)
    expect(buyIds).toContain(99)
    // affordable one should appear before unaffordable one
    const affordIdx = buyIds?.indexOf(98) ?? -1
    const expIdx = buyIds?.indexOf(99) ?? -1
    expect(affordIdx).toBeLessThan(expIdx)
  })
})

// ---------------------------------------------------------------------------
// MULTI-TRANSFER TESTS (TRF-05)
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — multi-transfer combo (TRF-05)', () => {
  it('two_transfer_combo is populated when freeTransfers >= 2', () => {
    const picks: SquadPick[] = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]
    const players = [
      makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.2 }),
      makeScoredPlayer({ id: 2, element_type: 3, gem_score: 0.25 }),
      makeScoredPlayer({ id: 98, element_type: 3, gem_score: 0.9 }),
      makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.85 }),
    ]
    const result = computeTransferSuggestions(picks, players, 0, 2, null)
    expect(result.type).toBe('SUGGESTIONS')
    expect(result.two_transfer_combo).toBeDefined()
    expect(result.two_transfer_combo).toHaveLength(2)
  })

  it('two_transfer_combo uses two different buy targets (no duplicate buys)', () => {
    const picks: SquadPick[] = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]
    const players = [
      makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.2 }),
      makeScoredPlayer({ id: 2, element_type: 3, gem_score: 0.25 }),
      makeScoredPlayer({ id: 98, element_type: 3, gem_score: 0.9 }),
      makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.85 }),
    ]
    const result = computeTransferSuggestions(picks, players, 0, 2, null)
    const combo = result.two_transfer_combo
    expect(combo).toBeDefined()
    if (combo) {
      expect(combo[0].buy.id).not.toBe(combo[1].buy.id)
    }
  })

  it('two_transfer_combo sells two different players', () => {
    const picks: SquadPick[] = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]
    const players = [
      makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.2 }),
      makeScoredPlayer({ id: 2, element_type: 3, gem_score: 0.25 }),
      makeScoredPlayer({ id: 98, element_type: 3, gem_score: 0.9 }),
      makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.85 }),
    ]
    const result = computeTransferSuggestions(picks, players, 0, 2, null)
    const combo = result.two_transfer_combo
    expect(combo).toBeDefined()
    if (combo) {
      expect(combo[0].sell.id).not.toBe(combo[1].sell.id)
    }
  })

  it('two_transfer_combo is undefined when freeTransfers === 1', () => {
    const picks: SquadPick[] = [
      makeSquadPick({ element: 1, position: 1 }),
      makeSquadPick({ element: 2, position: 2 }),
    ]
    const players = [
      makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.2 }),
      makeScoredPlayer({ id: 2, element_type: 3, gem_score: 0.25 }),
      makeScoredPlayer({ id: 98, element_type: 3, gem_score: 0.9 }),
      makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.85 }),
    ]
    const result = computeTransferSuggestions(picks, players, 0, 1, null)
    expect(result.two_transfer_combo).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// SAVE RECOMMENDATION TESTS (TRF-06)
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — save recommendation (TRF-06)', () => {
  it('returns type SAVE with message containing "save" when all gem_delta <= 0', () => {
    // All potential buys have lower gem_score than squad members
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const squadPlayer = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.9 })
    const candidate = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.5 }) // worse than squad
    const result = computeTransferSuggestions(picks, [squadPlayer, candidate], 0, 1, null)
    expect(result.type).toBe('SAVE')
    expect(result.message?.toLowerCase()).toContain('save')
  })

  it('returns type SUGGESTIONS when at least one gem_delta > 0', () => {
    const picks: SquadPick[] = [makeSquadPick({ element: 1, position: 1 })]
    const squadPlayer = makeScoredPlayer({ id: 1, element_type: 3, gem_score: 0.3 })
    const candidate = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.8 }) // better
    const result = computeTransferSuggestions(picks, [squadPlayer, candidate], 0, 1, null)
    expect(result.type).toBe('SUGGESTIONS')
  })
})

// ---------------------------------------------------------------------------
// DUPLICATE PREVENTION (Pitfall 5)
// ---------------------------------------------------------------------------

describe('computeTransferSuggestions — duplicate prevention', () => {
  it('a player already in the squad never appears as a buy candidate', () => {
    const picks = makeSquadOf15()
    // All 15 positions filled; squad IDs 1-15
    const squadPlayers = Array.from({ length: 15 }, (_, i) =>
      makeScoredPlayer({ id: i + 1, element_type: 3, gem_score: 0.4 + i * 0.01 })
    )
    // Only non-squad player available
    const outsider = makeScoredPlayer({ id: 99, element_type: 3, gem_score: 0.99 })
    const allPlayers = [...squadPlayers, outsider]

    const result = computeTransferSuggestions(picks, allPlayers, 0, 1, null)
    const squadElementIds = new Set(picks.map(p => p.element))
    for (const s of result.suggestions ?? []) {
      expect(squadElementIds.has(s.buy.id)).toBe(false)
    }
  })
})
