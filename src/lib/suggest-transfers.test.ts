// Phase 45 (TFR-01..TFR-03): suggestTransfers engine — pure-function unit tests.
// Mirrors src/lib/optimise-lineup.test.ts pattern.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { suggestTransfers } from './suggest-transfers'
import type { MergedPlayer } from './types'
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
function makeValidSquad(): { picks: SquadPick[]; players: MergedPlayer[] } {
  const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  const picks: SquadPick[] = []
  const players: MergedPlayer[] = []
  for (let i = 0; i < 15; i++) {
    const id = i + 1
    picks.push(makePick(id, i + 1))
    players.push(makePlayer({ id, element_type: elementTypes[i] }))
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
