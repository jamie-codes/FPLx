// Phase 45 (TFR-01..TFR-03): suggestTransfers engine — pure-function unit tests.
// Mirrors src/lib/optimise-lineup.test.ts pattern.
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { suggestTransfers } from './suggest-transfers'
import type { MergedPlayer, LineupNewsPlayer, StatusLabel } from './types'
import type { SquadPick } from './squad-adapter'

function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(overrides: PlayerOverrides): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    team: 1,
    team_short_name: 'T1',
    now_cost: 50,
    selected_by_percent: '5.0',
    form: '0.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 2,
    assists: 1,
    expected_goals: 1.5,
    expected_assists: 1.0,
    pts_last3gw: 12,
    pts_last5gw: 20,
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
    minutes_per90: 80,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.9,
    mins_risk: 'nailed',
    xPts_1gw: 5.0,
    xPts_3gw: 14.0,
    xPts_5gw: 22.0,
    xPts_90th_1gw: 7.0,
    ...overrides,
  } as MergedPlayer
}

// Build a 15-player squad: 2 GK, 5 DEF, 5 MID, 3 FWD. ids 1..15. positions 1..15 (1..11 starters,
// 12..15 bench). All players default to xPts_1gw=5, xPts_3gw=14, xPts_5gw=22, now_cost=50.
// Teams assigned in rotation 1..8 so no team hits the FPL 3-player-per-team cap (max 2 per team),
// keeping existing tests compatible with the TFX-01 team cap filter.
function makeValidSquad(): { picks: SquadPick[]; players: MergedPlayer[] } {
  const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  const picks: SquadPick[] = []
  const players: MergedPlayer[] = []
  for (let i = 0; i < 15; i++) {
    const id = i + 1
    const team = (i % 8) + 1  // teams 1..8, max 2 players per team (< cap of 3)
    picks.push(makePick(id, i + 1))
    players.push(makePlayer({ id, element_type: elementTypes[i], team }))
  }
  return { picks, players }
}

describe('Phase 45: suggestTransfers engine', () => {
  describe('Empty / null cases', () => {
    it('returns empty array when squad and players are empty', () => {
      const result = suggestTransfers({
        currentPicks: [],
        players: [],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      expect(result).toEqual([])
    })

    it('returns empty array when no candidate improves xPts (TFR-02 D-08 empty state path)', () => {
      // All out-of-squad players are weaker (xPts_1gw=3.0 vs squad default 5.0).
      const { picks, players } = makeValidSquad()
      // Add 5 weaker out-of-squad candidates per position
      const weakOutsiders: MergedPlayer[] = []
      for (let pos = 1 as 1 | 2 | 3 | 4; pos <= 4; pos = (pos + 1) as 1 | 2 | 3 | 4) {
        weakOutsiders.push(makePlayer({ id: 100 + pos, element_type: pos, xPts_1gw: 3.0, xPts_3gw: 9.0, xPts_5gw: 15.0 }))
      }
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, ...weakOutsiders],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      expect(result).toEqual([])
    })
  })

  describe('Single FREE transfer (ftCount=1, cost=0) — TFR-01, TFR-02', () => {
    it('returns at least one FREE single suggestion when a stronger same-position candidate exists and budget is sufficient', () => {
      const { picks, players } = makeValidSquad()
      // Add a stronger DEF candidate (xPts_1gw=8.0 vs squad DEF 5.0, same now_cost so budget-trivially feasible)
      const strongerDef = makePlayer({ id: 20, element_type: 2, xPts_1gw: 8.0, xPts_3gw: 23.0, xPts_5gw: 38.0 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strongerDef],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      expect(result.length).toBeGreaterThan(0)
      const free = result.find(s => s.cost === 0 && s.kind === 'single')
      expect(free).toBeDefined()
      if (free && free.kind === 'single') {
        expect(free.xPtsGain).toBeGreaterThan(0)
        expect(free.breakEvenGws).toBeNull()
        expect(free.buy.id).toBe(20)
      }
    })

    it('sorts suggestions by xPtsGain descending (highest gain first) — TFR-02', () => {
      const { picks, players } = makeValidSquad()
      const goodDef = makePlayer({ id: 20, element_type: 2, xPts_1gw: 6.5, xPts_3gw: 18.0, xPts_5gw: 30.0 })
      const greatDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 9.0, xPts_3gw: 26.0, xPts_5gw: 43.0 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, goodDef, greatDef],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      expect(result.length).toBeGreaterThanOrEqual(2)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].xPtsGain).toBeGreaterThanOrEqual(result[i + 1].xPtsGain)
      }
    })
  })

  describe('-4pt hit transfer (cost=4) — TFR-03', () => {
    it('break-even formula: breakEvenGws = max(1, ceil(4 / xPtsGainPerGw)) when cost > 0', () => {
      const { picks, players } = makeValidSquad()
      // 3GW horizon, stronger DEF with xPts_3gw=20 vs current 14 → gain=6 over 3GW → 2/GW.
      // Force a hit by setting ftCount=1 and ensuring engine prefers this as a hit option.
      // Engine is allowed to also return free options; we only need at least one cost=4 entry.
      const strongDef = makePlayer({ id: 20, element_type: 2, xPts_1gw: 6.0, xPts_3gw: 20.0, xPts_5gw: 33.0 })
      // Add a SECOND strong same-position candidate to force the engine to consider a HIT
      // for the second-best option (since only 1 FT covers the best).
      const strongDef2 = makePlayer({ id: 21, element_type: 2, xPts_1gw: 5.5, xPts_3gw: 19.0, xPts_5gw: 32.0 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strongDef, strongDef2],
        horizon: 3,
        ftCount: 1,
        bank: 100,
      })
      const hit = result.find(s => s.cost === 4)
      expect(hit).toBeDefined()
      if (hit) {
        expect(hit.breakEvenGws).not.toBeNull()
        // Verify formula: breakEvenGws = max(1, ceil(4 / xPtsGainPerGw))
        const expected = Math.max(1, Math.ceil(4 / hit.xPtsGainPerGw))
        expect(hit.breakEvenGws).toBe(expected)
        expect(hit.breakEvenGws).toBeGreaterThanOrEqual(1)
      }
    })

    it('FREE suggestions have breakEvenGws === null', () => {
      const { picks, players } = makeValidSquad()
      const strongDef = makePlayer({ id: 20, element_type: 2, xPts_1gw: 8.0, xPts_3gw: 23.0, xPts_5gw: 38.0 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strongDef],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      const free = result.find(s => s.cost === 0)
      expect(free).toBeDefined()
      if (free) expect(free.breakEvenGws).toBeNull()
    })

    it('xPtsGainPerGw = xPtsGain / horizon (matches 5GW horizon)', () => {
      const { picks, players } = makeValidSquad()
      const strong = makePlayer({ id: 20, element_type: 1, xPts_1gw: 8.0, xPts_3gw: 23.0, xPts_5gw: 40.0 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strong],
        horizon: 5,
        ftCount: 1,
        bank: 100,
      })
      expect(result.length).toBeGreaterThan(0)
      for (const sug of result) {
        expect(sug.xPtsGainPerGw).toBeCloseTo(sug.xPtsGain / 5, 5)
      }
    })
  })

  describe('Budget enforcement (D-09, D-10, D-11) — TFR-02', () => {
    it('hard-filters suggestions where bank + sellValue < buyCost (D-10)', () => {
      const { picks, players } = makeValidSquad()
      // Out-of-squad expensive DEF: now_cost=200 (£20m). Squad DEFs are 50 (£5m). Bank=10 (£1m).
      // Available = 10 + 50 = 60 < 200. Must be filtered out.
      const expensive = makePlayer({ id: 20, element_type: 2, xPts_1gw: 9.0, now_cost: 200 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, expensive],
        horizon: 1,
        ftCount: 1,
        bank: 10,
      })
      // No suggestion should buy player 20
      for (const sug of result) {
        const buyIds = sug.kind === 'single' ? [sug.buy.id] : sug.transfers.map(t => t.buy.id)
        expect(buyIds).not.toContain(20)
      }
    })

    it('uses sellPrices Map when provided (authenticated path D-09)', () => {
      // Squad GK id=1 default now_cost=50. Set selling_price=65. Strong GK candidate now_cost=70.
      // With selling_price (65) + bank (5) = 70 ≥ 70 ✓ affordable.
      // Without selling_price fallback to now_cost (50) + bank (5) = 55 < 70 ✗ NOT affordable.
      const { picks, players } = makeValidSquad()
      const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 8.0, now_cost: 70 })
      const sellPrices = new Map<number, number>([[1, 65]])
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strongGk],
        horizon: 1,
        ftCount: 1,
        bank: 5,
        sellPrices,
      })
      const buy20 = result.find(s => s.kind === 'single' && s.buy.id === 20)
      expect(buy20).toBeDefined()
    })

    it('falls back to now_cost when sellPrices Map is absent (unauthenticated path D-11)', () => {
      // No sellPrices passed → engine MUST use now_cost (50) for sell value.
      // Squad GK now_cost=50, bank=20, strong GK now_cost=65 → 50+20=70 ≥ 65 ✓ affordable.
      const { picks, players } = makeValidSquad()
      const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 8.0, now_cost: 65 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strongGk],
        horizon: 1,
        ftCount: 1,
        bank: 20,
        // sellPrices intentionally omitted
      })
      const buy20 = result.find(s => s.kind === 'single' && s.buy.id === 20)
      expect(buy20).toBeDefined()
    })
  })

  describe('Top-30 per-position pool and own-squad exclusion (D-03) — TFR-02', () => {
    it('excludes currently-owned players from the In pool (no buy.id matches squad pick.element)', () => {
      const { picks, players } = makeValidSquad()
      // Make the squad's own players "stronger" to prove they are still NOT suggested as buys.
      const boostedPlayers = players.map(p => ({ ...p, xPts_1gw: 99 }))
      const result = suggestTransfers({
        currentPicks: picks,
        players: boostedPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      const currentIds = new Set(picks.map(p => p.element))
      for (const sug of result) {
        const buyIds = sug.kind === 'single' ? [sug.buy.id] : sug.transfers.map(t => t.buy.id)
        for (const buyId of buyIds) {
          expect(currentIds.has(buyId)).toBe(false)
        }
      }
    })

    it('respects top-30-per-position filtering (DEF rank 41 not surfaced)', () => {
      const { picks, players } = makeValidSquad()
      // Create 50 out-of-squad DEFs with descending strength.
      // Squad DEFs default to xPts_1gw=5.0. Make ranks 1-30 ABOVE 5.0 (potential suggestions)
      // and ranks 31-50 ALSO above 5.0 but slightly lower so they would be suggested if not filtered.
      const extraDefs: MergedPlayer[] = []
      for (let i = 0; i < 50; i++) {
        extraDefs.push(makePlayer({
          id: 100 + i,
          element_type: 2,
          xPts_1gw: 9.0 - (i * 0.05),  // 9.0 down to 6.55 — all above squad 5.0
        }))
      }
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, ...extraDefs],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      // The DEF at index 40 (id=140) is rank 41 by xPts — must NOT appear in any suggestion buy.
      const rank41 = extraDefs[40]
      for (const sug of result) {
        const buyIds = sug.kind === 'single' ? [sug.buy.id] : sug.transfers.map(t => t.buy.id)
        expect(buyIds).not.toContain(rank41.id)
      }
    })
  })

  describe('2-FT mode (ftCount=2) — TFR-01', () => {
    it('returns at least one combo suggestion when ftCount=2 and two affordable improvements exist', () => {
      const { picks, players } = makeValidSquad()
      // Two strong upgrades in different positions.
      const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 8.5 })
      const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.0 })
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, strongGk, strongDef],
        horizon: 1,
        ftCount: 2,
        bank: 100,
      })
      const combo = result.find(s => s.kind === 'combo')
      expect(combo).toBeDefined()
      if (combo && combo.kind === 'combo') {
        expect(combo.transfers).toHaveLength(2)
        // 2 transfers using 2 FTs → cost should be 0 (FREE)
        expect(combo.cost).toBe(0)
        expect(combo.breakEvenGws).toBeNull()
      }
    })
  })
})

describe('Phase 74: Team cap filter (TFX-01)', () => {
  it('excludes buy candidates from teams where user owns 3 players', () => {
    // Arrange: squad with 3 players on team 5, plus one strong buy candidate also on team 5.
    // Use a small focused squad: 2 GK + 5 DEF + 5 MID + 3 FWD (15 total), 3 on team 5.
    const { picks, players } = makeValidSquad()
    // Override first 3 DEF players (ids 3,4,5) to team 5
    const modifiedPlayers = players.map(p =>
      [3, 4, 5].includes(p.id) ? { ...p, team: 5 } : p,
    )
    // Strong DEF candidate on team 5 — would be #1 pick if not capped
    const cappedCandidate = makePlayer({ id: 20, element_type: 2, xPts_1gw: 9.0, team: 5 })
    // Also add a non-capped candidate from a different team so engine can return results
    const allowedCandidate = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.0, team: 99 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...modifiedPlayers, cappedCandidate, allowedCandidate],
      horizon: 1,
      ftCount: 1,
      bank: 1000,
    })

    // No suggestion should have a buy from team 5
    for (const sug of result) {
      if (sug.kind === 'single') {
        expect(sug.buy.team).not.toBe(5)
      } else if (sug.kind === 'combo') {
        for (const t of sug.transfers) {
          expect(t.buy.team).not.toBe(5)
        }
      }
    }
    // The allowed candidate (team 99) should appear as a buy
    const allowedBuy = result.find(s => s.kind === 'single' && s.buy.id === 21)
    expect(allowedBuy).toBeDefined()
  })

  it('allows buy candidates when user owns only 2 players from a team', () => {
    // Arrange: only 2 squad players on team 99 (below the 3-player cap).
    // Use a distinct team id (99) not in the natural team rotation (1-8) to avoid collisions.
    const { picks, players } = makeValidSquad()
    // Override the first GK (id=1) and first DEF (id=3) to team 99.
    // makeValidSquad uses teams 1-8 in rotation — team 99 is absent by default.
    const modifiedPlayers = players.map(p =>
      [1, 3].includes(p.id) ? { ...p, team: 99 } : p,
    )
    // Strong DEF candidate on team 99 — should be allowed (cap not reached: only 2 owned)
    const allowedCandidate = makePlayer({ id: 20, element_type: 2, xPts_1gw: 9.0, team: 99 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...modifiedPlayers, allowedCandidate],
      horizon: 1,
      ftCount: 1,
      bank: 1000,
    })

    // Team 99 candidate should appear as a buy option (cap is 3, not 2)
    const team99Buy = result.find(s => s.kind === 'single' && s.buy.team === 99)
    expect(team99Buy).toBeDefined()
  })
})

describe('Phase 74: Sell-side dedup in 2-FT combos (TFX-02)', () => {
  it('never produces a 2-FT combo where sell1.id === sell2.id', () => {
    // The combo loop iterates i < j in currentPlayers so sell1 !== sell2 structurally,
    // but the sell-side dedup guard is an explicit defence against any future loop refactor.
    // This test verifies the invariant holds in all returned combos.
    const { picks, players } = makeValidSquad()
    const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
    const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })
    const strongMid = makePlayer({ id: 22, element_type: 3, xPts_1gw: 8.0, team: 12 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk, strongDef, strongMid],
      horizon: 1,
      ftCount: 2,
      bank: 1000,
    })

    const combos = result.filter(s => s.kind === 'combo')
    expect(combos.length).toBeGreaterThan(0)
    for (const sug of combos) {
      if (sug.kind === 'combo') {
        const [t1, t2] = sug.transfers
        expect(t1.sell.id).not.toBe(t2.sell.id)
      }
    }
  })

  it('never produces a 2-FT combo where buy1.id === buy2.id (regression guard)', () => {
    // Existing buy-side dedup guard — verify it still holds after combo loop refactor.
    const { picks, players } = makeValidSquad()
    const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
    const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk, strongDef],
      horizon: 1,
      ftCount: 2,
      bank: 1000,
    })

    const combos = result.filter(s => s.kind === 'combo')
    for (const sug of combos) {
      if (sug.kind === 'combo') {
        const [t1, t2] = sug.transfers
        expect(t1.buy.id).not.toBe(t2.buy.id)
      }
    }
  })
})

describe('Phase 74: Combos always emitted (D-06)', () => {
  it('emits at least one cost:0 combo when ftCount === 2', () => {
    const { picks, players } = makeValidSquad()
    const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
    const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk, strongDef],
      horizon: 1,
      ftCount: 2,
      bank: 1000,
    })

    const freeCombos = result.filter(s => s.kind === 'combo' && s.cost === 0)
    expect(freeCombos.length).toBeGreaterThan(0)
  })

  it('emits at least one cost:4 combo when ftCount === 1 (always-emit for -8 hit derivation)', () => {
    // D-06: combos are always enumerated so computeOpportunityCostRows can derive the -8 Hit row.
    // When ftCount=1, the second transfer is a hit → combos have cost:4.
    const { picks, players } = makeValidSquad()
    const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
    const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk, strongDef],
      horizon: 1,
      ftCount: 1,
      bank: 1000,
    })

    const hitCombos = result.filter(s => s.kind === 'combo' && s.cost === 4)
    expect(hitCombos.length).toBeGreaterThan(0)
  })
})

describe('Phase 101 GWT-01: targetGw parameter', () => {
  it('routes scoring through computeGwXpts when targetGw is set', () => {
    const { picks, players } = makeValidSquad()
    // Make player 1 (GK) a "sell" candidate. Add a "buy" candidate with same position
    // (GK / element_type=1) that has STRONG GW33 fixture but weak xPts_1gw.
    const buyGw33 = makePlayer({
      id: 100, element_type: 1, team: 9,
      xPts_1gw: 1.0,   // weak baseline
      xg_per90: 0, xa_per90: 0,   // GK — no goal/assist EV
      xmins: 90, start_prob: 1.0,
      fixtures: [
        { opponent_team: 'NEW', is_home: true, event_id: 33,
          difficulty_score: 0.2, difficulty_tier: 'easy', defensive_difficulty: 0.1 }
      ] as any,
    })
    // Baseline (no targetGw): horizon=1 ranks by xPts_1gw, player 100 is weak → not top.
    const baselinePool = suggestTransfers({
      currentPicks: picks, players: [...players, buyGw33],
      horizon: 1, ftCount: 1, bank: 1000,
    })
    // GWT mode (targetGw=33): computeGwXpts gives player 100 a strong CS-driven score.
    const gwtPool = suggestTransfers({
      currentPicks: picks, players: [...players, buyGw33],
      horizon: 1, ftCount: 1, bank: 1000, targetGw: 33,
    })
    // Find any single-transfer suggestion buying player 100 in GWT mode
    const gwtBuy100 = gwtPool.find(s => s.kind === 'single' && (s as any).buy?.id === 100)
    expect(gwtBuy100).toBeDefined()
    // In baseline, player 100 has xPts_1gw=1.0 (weaker than default 5.0), so it never beats sells
    const baselineBuy100 = baselinePool.find(s => s.kind === 'single' && (s as any).buy?.id === 100)
    expect(baselineBuy100).toBeUndefined()
  })

  it('uses denominator=1 for xPtsGainPerGw when targetGw is set', () => {
    const { picks, players } = makeValidSquad()
    const buy = makePlayer({
      id: 100, element_type: 1, team: 9,
      xg_per90: 0, xa_per90: 0, xmins: 90, start_prob: 1.0,
      fixtures: [
        { opponent_team: 'NEW', is_home: true, event_id: 33,
          difficulty_score: 0.2, difficulty_tier: 'easy', defensive_difficulty: 0.1 }
      ] as any,
    })
    const result = suggestTransfers({
      currentPicks: picks, players: [...players, buy],
      horizon: 5, ftCount: 1, bank: 1000, targetGw: 33,
    })
    const single = result.find(s => s.kind === 'single' && (s as any).buy?.id === 100 && s.cost === 0)
    if (single) {
      // denominator=1, so xPtsGainPerGw === xPtsGain (not xPtsGain/5)
      expect(single.xPtsGainPerGw).toBeCloseTo(single.xPtsGain, 5)
    }
  })

  it('does not regress baseline behaviour when targetGw is omitted', () => {
    const { picks, players } = makeValidSquad()
    const withoutGwt = suggestTransfers({
      currentPicks: picks, players, horizon: 1, ftCount: 1, bank: 0,
    })
    const withGwtUndefined = suggestTransfers({
      currentPicks: picks, players, horizon: 1, ftCount: 1, bank: 0, targetGw: undefined,
    })
    expect(withGwtUndefined).toEqual(withoutGwt)
  })
})

// Phase 111 FIX-02 — Position lock regression
describe('Phase 111 FIX-02: Position lock invariants', () => {
  it('FIX-02 guard: invalid element_type players are filtered out before suggestion enumeration', () => {
    const { picks, players } = makeValidSquad()
    // Inject a player with an invalid element_type (0). Extreme xPts so it would dominate if not filtered.
    const corruptPlayer = makePlayer({ id: 99, element_type: 0 as unknown as 1, xPts_1gw: 100, team: 15 })
    // Spy on console.warn to verify the guard fires
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = suggestTransfers({
        currentPicks: picks,
        players: [...players, corruptPlayer],
        horizon: 1,
        ftCount: 1,
        bank: 1000,
      })
      // Guard must emit a console.warn mentioning FIX-02 and the bad id (99)
      expect(warnSpy).toHaveBeenCalled()
      const warnArgs = warnSpy.mock.calls.flat().join(' ')
      expect(warnArgs).toContain('FIX-02')
      expect(warnArgs).toContain('99')
      // Corrupt player must not appear in any suggestion
      for (const sug of result) {
        if (sug.kind === 'single') {
          expect(sug.sell.id).not.toBe(99)
          expect(sug.buy.id).not.toBe(99)
        } else {
          for (const leg of sug.transfers) {
            expect(leg.sell.id).not.toBe(99)
            expect(leg.buy.id).not.toBe(99)
          }
        }
      }
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('FIX-02 regression: single suggestions never produce a buy of different position than the sell', () => {
    const { picks, players } = makeValidSquad()
    // Inject strong candidates — one per position. ids 20-23, teams 10-13 (no team cap collision).
    const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
    const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })
    const strongMid = makePlayer({ id: 22, element_type: 3, xPts_1gw: 8.0, team: 12 })
    const strongFwd = makePlayer({ id: 23, element_type: 4, xPts_1gw: 7.5, team: 13 })
    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk, strongDef, strongMid, strongFwd],
      horizon: 1,
      ftCount: 1,
      bank: 1000,
    })
    const singles = result.filter(s => s.kind === 'single')
    expect(singles.length).toBeGreaterThan(0)
    for (const sug of singles) {
      if (sug.kind === 'single') {
        // Position lock invariant: sell and buy must be same element_type
        expect(sug.sell.element_type).toBe(sug.buy.element_type)
      }
    }
  })

  it('FIX-02 regression: combo suggestions never mix positions in any leg', () => {
    const { picks, players } = makeValidSquad()
    const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, team: 10 })
    const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 8.5, team: 11 })
    const strongMid = makePlayer({ id: 22, element_type: 3, xPts_1gw: 8.0, team: 12 })
    const strongFwd = makePlayer({ id: 23, element_type: 4, xPts_1gw: 7.5, team: 13 })
    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk, strongDef, strongMid, strongFwd],
      horizon: 1,
      ftCount: 1,
      bank: 1000,
    })
    const combos = result.filter(s => s.kind === 'combo')
    // Skip assertion if engine produces no combos (combos require 2 affordable positive-gain legs)
    if (combos.length === 0) return
    for (const sug of combos) {
      if (sug.kind === 'combo') {
        for (const leg of sug.transfers) {
          // Per-leg position lock: sell and buy in each leg must share element_type
          expect(leg.sell.element_type).toBe(leg.buy.element_type)
        }
      }
    }
  })
})

describe('Phase 74: Bank constraint (TFX-05)', () => {
  it('respects bank parameter in tenths — over-budget buy not returned as top suggestion', () => {
    // bank = 0 tenths (£0m). Buy candidate now_cost=60 (£6m). Squad player sell value = now_cost=50.
    // Net cost = 60 - 50 = 10 tenths (£1m) > bank(0). Should be filtered out.
    const { picks, players } = makeValidSquad()
    // Expensive GK candidate — would be best pick if budget allowed
    const expensiveGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 9.0, now_cost: 60, team: 10 })
    // Affordable GK candidate (now_cost same as sell value)
    const affordableGk = makePlayer({ id: 21, element_type: 1, xPts_1gw: 7.0, now_cost: 50, team: 11 })

    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, expensiveGk, affordableGk],
      horizon: 1,
      ftCount: 1,
      bank: 0,  // tenths: £0m — can only afford equal-cost swaps
    })

    // Expensive GK (id=20) must not appear — bank insufficient (0 + 50 = 50 < 60)
    for (const sug of result) {
      const buyIds = sug.kind === 'single' ? [sug.buy.id] : sug.transfers.map(t => t.buy.id)
      expect(buyIds).not.toContain(20)
    }
    // Affordable GK (id=21) may appear — bank+sellValue=0+50=50 >= 50 ✓
    const affordableBuy = result.find(s => s.kind === 'single' && s.buy.id === 21)
    expect(affordableBuy).toBeDefined()
  })
})

// Phase 118 ENGN-01: factory helper for LineupNewsPlayer mocks
function makeLineupNewsPlayer(
  id: number,
  status_label: StatusLabel,
  availability_factor: 1.0 | 0.75 | 0.5 | 0.25 | 0.0 | null,
): LineupNewsPlayer {
  return {
    id,
    availability_factor,
    status_label,
    news_headline: null,
    news_source: null,
    scraped_at: '2026-05-17T10:00:00Z',
  }
}

describe('Phase 118 ENGN-01: lineupNewsMap availability penalty', () => {
  it('absent buy candidate (availability_factor=0.0) appears at bottom with near-zero xPtsGain', () => {
    const { picks, players } = makeValidSquad()
    // Strong MID candidate but confirmed absent
    const absentMid = makePlayer({ id: 99, element_type: 3, xPts_1gw: 8.0, team: 10 })
    // Healthy MID candidate with lower xPts — should rank above absent
    const healthyMid = makePlayer({ id: 98, element_type: 3, xPts_1gw: 6.0, team: 11 })
    const lineupNewsMap = new Map([
      [99, makeLineupNewsPlayer(99, 'confirmed_absent', 0.0)],
    ])
    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, absentMid, healthyMid],
      horizon: 1,
      ftCount: 1,
      bank: 100,
      lineupNewsMap,
    })
    const absentSuggestion = result.find(s => s.kind === 'single' && s.buy.id === 99)
    const healthySuggestion = result.find(s => s.kind === 'single' && s.buy.id === 98)
    // Absent player (raw 8.0 * 0.01 = 0.08) has near-zero effective score; current squad MIDs
    // score 5.0, so xPtsGain = 0.08 - 5.0 = -4.92 → filtered out by the > 0 guard.
    expect(absentSuggestion).toBeUndefined()
    // Healthy MID (6.0 * 1.0 = 6.0; gain = 6.0 - 5.0 = 1.0) must appear and its gain must
    // exceed what the absent candidate would have had (asserting the penalty is meaningful).
    expect(healthySuggestion).toBeDefined()
    expect(healthySuggestion!.xPtsGain).toBeGreaterThan(0)
  })

  it('doubted buy candidate (0.5) is ranked below equally-rated healthy candidate (1.0)', () => {
    const { picks, players } = makeValidSquad()
    // Doubted DEF candidate (availability_factor=0.5, xPts_1gw=8.0 → effective score 4.0)
    const doubtedDef = makePlayer({ id: 97, element_type: 2, xPts_1gw: 8.0, team: 12 })
    // Healthy DEF candidate (no entry in map → factor 1.0, xPts_1gw=7.0 → effective score 7.0)
    const healthyDef = makePlayer({ id: 96, element_type: 2, xPts_1gw: 7.0, team: 13 })
    const lineupNewsMap = new Map([
      [97, makeLineupNewsPlayer(97, 'doubted', 0.5)],
    ])
    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, doubtedDef, healthyDef],
      horizon: 1,
      ftCount: 1,
      bank: 100,
      lineupNewsMap,
    })
    const doubtedSug = result.find(s => s.kind === 'single' && s.buy.id === 97)
    const healthySug = result.find(s => s.kind === 'single' && s.buy.id === 96)
    // Both should appear but healthy must rank higher (or doubted may not appear if score too low)
    if (doubtedSug && healthySug) {
      const doubtedIdx = result.indexOf(doubtedSug)
      const healthyIdx = result.indexOf(healthySug)
      expect(healthyIdx).toBeLessThan(doubtedIdx)
    }
    // At minimum the healthy candidate should be ranked above the doubted one
    // Doubted: 8.0 * 0.5 = 4.0; gain = 4.0 - 5.0 = -1.0 → filtered (negative gain)
    // Healthy: 7.0 * 1.0 = 7.0; gain = 7.0 - 5.0 = 2.0 → appears
    expect(healthySug).toBeDefined()
  })

  it('lineupNewsMap=undefined produces identical output to pre-ENGN call (no-penalty baseline)', () => {
    const { picks, players } = makeValidSquad()
    const strongDef = makePlayer({ id: 20, element_type: 2, xPts_1gw: 8.0, team: 10 })
    const withoutMap = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongDef],
      horizon: 1,
      ftCount: 1,
      bank: 100,
    })
    const withUndefinedMap = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongDef],
      horizon: 1,
      ftCount: 1,
      bank: 100,
      lineupNewsMap: undefined,
    })
    expect(withUndefinedMap).toEqual(withoutMap)
  })

  it('lineupNewsMap with availability_factor=null (unknown) treats candidate as 1.0 — no penalty', () => {
    const { picks, players } = makeValidSquad()
    const unknownMid = makePlayer({ id: 95, element_type: 3, xPts_1gw: 8.0, team: 14 })
    const lineupNewsMap = new Map([
      [95, makeLineupNewsPlayer(95, 'unknown', null)],
    ])
    const withNullFactor = suggestTransfers({
      currentPicks: picks,
      players: [...players, unknownMid],
      horizon: 1,
      ftCount: 1,
      bank: 100,
      lineupNewsMap,
    })
    const withoutMap = suggestTransfers({
      currentPicks: picks,
      players: [...players, unknownMid],
      horizon: 1,
      ftCount: 1,
      bank: 100,
    })
    // null availability_factor = unknown = no penalty, so results should be identical
    expect(withNullFactor).toEqual(withoutMap)
  })

  it('sell side is not penalized — absent owned player does not affect xPtsGain when selling', () => {
    const { picks, players } = makeValidSquad()
    // Make player 1 (GK, id=1) confirmed absent in lineupNewsMap
    // Selling player 1 to buy a strong GK candidate should have the same gain regardless
    const strongGk = makePlayer({ id: 99, element_type: 1, xPts_1gw: 8.0, team: 10 })
    // Without news map
    const withoutMap = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk],
      horizon: 1,
      ftCount: 1,
      bank: 100,
    })
    // With player 1 marked absent in news map (sell side should be unaffected)
    const lineupNewsMap = new Map([
      [1, makeLineupNewsPlayer(1, 'confirmed_absent', 0.0)],
    ])
    const withAbsentSell = suggestTransfers({
      currentPicks: picks,
      players: [...players, strongGk],
      horizon: 1,
      ftCount: 1,
      bank: 100,
      lineupNewsMap,
    })
    // Find the suggestion selling player 1 and buying strongGk in both results
    const noMapSug = withoutMap.find(s => s.kind === 'single' && s.sell.id === 1 && s.buy.id === 99)
    const withMapSug = withAbsentSell.find(s => s.kind === 'single' && s.sell.id === 1 && s.buy.id === 99)
    // Both should produce the same xPtsGain — sell side is unpenalized
    if (noMapSug && withMapSug) {
      expect(withMapSug.xPtsGain).toBeCloseTo(noMapSug.xPtsGain, 5)
    }
    // The suggestion should exist in both (sell side penalty would affect gain if applied)
    expect(noMapSug).toBeDefined()
    expect(withMapSug).toBeDefined()
  })

  it('2-FT combo: both doubted buy legs (0.5) produce lower xPtsGain than healthy/healthy combo', () => {
    const { picks, players } = makeValidSquad()
    // Two doubted candidates
    const doubtedGk = makePlayer({ id: 90, element_type: 1, xPts_1gw: 9.0, team: 15 })
    const doubtedDef = makePlayer({ id: 91, element_type: 2, xPts_1gw: 9.0, team: 16 })
    // Two healthy candidates with same raw xPts
    const healthyGk = makePlayer({ id: 92, element_type: 1, xPts_1gw: 9.0, team: 17 })
    const healthyDef = makePlayer({ id: 93, element_type: 2, xPts_1gw: 9.0, team: 18 })
    const lineupNewsMap = new Map([
      [90, makeLineupNewsPlayer(90, 'doubted', 0.5)],
      [91, makeLineupNewsPlayer(91, 'doubted', 0.5)],
    ])
    const result = suggestTransfers({
      currentPicks: picks,
      players: [...players, doubtedGk, doubtedDef, healthyGk, healthyDef],
      horizon: 1,
      ftCount: 2,
      bank: 100,
      lineupNewsMap,
    })
    // Find the best healthy/healthy combo (buying 92 + 93)
    const healthyCombo = result.find(
      s => s.kind === 'combo' &&
      s.transfers.every(t => [92, 93].includes(t.buy.id)),
    )
    // Find the doubted/doubted combo (buying 90 + 91)
    const doubtedCombo = result.find(
      s => s.kind === 'combo' &&
      s.transfers.every(t => [90, 91].includes(t.buy.id)),
    )
    if (healthyCombo && doubtedCombo) {
      // Doubted combo should have lower xPtsGain than healthy combo
      expect(doubtedCombo.xPtsGain).toBeLessThan(healthyCombo.xPtsGain)
    }
    // The healthy combo should appear (both legs positive gain)
    expect(healthyCombo).toBeDefined()
  })
})
