// Phase 43 (OPT-01..OPT-05): optimise-lineup engine — pure function unit tests.
// Mirrors src/lib/chip-strategy-engine.test.ts pattern.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { optimiseLineup, benchOrder } from './optimise-lineup'
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

// Build a 15-player squad: 2 GK, 5 DEF, 5 MID, 3 FWD with sequential ids 1..15.
// positions 1..11 = starters (FPL convention), 12..15 = bench. Engine ignores SquadPick.position
// for selection (it picks best XI from any 11 of the 15) — pick.position is FPL metadata only.
function makeSquad(perPlayerOverrides: Record<number, Partial<MergedPlayer>> = {}): { picks: SquadPick[]; players: MergedPlayer[] } {
  const positionByElementType: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  const picks: SquadPick[] = []
  const players: MergedPlayer[] = []
  for (let i = 0; i < 15; i++) {
    const id = i + 1
    const et = elementTypes[i]
    positionByElementType[et]++
    picks.push(makePick(id, i + 1))
    players.push(makePlayer({ id, element_type: et, ...(perPlayerOverrides[id] ?? {}) }))
  }
  return { picks, players }
}

describe('Phase 43: optimise-lineup', () => {
  describe('OPT-01 lineup shape and formation', () => {
    it('returns starters length 11 and bench length 4 for a valid 15-player squad', () => {
      const { picks, players } = makeSquad()
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      expect(result!.starters).toHaveLength(11)
      expect(result!.bench).toHaveLength(4)
    })

    it('returns a valid FPL formation string in DEF-MID-FWD shape (no GK count)', () => {
      const { picks, players } = makeSquad()
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      // Format must be three numbers separated by hyphens, summing to 10 (outfield only)
      const parts = result!.formation.split('-').map(Number)
      expect(parts).toHaveLength(3)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(10)
      // Validate FPL formation rules: DEF in [3,5], MID in [2,5], FWD in [1,3]
      expect(parts[0]).toBeGreaterThanOrEqual(3)
      expect(parts[0]).toBeLessThanOrEqual(5)
      expect(parts[1]).toBeGreaterThanOrEqual(2)
      expect(parts[1]).toBeLessThanOrEqual(5)
      expect(parts[2]).toBeGreaterThanOrEqual(1)
      expect(parts[2]).toBeLessThanOrEqual(3)
    })

    it('starters contain exactly 1 GK (element_type === 1)', () => {
      const { picks, players } = makeSquad()
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      const playerMap = new Map(players.map(p => [p.id, p]))
      const gkCount = result!.starters.filter(id => playerMap.get(id)!.element_type === 1).length
      expect(gkCount).toBe(1)
    })
  })

  describe('OPT-02 horizon scoring (1 / 3 / 5 GW)', () => {
    it('horizon 1 selects starters maximising xPts_1gw sum', () => {
      // Make one DEF have a far-higher xPts_1gw than another DEF; engine must include the high one.
      const overrides: Record<number, Partial<MergedPlayer>> = {
        3: { xPts_1gw: 0.1, xPts_3gw: 100, xPts_5gw: 100 },  // DEF id=3: bad 1gw, great 3gw/5gw
        7: { xPts_1gw: 9.9, xPts_3gw: 0.1, xPts_5gw: 0.1 },  // DEF id=7: great 1gw, bad 3gw/5gw
      }
      const { picks, players } = makeSquad(overrides)
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      // horizon 1 must prefer id=7 (high 1gw), exclude id=3 (low 1gw)
      expect(result!.starters).toContain(7)
      expect(result!.starters).not.toContain(3)
    })

    it('horizon 5 selects starters maximising xPts_5gw sum', () => {
      const overrides: Record<number, Partial<MergedPlayer>> = {
        3: { xPts_1gw: 0.1, xPts_3gw: 100, xPts_5gw: 100 },
        7: { xPts_1gw: 9.9, xPts_3gw: 0.1, xPts_5gw: 0.1 },
      }
      const { picks, players } = makeSquad(overrides)
      const result = optimiseLineup(picks, players, 5)
      expect(result).not.toBeNull()
      // horizon 5 must prefer id=3 (high 5gw), exclude id=7 (low 5gw)
      expect(result!.starters).toContain(3)
      expect(result!.starters).not.toContain(7)
    })
  })

  describe('OPT-03 captain / VC selection', () => {
    it('captainId is the starter with highest xPts_90th_1gw', () => {
      // Boost one mid's xPts_90th_1gw to 99 — must be captain.
      const { picks, players } = makeSquad({ 8: { xPts_90th_1gw: 99 } })
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      expect(result!.captainId).toBe(8)
    })

    it('vcId is the starter with second-highest xPts_90th_1gw and is not the captain', () => {
      const { picks, players } = makeSquad({
        8: { xPts_90th_1gw: 99 },
        9: { xPts_90th_1gw: 50 },
      })
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      expect(result!.vcId).toBe(9)
      expect(result!.vcId).not.toBe(result!.captainId)
    })

    it('falls back to xPts_1gw when xPts_90th_1gw is undefined for all starters', () => {
      // All players: xPts_90th_1gw = undefined; one player with high xPts_1gw must be captain.
      const overrides: Record<number, Partial<MergedPlayer>> = {}
      for (let i = 1; i <= 15; i++) overrides[i] = { xPts_90th_1gw: undefined, xPts_1gw: 5.0 }
      overrides[8] = { xPts_90th_1gw: undefined, xPts_1gw: 99 }
      const { picks, players } = makeSquad(overrides)
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      expect(result!.captainId).toBe(8)
    })
  })

  describe('OPT-04 bench ordering', () => {
    it('bench[0] is the non-starting GK (element_type === 1)', () => {
      const { picks, players } = makeSquad()
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      const playerMap = new Map(players.map(p => [p.id, p]))
      expect(playerMap.get(result!.bench[0])!.element_type).toBe(1)
    })

    it('bench[1..3] are outfield players ordered by horizon xPts descending', () => {
      // Give each player a single fixture so benchOrder() uses the active (EV) path,
      // not the BGW fallback. All have identical start_prob so EV rank == xPts rank.
      const { picks, players } = makeSquad()
      const playersWithFixtures = players.map(p => ({
        ...p,
        fixtures: [{ opponent_team: 'TST', is_home: true, event_id: 30,
                     difficulty_score: 0.5, difficulty_tier: 'medium' as const }],
      }))
      const result = optimiseLineup(picks, playersWithFixtures, 1)
      expect(result).not.toBeNull()
      const playerMap = new Map(playersWithFixtures.map(p => [p.id, p]))
      const outfieldBench = result!.bench.slice(1)
      // None of bench[1..3] are GK
      for (const id of outfieldBench) {
        expect(playerMap.get(id)!.element_type).not.toBe(1)
      }
      // xPts descending — with uniform start_prob, EV rank equals xPts rank
      const scores = outfieldBench.map(id => playerMap.get(id)!.xPts_1gw ?? 0)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i])
      }
    })
  })

  describe('OPT-05 BGW exclusion', () => {
    it('player with xPts_1gw === 0 is excluded from starters (BGW proxy)', () => {
      // Player id=8 (MID) has xPts_1gw === 0 — must NOT be in starters.
      // Other MIDs available so squad still has 11 eligible.
      const { picks, players } = makeSquad({ 8: { xPts_1gw: 0, xPts_3gw: 0, xPts_5gw: 0 } })
      const result = optimiseLineup(picks, players, 1)
      expect(result).not.toBeNull()
      expect(result!.starters).not.toContain(8)
    })

    it('player with xPts_1gw === undefined is NOT excluded (Pitfall 1: undefined != BGW)', () => {
      // All players have undefined xPts_1gw — engine must still return a lineup, not null.
      const overrides: Record<number, Partial<MergedPlayer>> = {}
      for (let i = 1; i <= 15; i++) {
        overrides[i] = { xPts_1gw: undefined, xPts_3gw: 5.0, xPts_5gw: 10.0 }
      }
      const { picks, players } = makeSquad(overrides)
      const result = optimiseLineup(picks, players, 3)
      expect(result).not.toBeNull()
      expect(result!.starters).toHaveLength(11)
    })

    it('returns null when fewer than 11 BGW-eligible players remain', () => {
      // Mark 5 players as BGW (xPts_1gw === 0). 15 - 5 = 10 < 11 -> null.
      const overrides: Record<number, Partial<MergedPlayer>> = {}
      for (const id of [1, 3, 8, 9, 13]) overrides[id] = { xPts_1gw: 0 }
      const { picks, players } = makeSquad(overrides)
      const result = optimiseLineup(picks, players, 1)
      expect(result).toBeNull()
    })
  })

  describe('BENCH-01 benchOrder()', () => {
    // Helper: build a single FixtureEntry mock (matches FixtureEntry shape from types.ts).
    const fx = (event_id: number) => ({
      opponent_team: 'TST',
      is_home: true,
      event_id,
      difficulty_score: 0.5,
      difficulty_tier: 'medium' as const,
    })

    it('ranks by start_prob × xPts × fixtures.length (D-03 EV formula)', () => {
      // Two MID candidates, identical xPts_1gw, identical fixtures count, different start_prob.
      // EV(A) = 0.9 × 5.0 × 1 = 4.5; EV(B) = 0.3 × 5.0 × 1 = 1.5 → A first.
      const A = makePlayer({ id: 101, element_type: 3, start_prob: 0.9, xPts_1gw: 5.0, fixtures: [fx(10)] })
      const B = makePlayer({ id: 102, element_type: 3, start_prob: 0.3, xPts_1gw: 5.0, fixtures: [fx(10)] })
      // Starters: a formation-valid 4-4-2 baseline so neither A nor B is formation-constrained.
      const starters: MergedPlayer[] = [
        makePlayer({ id: 1, element_type: 1 }),
        makePlayer({ id: 2, element_type: 2 }), makePlayer({ id: 3, element_type: 2 }),
        makePlayer({ id: 4, element_type: 2 }), makePlayer({ id: 5, element_type: 2 }),
        makePlayer({ id: 6, element_type: 3 }), makePlayer({ id: 7, element_type: 3 }),
        makePlayer({ id: 8, element_type: 3 }), makePlayer({ id: 9, element_type: 3 }),
        makePlayer({ id: 10, element_type: 4 }), makePlayer({ id: 11, element_type: 4 }),
      ]
      const result = benchOrder([B, A], starters, 1)
      expect(result.map(p => p.id)).toEqual([101, 102])
    })

    it('places BGW players (fixtures.length === 0) at slot 3 regardless of EV (D-05/D-06)', () => {
      // BGW candidate has overwhelmingly high xPts but empty fixtures → must end up last.
      const bgw = makePlayer({ id: 201, element_type: 3, start_prob: 0.99, xPts_1gw: 99, fixtures: [] })
      const single1 = makePlayer({ id: 202, element_type: 3, start_prob: 0.5, xPts_1gw: 4.0, fixtures: [fx(10)] })
      const single2 = makePlayer({ id: 203, element_type: 3, start_prob: 0.4, xPts_1gw: 3.0, fixtures: [fx(10)] })
      // Formation-valid 4-4-2 starters.
      const starters: MergedPlayer[] = [
        makePlayer({ id: 1, element_type: 1 }),
        makePlayer({ id: 2, element_type: 2 }), makePlayer({ id: 3, element_type: 2 }),
        makePlayer({ id: 4, element_type: 2 }), makePlayer({ id: 5, element_type: 2 }),
        makePlayer({ id: 6, element_type: 3 }), makePlayer({ id: 7, element_type: 3 }),
        makePlayer({ id: 8, element_type: 3 }), makePlayer({ id: 9, element_type: 3 }),
        makePlayer({ id: 10, element_type: 4 }), makePlayer({ id: 11, element_type: 4 }),
      ]
      const result = benchOrder([bgw, single1, single2], starters, 1)
      // Last element (slot 3 outfield = bench[3]) MUST be the BGW player.
      expect(result[result.length - 1].id).toBe(201)
      // BGW must NOT be at slot 1 (index 0) regardless of its EV.
      expect(result[0].id).not.toBe(201)
    })

    it('DGW player (fixtures.length === 2) ranks higher than identical single-fixture player (D-07)', () => {
      // Identical start_prob & xPts; DGW has fixtures.length=2 → EV doubled by formula.
      const dgw = makePlayer({ id: 301, element_type: 3, start_prob: 0.7, xPts_1gw: 5.0, fixtures: [fx(10), fx(10)] })
      const single = makePlayer({ id: 302, element_type: 3, start_prob: 0.7, xPts_1gw: 5.0, fixtures: [fx(10)] })
      const starters: MergedPlayer[] = [
        makePlayer({ id: 1, element_type: 1 }),
        makePlayer({ id: 2, element_type: 2 }), makePlayer({ id: 3, element_type: 2 }),
        makePlayer({ id: 4, element_type: 2 }), makePlayer({ id: 5, element_type: 2 }),
        makePlayer({ id: 6, element_type: 3 }), makePlayer({ id: 7, element_type: 3 }),
        makePlayer({ id: 8, element_type: 3 }), makePlayer({ id: 9, element_type: 3 }),
        makePlayer({ id: 10, element_type: 4 }), makePlayer({ id: 11, element_type: 4 }),
      ]
      const result = benchOrder([single, dgw], starters, 1)
      expect(result.map(p => p.id)).toEqual([301, 302])
    })

    it('demotes formation-invalid candidate (would exceed DEF ceiling of 5) below formation-valid (D-08/D-09)', () => {
      // Starters: formation 5-3-2 → DEF count is at ceiling (5). Adding another DEF candidate would push DEF to 6.
      // Candidate D = DEF (formation-invalid), Candidate M = MID (formation-valid). D has higher EV but should be demoted.
      const D = makePlayer({ id: 401, element_type: 2, start_prob: 0.9, xPts_1gw: 8.0, fixtures: [fx(10)] })
      const M = makePlayer({ id: 402, element_type: 3, start_prob: 0.5, xPts_1gw: 3.0, fixtures: [fx(10)] })
      // 5-3-2 starters: 1 GK + 5 DEF + 3 MID + 2 FWD = 11.
      const starters: MergedPlayer[] = [
        makePlayer({ id: 1, element_type: 1 }),
        makePlayer({ id: 2, element_type: 2 }), makePlayer({ id: 3, element_type: 2 }),
        makePlayer({ id: 4, element_type: 2 }), makePlayer({ id: 5, element_type: 2 }), makePlayer({ id: 6, element_type: 2 }),
        makePlayer({ id: 7, element_type: 3 }), makePlayer({ id: 8, element_type: 3 }), makePlayer({ id: 9, element_type: 3 }),
        makePlayer({ id: 10, element_type: 4 }), makePlayer({ id: 11, element_type: 4 }),
      ]
      const result = benchOrder([D, M], starters, 1)
      // M (formation-valid) ranks first; D (formation-invalid) is demoted below.
      expect(result.map(p => p.id)).toEqual([402, 401])
      // Demotion is NOT exclusion — D must still appear in the returned array.
      expect(result).toHaveLength(2)
    })
  })
})

// ============================================================================
// Phase 118 ENGN-02: lineupNewsMap absent-player exclusion
// ============================================================================

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

describe('Phase 118 ENGN-02: lineupNewsMap absent-player exclusion', () => {
  it('Test A (D-05): confirmed_absent player is excluded from starters even with high xPts_1gw', () => {
    // MID id=8 has xPts_1gw=9.0 — would normally be selected. Marked confirmed_absent.
    // Must NOT appear in starters[].
    const { picks, players } = makeSquad({ 8: { xPts_1gw: 9.0, xPts_3gw: 27.0, xPts_5gw: 45.0 } })
    const newsMap = new Map<number, LineupNewsPlayer>([
      [8, makeLineupNewsPlayer(8, 'confirmed_absent', 0.0)],
    ])
    const result = optimiseLineup(picks, players, 1, newsMap)
    expect(result).not.toBeNull()
    expect(result!.starters).not.toContain(8)
  })

  it('Test B (D-08): doubted player (availability_factor=0.5) with high xPts IS still in starters', () => {
    // MID id=8 doubted — doubted players must NOT be excluded from starter enumeration (D-08).
    const { picks, players } = makeSquad({ 8: { xPts_1gw: 9.0, xPts_3gw: 27.0, xPts_5gw: 45.0 } })
    const newsMap = new Map<number, LineupNewsPlayer>([
      [8, makeLineupNewsPlayer(8, 'doubted', 0.5)],
    ])
    const result = optimiseLineup(picks, players, 1, newsMap)
    expect(result).not.toBeNull()
    expect(result!.starters).toContain(8)
  })

  it('Test C (D-07): returns null when excluding absent players drops eligible below 11', () => {
    // Mark 5 players as confirmed_absent. 15 - 5 = 10 < 11 → null.
    const { picks, players } = makeSquad()
    const newsMap = new Map(
      [1, 3, 8, 9, 13].map(id => [id, makeLineupNewsPlayer(id, 'confirmed_absent', 0.0)])
    )
    const result = optimiseLineup(picks, players, 1, newsMap)
    expect(result).toBeNull()
  })

  it('Test D (regression): lineupNewsMap=undefined produces identical output to pre-ENGN call', () => {
    const { picks, players } = makeSquad()
    const withoutMap = optimiseLineup(picks, players, 1)
    const withUndefinedMap = optimiseLineup(picks, players, 1, undefined)
    expect(withUndefinedMap).toEqual(withoutMap)
  })
})

describe('Phase 118 ENGN-02: benchOrder absent-player zero EV', () => {
  const fx = (event_id: number) => ({
    opponent_team: 'TST',
    is_home: true,
    event_id,
    difficulty_score: 0.5,
    difficulty_tier: 'medium' as const,
  })

  // Standard 4-4-2 starters for bench ordering tests.
  const startersBase: MergedPlayer[] = [
    makePlayer({ id: 1, element_type: 1 }),
    makePlayer({ id: 2, element_type: 2 }), makePlayer({ id: 3, element_type: 2 }),
    makePlayer({ id: 4, element_type: 2 }), makePlayer({ id: 5, element_type: 2 }),
    makePlayer({ id: 6, element_type: 3 }), makePlayer({ id: 7, element_type: 3 }),
    makePlayer({ id: 8, element_type: 3 }), makePlayer({ id: 9, element_type: 3 }),
    makePlayer({ id: 10, element_type: 4 }), makePlayer({ id: 11, element_type: 4 }),
  ]

  it('Test E (D-06): confirmed_absent bench outfield player sorts to LAST position after all healthy/doubted', () => {
    // absentS has high xPts but confirmed_absent → evScore=0 → must be last outfield bench slot.
    const healthyP = makePlayer({ id: 501, element_type: 3, start_prob: 0.8, xPts_1gw: 4.0, fixtures: [fx(10)] })
    const healthyQ = makePlayer({ id: 502, element_type: 3, start_prob: 0.7, xPts_1gw: 3.5, fixtures: [fx(10)] })
    const healthyR = makePlayer({ id: 503, element_type: 3, start_prob: 0.6, xPts_1gw: 3.0, fixtures: [fx(10)] })
    const absentS = makePlayer({ id: 504, element_type: 3, start_prob: 0.9, xPts_1gw: 9.0, fixtures: [fx(10)] })

    const newsMap = new Map<number, LineupNewsPlayer>([
      [504, makeLineupNewsPlayer(504, 'confirmed_absent', 0.0)],
    ])
    const result = benchOrder([healthyP, healthyQ, healthyR, absentS], startersBase, 1, newsMap)
    // absentS must be at the last position regardless of their raw xPts.
    expect(result[result.length - 1].id).toBe(504)
    // absentS must NOT be first.
    expect(result[0].id).not.toBe(504)
  })

  it('Test F (D-08): doubted bench outfield player (availability_factor=0.5) is NOT zeroed — retains natural EV', () => {
    // doubtedQ has doubted status. Must still be ranked by EV (not zeroed).
    // healthyP has lower xPts — if doubtedQ were zeroed, healthyP would rank first.
    // But doubted is NOT zeroed, so doubtedQ's higher EV keeps it first.
    const healthyP = makePlayer({ id: 601, element_type: 3, start_prob: 0.5, xPts_1gw: 3.0, fixtures: [fx(10)] })
    const doubtedQ = makePlayer({ id: 602, element_type: 3, start_prob: 0.8, xPts_1gw: 6.0, fixtures: [fx(10)] })

    const newsMap = new Map<number, LineupNewsPlayer>([
      [602, makeLineupNewsPlayer(602, 'doubted', 0.5)],
    ])
    const result = benchOrder([healthyP, doubtedQ], startersBase, 1, newsMap)
    // doubtedQ (higher EV) must still rank first — doubted players are NOT zeroed (D-08).
    expect(result.map(p => p.id)).toEqual([602, 601])
  })
})
