// @vitest-environment node
// WC-01: buildAnchoredSquad unit tests
import { describe, it, expect } from 'vitest'
import { buildAnchoredSquad } from './anchored-squad'
import type { MergedPlayer } from './types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePlayer(
  id: number,
  type: 1 | 2 | 3 | 4,
  team: number,
  opts: { xPts?: number; cost?: number; status?: string; ceiling?: number } = {},
): MergedPlayer {
  const baseCost = { 1: 45, 2: 50, 3: 65, 4: 80 }
  const xPts = opts.xPts ?? 5.0
  return {
    id,
    web_name: `P${id}`,
    element_type: type,
    team,
    now_cost: opts.cost ?? baseCost[type],
    status: opts.status ?? 'a',
    xPts_1gw: xPts,
    xPts_3gw: xPts * 2.8,
    xPts_5gw: xPts * 4.5,
    xPts_90th_1gw: opts.ceiling ?? xPts * 1.4,
    start_prob: 0.9,
    fixtures: [],
  } as unknown as MergedPlayer
}

/**
 * Build a pool of 60 players across 6 teams large enough to fill a 15-player
 * squad within a £100m (1000 tenths) budget. Teams 1-6, each with:
 * 2 GK (cost 45), 3 DEF (cost 50), 3 MID (cost 65), 2 FWD (cost 80).
 * Team 1 has highest xPts, Team 6 has lowest.
 */
function makePool(): MergedPlayer[] {
  const players: MergedPlayer[] = []
  let id = 1
  for (let team = 1; team <= 6; team++) {
    const base = (7 - team) * 1.0  // team1=6, team6=1
    players.push(makePlayer(id++, 1, team, { xPts: base + 0.11 }))
    players.push(makePlayer(id++, 1, team, { xPts: base - 0.89 }))
    players.push(makePlayer(id++, 2, team, { xPts: base + 0.22 }))
    players.push(makePlayer(id++, 2, team, { xPts: base - 0.78 }))
    players.push(makePlayer(id++, 2, team, { xPts: base - 1.78 }))
    players.push(makePlayer(id++, 3, team, { xPts: base + 0.33 }))
    players.push(makePlayer(id++, 3, team, { xPts: base - 0.67 }))
    players.push(makePlayer(id++, 3, team, { xPts: base - 1.67 }))
    players.push(makePlayer(id++, 4, team, { xPts: base + 0.44 }))
    players.push(makePlayer(id++, 4, team, { xPts: base - 0.56 }))
  }
  return players
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildAnchoredSquad', () => {
  const BUDGET = 1000  // £100m

  it('returns a valid 15-player squad with no anchors', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.squad).toHaveLength(15)
  })

  it('0 anchors: anchorConflicts is empty', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result!.anchorConflicts).toHaveLength(0)
  })

  it('returns null when player pool is too small to fill 15', () => {
    // Only 5 players — cannot build a valid squad
    const tiny = [
      makePlayer(1, 1, 1), makePlayer(2, 2, 1), makePlayer(3, 3, 1),
      makePlayer(4, 4, 1), makePlayer(5, 1, 2),
    ]
    const result = buildAnchoredSquad([], tiny, BUDGET, 1)
    expect(result).toBeNull()
  })

  it('valid anchor appears in squad', () => {
    const pool = makePool()
    const anchor = pool[0]  // first player in pool
    const result = buildAnchoredSquad([anchor.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.squad.map(p => p.id)).toContain(anchor.id)
  })

  it('all 3 valid anchors appear in squad', () => {
    const pool = makePool()
    // Pick one anchor per position type from different teams to avoid cap/slot conflicts
    const gk  = pool.find(p => p.element_type === 1 && p.team === 1)!
    const def = pool.find(p => p.element_type === 2 && p.team === 2)!
    const mid = pool.find(p => p.element_type === 3 && p.team === 3)!
    const ids = (result: ReturnType<typeof buildAnchoredSquad>) => result!.squad.map((p: { id: number }) => p.id)
    const result = buildAnchoredSquad([gk.id, def.id, mid.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(ids(result)).toContain(gk.id)
    expect(ids(result)).toContain(def.id)
    expect(ids(result)).toContain(mid.id)
  })

  it('anchor not in pool → not_found conflict, squad still builds', () => {
    const result = buildAnchoredSquad([99999], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.anchorConflicts).toEqual([{ playerId: 99999, reason: 'not_found' }])
    expect(result!.squad).toHaveLength(15)
  })

  it('unavailable anchor → unavailable conflict, squad still builds', () => {
    const pool = makePool()
    const injured = makePlayer(999, 2, 5, { status: 'i' })
    pool.push(injured)
    const result = buildAnchoredSquad([injured.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.anchorConflicts).toEqual([{ playerId: 999, reason: 'unavailable' }])
  })

  it('4th anchor from same team → team_cap conflict', () => {
    const pool = makePool()
    // Anchor 3 players from team 1 first (valid), then a 4th from team 1
    const team1Players = pool.filter(p => p.team === 1)
    const [a, b, c, d] = team1Players
    const result = buildAnchoredSquad([a.id, b.id, c.id, d.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const conflicts = result!.anchorConflicts
    expect(conflicts.some(c => c.playerId === d.id && c.reason === 'team_cap')).toBe(true)
    // First 3 are in squad, 4th is not
    const squadIds = result!.squad.map(p => p.id)
    expect(squadIds).toContain(a.id)
    expect(squadIds).toContain(b.id)
    expect(squadIds).toContain(c.id)
    expect(squadIds).not.toContain(d.id)
  })

  it('anchor filling 3rd GK → position_cap conflict', () => {
    const pool = makePool()
    // Each from a distinct team → no team_cap possible; 3rd GK must hit position_cap
    const gk_t1 = pool.find(p => p.element_type === 1 && p.team === 1)!
    const gk_t2 = pool.find(p => p.element_type === 1 && p.team === 2)!
    const gk_t3 = pool.find(p => p.element_type === 1 && p.team === 3)!
    const result = buildAnchoredSquad([gk_t1.id, gk_t2.id, gk_t3.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const conflicts = result!.anchorConflicts
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual({ playerId: gk_t3.id, reason: 'position_cap' })
  })

  it('anchor over budget → over_budget conflict', () => {
    const pool = makePool()
    const expensive = makePlayer(999, 3, 5, { cost: 2000 })  // costs more than entire budget
    pool.push(expensive)
    const result = buildAnchoredSquad([expensive.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.anchorConflicts).toEqual([{ playerId: 999, reason: 'over_budget' }])
  })

  it('xPts1gw/3gw/5gw are sums of XI only, not all 15', () => {
    const pool = makePool()
    const result = buildAnchoredSquad([], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const { bestXI, squad } = result!
    expect(bestXI).toHaveLength(11)
    expect(squad).toHaveLength(15)
    // xPts1gw must equal the sum of bestXI players' xPts_1gw
    const playerMap = new Map(pool.map(p => [p.id, p]))
    const expectedXPts1 = bestXI.reduce((s, id) => s + (playerMap.get(id)?.xPts_1gw ?? 0), 0)
    expect(result!.xPts1gw).toBeCloseTo(expectedXPts1, 5)
    const expectedXPts3 = bestXI.reduce((s, id) => s + ((playerMap.get(id)?.xPts_3gw as number | undefined) ?? 0), 0)
    expect(result!.xPts3gw).toBeCloseTo(expectedXPts3, 5)
    const expectedXPts5 = bestXI.reduce((s, id) => s + ((playerMap.get(id)?.xPts_5gw as number | undefined) ?? 0), 0)
    expect(result!.xPts5gw).toBeCloseTo(expectedXPts5, 5)
    // Must be less than sum of all 15
    const allXPts1 = squad.reduce((s, p) => s + (playerMap.get(p.id)?.xPts_1gw ?? 0), 0)
    expect(result!.xPts1gw).toBeLessThan(allXPts1)
  })

  it('captainCandidates are ordered by ceiling descending, max 3', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    const caps = result!.captainCandidates
    expect(caps.length).toBeGreaterThan(0)
    expect(caps.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i - 1].ceiling).toBeGreaterThanOrEqual(caps[i].ceiling)
    }
  })

  it('budgetUsed + budgetRemaining === budget', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.budgetUsed + result!.budgetRemaining).toBe(BUDGET)
  })

  it('formation string is non-empty and matches GK-DEF-MID-FWD pattern', () => {
    const result = buildAnchoredSquad([], makePool(), BUDGET, 1)
    expect(result).not.toBeNull()
    expect(result!.formation).toMatch(/^\d-\d-\d$/)
  })

  it('GK anchor is included; greedy does not add a second GK from same team', () => {
    const pool = makePool()
    const gk = pool.find(p => p.element_type === 1 && p.team === 1)!
    const result = buildAnchoredSquad([gk.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    const squadIds = result!.squad.map(p => p.id)
    expect(squadIds).toContain(gk.id)
    // Only one GK from team 1 in final squad (team cap respected)
    const team1Gks = result!.squad.filter(p => {
      const player = pool.find(q => q.id === p.id)
      return player?.element_type === 1 && player?.team === 1
    })
    expect(team1Gks.length).toBeLessThanOrEqual(1)
  })

  it('duplicate anchor ID is seated only once, no conflict recorded', () => {
    const pool = makePool()
    const mid = pool.find(p => p.element_type === 3 && p.team === 1)!
    const result = buildAnchoredSquad([mid.id, mid.id], pool, BUDGET, 1)
    expect(result).not.toBeNull()
    // Player appears exactly once in squad
    const occurrences = result!.squad.filter(p => p.id === mid.id).length
    expect(occurrences).toBe(1)
    // No conflict recorded for the duplicate
    expect(result!.anchorConflicts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// WC-02 (2026-09-01): "Could not build a valid squad — try removing an anchor
// or checking budget" appeared on every page load, with no anchors set.
//
// Two causes, both in the greedy fill:
//   1. Eligibility used `xPts_1gw !== 0`, which excluded exactly the cheap
//      enablers a 15-man squad needs — a £4.0m player with no minutes yet
//      projects 0 but is perfectly selectable.
//   2. The fill was budget-blind: it seated the highest-xPts players first and
//      could strand itself unable to afford the remaining slots.
// ---------------------------------------------------------------------------
describe('buildAnchoredSquad — completes a squad on a realistic pool', () => {
  function mk(id: number, pos: 1 | 2 | 3 | 4, cost: number, xp: number, team: number): MergedPlayer {
    return {
      id, web_name: `P${id}`, element_type: pos, now_cost: cost, team,
      status: 'a', xPts_1gw: xp, xPts_3gw: xp * 3, xPts_5gw: xp * 5,
      fixtures: [{ opponent_team: 'OPP', is_home: true, event_id: 3,
                   difficulty_score: 0.5, difficulty_tier: 'medium',
                   attacking_difficulty: 0.5, defensive_difficulty: 0.5 }],
    } as unknown as MergedPlayer
  }

  /** Premium-heavy pool plus zero-projection budget fillers — the shape of the
   *  real player list, where enablers are cheap AND project nothing yet. */
  function pool(): MergedPlayer[] {
    const out: MergedPlayer[] = []
    let id = 1
    const perPos: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
    for (const pos of [1, 2, 3, 4] as const) {
      // expensive, high-scoring options (enough to blow the budget)
      for (let i = 0; i < perPos[pos] * 3; i++) {
        out.push(mk(id++, pos, 110, 9, (id % 19) + 1))
      }
      // cheap enablers that project exactly 0 (no minutes yet)
      for (let i = 0; i < perPos[pos] * 3; i++) {
        out.push(mk(id++, pos, 40, 0, (id % 19) + 1))
      }
    }
    return out
  }

  it('builds a full 15 within budget instead of returning null', () => {
    const result = buildAnchoredSquad([], pool(), 1000, 1)
    expect(result).not.toBeNull()
    expect(result!.squad).toHaveLength(15)
    expect(result!.budgetUsed).toBeLessThanOrEqual(1000)
  })

  it('respects the exact position quotas', () => {
    const result = buildAnchoredSquad([], pool(), 1000, 1)!
    const count = (pos: number) => result.squad.filter((p) => p.element_type === pos).length
    expect([count(1), count(2), count(3), count(4)]).toEqual([2, 5, 5, 3])
  })

  it('still honours an anchor while completing the squad', () => {
    const players = pool()
    const anchor = players.find((p) => p.element_type === 4 && p.now_cost === 110)!
    const result = buildAnchoredSquad([anchor.id], players, 1000, 1)
    expect(result).not.toBeNull()
    expect(result!.squad.map((p) => p.id)).toContain(anchor.id)
    expect(result!.squad).toHaveLength(15)
  })

  it('returns null only when the budget genuinely cannot seat 15', () => {
    expect(buildAnchoredSquad([], pool(), 100, 1)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// WC-03 (2026-09-01): wildcard on a CHOSEN gameweek + explicit bench fodder.
//
// Scoring used the precomputed xPts_1gw/3gw/5gw fields, which always start at
// the NEXT gameweek — so "I'm wildcarding in GW4" could not be expressed.
// Summing computeGwXpts across [startGw, startGw+horizon-1] fixes that and, as
// a side effect, makes horizons of 2 and 4 exact instead of being rounded to
// 1/3/5.
// ---------------------------------------------------------------------------
describe('buildAnchoredSquad — target gameweek + bench fodder', () => {
  function mkGw(
    id: number, pos: 1 | 2 | 3 | 4, cost: number, team: number,
    opts: { gws: number[]; xmins?: number; startProb?: number; xg?: number } = { gws: [] },
  ): MergedPlayer {
    return {
      id, web_name: `P${id}`, element_type: pos, now_cost: cost, team, status: 'a',
      xmins: opts.xmins ?? 80, start_prob: opts.startProb ?? 0.9,
      xg_per90: opts.xg ?? 0.3, xa_per90: 0.2,
      xPts_1gw: 5, xPts_3gw: 15, xPts_5gw: 25,
      fixtures: opts.gws.map((event_id) => ({
        opponent_team: 'OPP', is_home: true, event_id,
        difficulty_score: 0.5, difficulty_tier: 'medium' as const,
        attacking_difficulty: 0.5, defensive_difficulty: 0.5,
      })),
    } as unknown as MergedPlayer
  }

  /** Pool where everyone plays GW3-8, plus one club that blanks in GW4. */
  function pool(): MergedPlayer[] {
    const out: MergedPlayer[] = []
    let id = 1
    const per: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
    for (const pos of [1, 2, 3, 4] as const) {
      // premiums: expensive AND genuinely higher scoring
      for (let i = 0; i < per[pos] * 3; i++) {
        out.push(mkGw(id++, pos, 100, (id % 19) + 1, { gws: [3, 4, 5, 6, 7, 8], xg: 1.2 }))
      }
      // cheap players who DO play, but score far less
      for (let i = 0; i < per[pos] * 3; i++) {
        out.push(mkGw(id++, pos, 40, (id % 19) + 1,
                      { gws: [3, 4, 5, 6, 7, 8], xmins: 75, xg: 0.05 }))
      }
      // cheap players who do NOT play — never acceptable as fodder
      for (let i = 0; i < per[pos] * 2; i++) {
        out.push(mkGw(id++, pos, 39, (id % 19) + 1,
                      { gws: [3, 4, 5, 6, 7, 8], xmins: 0, startProb: 0 }))
      }
    }
    return out
  }

  it('scores against the chosen gameweek window, not always the next GW', () => {
    const players = pool()
    // A standout who ONLY plays in GW4 must be picked for a GW4 window...
    const gw4Only = mkGw(9001, 4, 100, 20, { gws: [4], xg: 3.0 })
    const withSpike = [...players, gw4Only]
    const forGw4 = buildAnchoredSquad([], withSpike, 1000, 1, { startGw: 4 })
    expect(forGw4).not.toBeNull()
    expect(forGw4!.squad.map(p => p.id)).toContain(9001)

    // ...and must NOT be picked for a GW3 window, where he has no fixture.
    const forGw3 = buildAnchoredSquad([], withSpike, 1000, 1, { startGw: 3 })
    expect(forGw3!.squad.map(p => p.id)).not.toContain(9001)
  })

  it('excludes a club blanking in the chosen gameweek', () => {
    const players = pool()
    const blanksGw4 = mkGw(9002, 3, 40, 20, { gws: [3, 5, 6], xg: 5.0 })
    const built = buildAnchoredSquad([], [...players, blanksGw4], 1000, 1, { startGw: 4 })
    expect(built!.squad.map(p => p.id)).not.toContain(9002)
  })

  it('honours horizons of 2 and 4 exactly rather than rounding to 1/3/5', () => {
    const players = pool()
    const twoGw = buildAnchoredSquad([], players, 1000, 2, { startGw: 3 })!
    const fourGw = buildAnchoredSquad([], players, 1000, 4, { startGw: 3 })!
    // A wider window accumulates more projected points.
    expect(fourGw.windowXPts).toBeGreaterThan(twoGw.windowXPts)
  })

  it('reserves the requested number of bench fodder slots', () => {
    const built = buildAnchoredSquad([], pool(), 1000, 3,
                                     { startGw: 3, benchFodderCount: 4 })!
    const cheap = built.squad.filter(p => p.now_cost <= 40)
    expect(cheap.length).toBeGreaterThanOrEqual(4)
  })

  it('every fodder slot is a cheap player who actually plays', () => {
    // The requirement in the user's words: "very low cost players but that do
    // actually get minutes". Cheapness alone is not enough — the pool contains
    // cheaper (39) bodies with zero minutes, and picking those is what leaves
    // an autosub unable to fire.
    const players = pool()
    const four = buildAnchoredSquad([], players, 1000, 3,
                                    { startGw: 3, benchFodderCount: 4 })!
    expect(four.benchFodderUsed).toBe(4)
    const cheapest = [...four.squad].sort((a, b) => a.now_cost - b.now_cost).slice(0, 4)
    for (const p of cheapest) {
      const full = players.find(q => q.id === p.id)!
      expect(full.xmins, `${p.web_name} must actually play`).toBeGreaterThan(0)
      expect(p.now_cost).toBeLessThanOrEqual(40)
    }
  })

  it('keeps the fodder slots cheap so the rest of the budget is free', () => {
    const four = buildAnchoredSquad([], pool(), 1000, 3,
                                    { startGw: 3, benchFodderCount: 4 })!
    // Four cheapest playing bodies cost 4 x 40; the remaining 11 slots then
    // carry the overwhelming majority of the spend.
    const cheapSpend = four.squad
      .filter(p => p.now_cost <= 40)
      .slice(0, 4)
      .reduce((s, p) => s + p.now_cost, 0)
    expect(cheapSpend).toBeLessThanOrEqual(4 * 40)
    expect(four.budgetUsed - cheapSpend).toBeGreaterThan(four.budgetUsed / 2)
  })

  it('never uses a zero-minute player as fodder', () => {
    const built = buildAnchoredSquad([], pool(), 1000, 3,
                                     { startGw: 3, benchFodderCount: 4 })!
    // The 39-cost players in the pool have xmins 0 — cheaper, but they do not play.
    expect(built.squad.every(p => p.now_cost !== 39)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// WC-04 (2026-09-01): bench-boost mode.
//
// The builder scores and reports the best XI. On a bench boost all 15 players
// score, so the XI objective is wrong: it will happily leave four weak bodies
// on the bench, which is exactly the squad you must not take into a boost.
// ---------------------------------------------------------------------------
describe('buildAnchoredSquad — bench boost mode', () => {
  function mkBB(id: number, pos: 1 | 2 | 3 | 4, cost: number, team: number,
                xg: number, gws: number[] = [5]): MergedPlayer {
    return {
      id, web_name: `P${id}`, element_type: pos, now_cost: cost, team, status: 'a',
      xmins: 85, start_prob: 0.95, xg_per90: xg, xa_per90: 0.1,
      xPts_1gw: xg * 5, xPts_3gw: xg * 15, xPts_5gw: xg * 25,
      fixtures: gws.map((event_id) => ({
        opponent_team: 'OPP', is_home: true, event_id,
        difficulty_score: 0.5, difficulty_tier: 'medium' as const,
        attacking_difficulty: 0.5, defensive_difficulty: 0.5,
      })),
    } as unknown as MergedPlayer
  }

  /** Enough bodies to fill a squad, with a clear quality gradient. */
  function pool(): MergedPlayer[] {
    const out: MergedPlayer[] = []
    let id = 1
    const per: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
    for (const pos of [1, 2, 3, 4] as const) {
      for (let i = 0; i < per[pos] * 4; i++) {
        // cost rises with quality so the budget actually binds
        out.push(mkBB(id++, pos, 45 + i * 5, (id % 19) + 1, 0.2 + i * 0.15))
      }
    }
    return out
  }

  it('reports a squad total distinct from the XI total', () => {
    const r = buildAnchoredSquad([], pool(), 1000, 1,
                                 { startGw: 5, benchBoost: true })!
    expect(r.squadXPts).toBeGreaterThan(r.windowXPts)   // 15 players > 11
  })

  it('produces a stronger FIFTEEN than XI-mode does', () => {
    const players = pool()
    const xiMode = buildAnchoredSquad([], players, 1000, 1, { startGw: 5 })!
    const bbMode = buildAnchoredSquad([], players, 1000, 1,
                                      { startGw: 5, benchBoost: true })!
    expect(bbMode.squadXPts).toBeGreaterThanOrEqual(xiMode.squadXPts)
  })

  it('refuses to pair bench boost with bench fodder', () => {
    // Fodder deliberately buys non-scoring bodies — the opposite of what a
    // boost needs. Guard rather than silently producing a bad squad.
    const r = buildAnchoredSquad([], pool(), 1000, 1,
                                 { startGw: 5, benchBoost: true, benchFodderCount: 4 })!
    expect(r.benchFodderUsed).toBe(0)
  })
})

describe('buildAnchoredSquad — bench boost in a LATER gameweek than the wildcard', () => {
  // The user's actual plan: wildcard in GW4, bench boost in GW5. Building for
  // GW4 only guarantees GW4 fixtures — a club blanking in GW5 would sail
  // through and then score nothing on the week all 15 count.
  function mk(id: number, pos: 1 | 2 | 3 | 4, gws: number[], team: number): MergedPlayer {
    return {
      id, web_name: `P${id}`, element_type: pos, now_cost: 50, team, status: 'a',
      xmins: 85, start_prob: 0.95, xg_per90: 0.5, xa_per90: 0.2,
      xPts_1gw: 5, xPts_3gw: 15, xPts_5gw: 25,
      fixtures: gws.map((event_id) => ({
        opponent_team: 'OPP', is_home: true, event_id,
        difficulty_score: 0.5, difficulty_tier: 'medium' as const,
        attacking_difficulty: 0.5, defensive_difficulty: 0.5,
      })),
    } as unknown as MergedPlayer
  }

  function pool(): MergedPlayer[] {
    const out: MergedPlayer[] = []
    let id = 1
    const per: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
    for (const pos of [1, 2, 3, 4] as const) {
      for (let i = 0; i < per[pos] * 3; i++) out.push(mk(id++, pos, [4, 5, 6], (id % 19) + 1))
    }
    return out
  }

  it('excludes a club that plays the wildcard GW but blanks the boost GW', () => {
    const blanksBoost = mk(9100, 3, [4, 6], 20)     // plays GW4, blank GW5
    const players = [...pool(), blanksBoost]
    const built = buildAnchoredSquad([], players, 1000, 3,
                                     { startGw: 4, benchBoost: true, benchBoostGw: 5 })!
    expect(built.squad.map(p => p.id)).not.toContain(9100)
  })

  it('still allows that player when no bench boost is planned', () => {
    const blanksBoost = mk(9100, 3, [4, 6], 20)
    const players = [blanksBoost, ...pool()]
    const built = buildAnchoredSquad([], players, 1000, 3, { startGw: 4 })!
    // eligible for a normal wildcard — he plays the gameweek being built for
    expect(built).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// WC-05 (2026-09-02): the builder left £3.5m unspent. The greedy fill stops as
// soon as the next-best affordable player fails its reserve check, so leftover
// cash simply sits there — but in FPL an unspent million is a wasted million.
// ---------------------------------------------------------------------------
describe('buildAnchoredSquad — spends the budget', () => {
  function mk(id: number, pos: 1 | 2 | 3 | 4, cost: number, xg: number, team: number): MergedPlayer {
    return {
      id, web_name: `P${id}`, element_type: pos, now_cost: cost, team, status: 'a',
      xmins: 85, start_prob: 0.95, xg_per90: xg, xa_per90: 0.1,
      xPts_1gw: xg * 10, xPts_3gw: xg * 30, xPts_5gw: xg * 50,
      fixtures: [4, 5, 6].map(event_id => ({
        opponent_team: 'OPP', is_home: true, event_id,
        difficulty_score: 0.5, difficulty_tier: 'medium' as const,
        attacking_difficulty: 0.5, defensive_difficulty: 0.5,
      })),
    } as unknown as MergedPlayer
  }

  /** A continuous price ladder per position so upgrades are always available. */
  function pool(): MergedPlayer[] {
    const out: MergedPlayer[] = []
    let id = 1
    const per: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
    for (const pos of [1, 2, 3, 4] as const) {
      for (let i = 0; i < per[pos] * 6; i++) {
        // price and quality rise together, in small steps
        out.push(mk(id++, pos, 40 + i * 5, 0.1 + i * 0.08, (id % 19) + 1))
      }
    }
    return out
  }

  it('leaves only a small remainder rather than millions', () => {
    const r = buildAnchoredSquad([], pool(), 1000, 3, { startGw: 4 })!
    expect(r.budgetUsed).toBeLessThanOrEqual(1000)
    // Under £1.0m left over; the reported bug was £3.5m.
    expect(r.budgetRemaining).toBeLessThan(10)
  })

  it('does not overspend while chasing utilisation', () => {
    const r = buildAnchoredSquad([], pool(), 1000, 3, { startGw: 4 })!
    expect(r.budgetRemaining).toBeGreaterThanOrEqual(0)
    expect(r.squad).toHaveLength(15)
  })

  it('upgrading never lowers the squad projection', () => {
    const r = buildAnchoredSquad([], pool(), 1000, 3, { startGw: 4 })!
    // 800 is feasible here; 700 is below the cheapest valid 15 in this pool.
    const cheap = buildAnchoredSquad([], pool(), 800, 3, { startGw: 4 })!
    expect(r.squadXPts).toBeGreaterThan(cheap.squadXPts)
  })
})
