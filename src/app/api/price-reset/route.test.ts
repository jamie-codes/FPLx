// @vitest-environment node
// Phase 133 (PRST-02/03/04): /api/price-reset route contract tests (TDD RED phase).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks BEFORE importing the route
vi.mock('fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))

import { readFile } from 'fs/promises'
import { NextRequest } from 'next/server'
import type { PriceResetResponse } from '@/lib/types'

// Helper: build a minimal NextRequest for the price-reset route
function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/price-reset')
}

// Helper: build a minimal FPL bootstrap fixture with the given elements
function makeBootstrap(
  elements: Array<{
    id: number
    web_name: string
    team_short_name?: string
    element_type: 1 | 2 | 3 | 4
    now_cost: number
    team: number
  }>,
) {
  const teamIds = [...new Set(elements.map(e => e.team))]
  const teams = teamIds.map(id => ({
    id,
    short_name: elements.find(e => e.team === id)?.team_short_name ?? `T${id}`,
  }))
  return { elements, teams }
}

// Helper: build a minimal merged_players fixture
function makeMergedPlayers(
  rows: Array<{
    id: number
    web_name: string
    team_short_name: string
    element_type: 1 | 2 | 3 | 4
    now_cost: number
    xPts_1gw?: number
  }>,
) {
  return rows
}

// Helper: wire readFile mock per-path
function setupMocks(opts: {
  baseline: Record<string, number> | null
  bootstrap: ReturnType<typeof makeBootstrap> | null
  mergedPlayers?: ReturnType<typeof makeMergedPlayers> | null
}): void {
  ;(readFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (path: string) => {
      if (path.includes('price_baseline.json')) {
        if (opts.baseline === null) {
          throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        }
        return JSON.stringify(opts.baseline)
      }
      if (path.includes('fpl_bootstrap.json')) {
        if (opts.bootstrap === null) {
          throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        }
        return JSON.stringify(opts.bootstrap)
      }
      if (path.includes('merged_players.json')) {
        if (opts.mergedPlayers === undefined || opts.mergedPlayers === null) {
          throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        }
        return JSON.stringify(opts.mergedPlayers)
      }
      throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    },
  )
}

describe('/api/price-reset contract (Phase 133 PRST-02/03/04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.USE_BLOB = 'false'
  })

  it('published_false_when_baseline_absent', async () => {
    // D-08: baseline absent → published: false, never 404
    setupMocks({
      baseline: null,
      bootstrap: makeBootstrap([
        { id: 1, web_name: 'Player1', element_type: 2, now_cost: 50, team: 1, team_short_name: 'T1' },
      ]),
    })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PriceResetResponse
    expect(body.published).toBe(false)
    expect(body.players).toEqual([])
    expect(body.value_targets).toEqual([])
    expect(typeof body.generated_at).toBe('string')
    expect(body.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('published_false_when_all_deltas_zero', async () => {
    // D-07: baseline matches current bootstrap exactly → published: false
    const baseline = { '1': 50, '2': 65 }
    const bootstrap = makeBootstrap([
      { id: 1, web_name: 'Player1', element_type: 2, now_cost: 50, team: 1, team_short_name: 'T1' },
      { id: 2, web_name: 'Player2', element_type: 3, now_cost: 65, team: 1, team_short_name: 'T1' },
    ])
    setupMocks({ baseline, bootstrap })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PriceResetResponse
    expect(body.published).toBe(false)
    expect(body.players).toEqual([])
  })

  it('published_true_with_sorted_deltas', async () => {
    // D-07: non-zero deltas → published: true, players sorted by abs(delta_cost) DESC
    // id=1: baseline 50, now 45, delta = -5
    // id=2: baseline 65, now 70, delta = +5
    // id=3: baseline 90, now 90, delta = 0 (excluded)
    const baseline = { '1': 50, '2': 65, '3': 90 }
    const bootstrap = makeBootstrap([
      { id: 1, web_name: 'PlayerA', element_type: 2, now_cost: 45, team: 1, team_short_name: 'ARS' },
      { id: 2, web_name: 'PlayerB', element_type: 3, now_cost: 70, team: 1, team_short_name: 'ARS' },
      { id: 3, web_name: 'PlayerC', element_type: 4, now_cost: 90, team: 1, team_short_name: 'ARS' },
    ])
    setupMocks({ baseline, bootstrap })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PriceResetResponse
    expect(body.published).toBe(true)
    // id=3 excluded (delta zero)
    expect(body.players.length).toBe(2)
    // sorted descending by abs(delta_cost)
    expect(Math.abs(body.players[0].delta_cost)).toBeGreaterThanOrEqual(
      Math.abs(body.players[1].delta_cost),
    )
    // shape of first player
    const p = body.players[0]
    expect(typeof p.player_id).toBe('number')
    expect(typeof p.name).toBe('string')
    expect(typeof p.team).toBe('string')
    expect(typeof p.element_type).toBe('number')
    expect(typeof p.baseline_cost).toBe('number')
    expect(typeof p.current_cost).toBe('number')
    expect(typeof p.delta_cost).toBe('number')
  })

  it('value_targets_filters_fall_above_position_median', async () => {
    // 4 MIDs in merged_players with xPts_1gw [3.0, 4.0, 5.0, 8.0]; median = 4.5
    // id=10 (xPts=8.0, above median) has delta -3 → included in value_targets
    // id=11 (xPts=4.0, below median) has delta -2 → excluded
    // id=12 (xPts=5.0, above median) has delta 0 → excluded (not a fall)
    // id=13 (xPts=3.0, below median) has delta -1 → excluded
    const baseline = { '10': 70, '11': 65, '12': 80, '13': 55 }
    const bootstrap = makeBootstrap([
      { id: 10, web_name: 'MidA', element_type: 3, now_cost: 67, team: 1, team_short_name: 'ARS' },
      { id: 11, web_name: 'MidB', element_type: 3, now_cost: 63, team: 2, team_short_name: 'CHE' },
      { id: 12, web_name: 'MidC', element_type: 3, now_cost: 80, team: 3, team_short_name: 'MCI' },
      { id: 13, web_name: 'MidD', element_type: 3, now_cost: 54, team: 4, team_short_name: 'LIV' },
    ])
    const mergedPlayers = makeMergedPlayers([
      { id: 10, web_name: 'MidA', team_short_name: 'ARS', element_type: 3, now_cost: 67, xPts_1gw: 8.0 },
      { id: 11, web_name: 'MidB', team_short_name: 'CHE', element_type: 3, now_cost: 63, xPts_1gw: 4.0 },
      { id: 12, web_name: 'MidC', team_short_name: 'MCI', element_type: 3, now_cost: 80, xPts_1gw: 5.0 },
      { id: 13, web_name: 'MidD', team_short_name: 'LIV', element_type: 3, now_cost: 54, xPts_1gw: 3.0 },
    ])
    setupMocks({ baseline, bootstrap, mergedPlayers })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PriceResetResponse
    expect(body.published).toBe(true)
    expect(body.value_targets.length).toBe(1)
    const vt = body.value_targets[0]
    expect(vt.player_id).toBe(10)
    expect(vt.position_median_xPts).toBe(4.5)
    expect(vt.position_rank).toBe(1)
    expect(vt.position_label).toBe('MID')
    expect(vt.delta_cost).toBeLessThan(0)
  })

  it('value_targets_sorted_by_largest_fall_first', async () => {
    // Two MIDs both qualifying: one delta -3, one delta -1
    // Should be sorted ascending by delta_cost (most negative first)
    const baseline = { '20': 70, '21': 65, '22': 60 }
    const bootstrap = makeBootstrap([
      { id: 20, web_name: 'MidX', element_type: 3, now_cost: 67, team: 1, team_short_name: 'ARS' },
      { id: 21, web_name: 'MidY', element_type: 3, now_cost: 64, team: 2, team_short_name: 'CHE' },
      { id: 22, web_name: 'MidZ', element_type: 3, now_cost: 60, team: 3, team_short_name: 'MCI' },
    ])
    // Both id=20 (delta=-3, xPts=9.0) and id=21 (delta=-1, xPts=7.0) above median
    // id=22 (delta=0, excluded from players)
    // Median of [9.0, 7.0, 6.0] = 7.0; both 9.0 and 7.0 >= median... but ">" required
    // Use clear above-median: median of 3 values [9.0, 7.0, 5.0] = 7.0
    // id=20 xPts=9.0 > 7.0 ✓ delta=-3
    // id=21 xPts=7.0 NOT > 7.0 ✗
    // Let's use xPts [9.0, 8.0, 5.0] → median 8.0; id=20 (9.0>8.0 ✓), id=21 (8.0 not >8.0 ✗)
    // Adjust: use 4 players [10.0, 8.0, 6.0, 4.0] → median 7.0; both 10 and 8 qualify
    const baseline2 = { '30': 70, '31': 65, '32': 60, '33': 55 }
    const bootstrap2 = makeBootstrap([
      { id: 30, web_name: 'MidP', element_type: 3, now_cost: 67, team: 1, team_short_name: 'ARS' },
      { id: 31, web_name: 'MidQ', element_type: 3, now_cost: 64, team: 2, team_short_name: 'CHE' },
      { id: 32, web_name: 'MidR', element_type: 3, now_cost: 60, team: 3, team_short_name: 'MCI' },
      { id: 33, web_name: 'MidS', element_type: 3, now_cost: 55, team: 4, team_short_name: 'LIV' },
    ])
    // 4 MIDs: xPts [10.0, 8.0, 6.0, 4.0] → median = (8+6)/2 = 7.0
    // id=30: delta=-3, xPts=10.0 > 7.0 ✓
    // id=31: delta=-1, xPts=8.0 > 7.0 ✓
    // id=32: delta=0, excluded (zero delta)
    // id=33: delta=0, excluded
    const mergedPlayers2 = makeMergedPlayers([
      { id: 30, web_name: 'MidP', team_short_name: 'ARS', element_type: 3, now_cost: 67, xPts_1gw: 10.0 },
      { id: 31, web_name: 'MidQ', team_short_name: 'CHE', element_type: 3, now_cost: 64, xPts_1gw: 8.0 },
      { id: 32, web_name: 'MidR', team_short_name: 'MCI', element_type: 3, now_cost: 60, xPts_1gw: 6.0 },
      { id: 33, web_name: 'MidS', team_short_name: 'LIV', element_type: 3, now_cost: 55, xPts_1gw: 4.0 },
    ])
    setupMocks({ baseline: baseline2, bootstrap: bootstrap2, mergedPlayers: mergedPlayers2 })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PriceResetResponse
    expect(body.published).toBe(true)
    expect(body.value_targets.length).toBe(2)
    // Sorted ascending by delta_cost (most negative first = largest fall first)
    expect(body.value_targets[0].delta_cost).toBeLessThan(body.value_targets[1].delta_cost)
    // id=30 has delta=-3 (more negative than id=31 delta=-1)
    expect(body.value_targets[0].player_id).toBe(30)
    expect(body.value_targets[1].player_id).toBe(31)
  })

  it('malformed_merged_players_does_not_break_route', async () => {
    // merged_players throws / returns invalid JSON → value_targets=[] but published:true + players populated
    const baseline = { '1': 50, '2': 65 }
    const bootstrap = makeBootstrap([
      { id: 1, web_name: 'Player1', element_type: 2, now_cost: 45, team: 1, team_short_name: 'T1' },
      { id: 2, web_name: 'Player2', element_type: 3, now_cost: 70, team: 1, team_short_name: 'T1' },
    ])
    ;(readFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (path: string) => {
        if (path.includes('price_baseline.json')) return JSON.stringify(baseline)
        if (path.includes('fpl_bootstrap.json')) return JSON.stringify(bootstrap)
        if (path.includes('merged_players.json')) throw new Error('Unexpected read error')
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      },
    )
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PriceResetResponse
    // Deltas exist (id=1 delta=-5, id=2 delta=+5) → published: true
    expect(body.published).toBe(true)
    expect(body.players.length).toBeGreaterThan(0)
    // merged_players failed → no value_targets
    expect(body.value_targets).toEqual([])
  })
})
