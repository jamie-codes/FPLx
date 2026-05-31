// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeLiveScore } from './live-gw'
import type { LivePlayerStats } from './live-gw'
import type { SquadPick } from './squad-adapter'
import type { AutoSubRecord } from './live-gw'

// ── helpers ────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<LivePlayerStats> = {}): LivePlayerStats {
  return {
    goals_scored: 0,
    assists: 0,
    bonus: 0,
    clean_sheets: 0,
    saves: 0,
    minutes: 90,
    total_points: 2,
    yellow_cards: 0,
    red_cards: 0,
    ...overrides,
  }
}

function makePick(overrides: Partial<SquadPick> = {}): SquadPick {
  return {
    element: 1,
    position: 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
    ...overrides,
  }
}

/** Build a 15-pick squad: positions 1–15, element ids 1–15 */
function makeSquad(): SquadPick[] {
  return Array.from({ length: 15 }, (_, i) => makePick({ element: i + 1, position: i + 1 }))
}

/** Captain on element 2, VC on element 3 */
function makeSquadWithCaptain(): SquadPick[] {
  return makeSquad().map(p => ({
    ...p,
    is_captain:       p.element === 2,
    is_vice_captain:  p.element === 3,
  }))
}

function makeStatsMap(entries: [number, Partial<LivePlayerStats>][]): Map<number, LivePlayerStats> {
  const m = new Map<number, LivePlayerStats>()
  for (const [id, overrides] of entries) {
    m.set(id, makeStats(overrides))
  }
  return m
}

function makeNameMap(ids: number[]): Map<number, { web_name: string; team: number }> {
  const m = new Map<number, { web_name: string; team: number }>()
  for (const id of ids) {
    m.set(id, { web_name: `Player${id}`, team: id * 10 })
  }
  return m
}

const ALL_IDS = Array.from({ length: 15 }, (_, i) => i + 1)
const NAME_MAP = makeNameMap(ALL_IDS)

// ── tests ──────────────────────────────────────────────────────────────────

describe('computeLiveScore', () => {
  it('T1: captain played → ×2 multiplier on captain, total reflects doubled points', () => {
    const picks = makeSquadWithCaptain()
    // element 2 is captain, stats: 6 pts; everyone else 2 pts
    const statsMap = makeStatsMap([[2, { total_points: 6, minutes: 90 }]])
    // fill remaining 14 with default 2 pts
    for (const id of ALL_IDS.filter(id => id !== 2)) {
      statsMap.set(id, makeStats({ total_points: 2, minutes: 90 }))
    }
    const result = computeLiveScore(picks, [], null, statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(false)
    expect(result.effective_captain_id).toBe(2)
    // Captain row: 6 × 2 = 12; other 10 starters: 2 pts each = 20; total = 32
    expect(result.total_points).toBe(32)
    const captainRow = result.xi.find(p => p.element === 2)!
    expect(captainRow.multiplier).toBe(2)
    expect(captainRow.live_points).toBe(12)
  })

  it('T2: captain 0 min, VC played → VC gets ×2, vc_promoted = true', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = makeStatsMap([[2, { total_points: 0, minutes: 0 }]])
    for (const id of ALL_IDS.filter(id => id !== 2)) {
      statsMap.set(id, makeStats({ total_points: 3, minutes: 90 }))
    }
    const result = computeLiveScore(picks, [], null, statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(true)
    expect(result.effective_captain_id).toBe(3)
    const vcRow = result.xi.find(p => p.element === 3)!
    expect(vcRow.multiplier).toBe(2)
    expect(vcRow.live_points).toBe(6)
    // Captain 0 pts × 1 multiplier (demoted) — not in XI for total if subbed off? Captain was pos 2
    // Positions 1–11 in XI: elements 1–11; captain (elem 2, pos 2, 0 pts) is in XI
    const captainRow = result.xi.find(p => p.element === 2)!
    expect(captainRow.multiplier).toBe(1)
  })

  it('T3: captain and VC both 0 min → multiplier = 1 for both, vc_promoted = false', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 2, minutes: id <= 3 ? 0 : 90 }))
    }
    const result = computeLiveScore(picks, [], null, statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(false)
    expect(result.effective_captain_id).toBe(2)
    const captainRow = result.xi.find(p => p.element === 2)!
    expect(captainRow.multiplier).toBe(1)
    const vcRow = result.xi.find(p => p.element === 3)!
    expect(vcRow.multiplier).toBe(1)
  })

  it('T4: TC chip + captain 0 min → VC gets ×3', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 5, minutes: id === 2 ? 0 : 90 }))
    }
    const result = computeLiveScore(picks, [], '3xc', statsMap, NAME_MAP)
    expect(result.vc_promoted).toBe(true)
    const vcRow = result.xi.find(p => p.element === 3)!
    expect(vcRow.multiplier).toBe(3)
    expect(vcRow.live_points).toBe(15)
  })

  it('T5: Bench Boost → all 15 in XI, bench empty, total = sum of all 15', () => {
    const picks = makeSquadWithCaptain()
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 4, minutes: 90 }))
    }
    const result = computeLiveScore(picks, [], 'bboost', statsMap, NAME_MAP)
    expect(result.xi).toHaveLength(15)
    expect(result.bench).toHaveLength(0)
    expect(result.auto_subs).toHaveLength(0)
    // captain elem 2 gets ×2, so: 14 × 4 + 1 × 8 = 56 + 8 = 64
    expect(result.total_points).toBe(64)
  })

  it('T6: autosub applied → subbed-out player not in XI total, subbed-in player counted', () => {
    const picks = makeSquad()  // no captain (edge is fine for this test)
    const sub: AutoSubRecord = { entry: 1, element_in: 12, element_out: 5, event: 38 }
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 3, minutes: id === 5 ? 0 : 90 }))
    }
    const result = computeLiveScore(picks, [sub], null, statsMap, NAME_MAP)
    // Element 5 subbed out → not in XI
    const subbedOut = result.xi.find(p => p.element === 5)
    expect(subbedOut).toBeUndefined()
    // Element 12 subbed in → in XI
    const subbedIn = result.xi.find(p => p.element === 12)
    expect(subbedIn).not.toBeUndefined()
    expect(subbedIn!.is_subbed_in).toBe(true)
    // Element 5 in bench
    const outOnBench = result.bench.find(p => p.element === 5)
    expect(outOnBench!.is_subbed_out).toBe(true)
    // XI = 11 players (1,2,3,4, [not5], 6,7,8,9,10,11, 12-subbed-in)
    expect(result.xi).toHaveLength(11)
  })

  it('T7: empty liveStatsMap → all stats zero, total = 0, no crash', () => {
    const picks = makeSquadWithCaptain()
    const result = computeLiveScore(picks, [], null, new Map(), NAME_MAP)
    expect(result.total_points).toBe(0)
    expect(result.xi).toHaveLength(11)
    result.xi.forEach(p => {
      expect(p.stats.total_points).toBe(0)
      expect(p.live_points).toBe(0)
    })
  })

  it('T8: auto_subs log lists player_out name and minutes played', () => {
    const picks = makeSquad()
    const sub: AutoSubRecord = { entry: 1, element_in: 13, element_out: 7, event: 38 }
    const statsMap = new Map<number, LivePlayerStats>()
    for (const id of ALL_IDS) {
      statsMap.set(id, makeStats({ total_points: 2, minutes: id === 7 ? 15 : 90 }))
    }
    const result = computeLiveScore(picks, [sub], null, statsMap, NAME_MAP)
    expect(result.auto_subs).toHaveLength(1)
    expect(result.auto_subs[0].player_out).toBe('Player7')
    expect(result.auto_subs[0].player_in).toBe('Player13')
    expect(result.auto_subs[0].minutes_played_by_out).toBe(15)
  })
})
