// @vitest-environment node
// Phase 129 (COST-02): pre-season-squad route — ?include=inputs query-param gate (Wave 0 RED).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks BEFORE importing the route
vi.mock('fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))

import { readFile } from 'fs/promises'
import { NextRequest } from 'next/server'
import type { PreSeasonSquadResponse, PreSeasonPlayer, SeasonArchiveEntry } from '@/lib/types'

// Helper: build a NextRequest with optional ?include=inputs query param
function makeRequest(includeInputs = false): NextRequest {
  const url = includeInputs
    ? 'http://localhost/api/pre-season-squad?include=inputs'
    : 'http://localhost/api/pre-season-squad'
  return new NextRequest(url)
}

// Fixture: minimal valid PreSeasonSquad JSON shape (starters[11], bench[4], formation, budgetUsed)
function makePreSquadFixture() {
  const starters = [
    { id: 1, web_name: 'GK1', element_type: 1, team: 1, team_short_name: 'T1', now_cost: 50, total_points: 100, ppm: 0.5 },
    { id: 2, web_name: 'DEF1', element_type: 2, team: 1, team_short_name: 'T1', now_cost: 50, total_points: 100, ppm: 0.51 },
    { id: 3, web_name: 'DEF2', element_type: 2, team: 2, team_short_name: 'T2', now_cost: 50, total_points: 100, ppm: 0.52 },
    { id: 4, web_name: 'DEF3', element_type: 2, team: 2, team_short_name: 'T2', now_cost: 50, total_points: 100, ppm: 0.53 },
    { id: 5, web_name: 'DEF4', element_type: 2, team: 3, team_short_name: 'T3', now_cost: 50, total_points: 100, ppm: 0.54 },
    { id: 6, web_name: 'MID1', element_type: 3, team: 3, team_short_name: 'T3', now_cost: 65, total_points: 130, ppm: 0.55 },
    { id: 7, web_name: 'MID2', element_type: 3, team: 4, team_short_name: 'T4', now_cost: 65, total_points: 130, ppm: 0.56 },
    { id: 8, web_name: 'MID3', element_type: 3, team: 4, team_short_name: 'T4', now_cost: 65, total_points: 130, ppm: 0.57 },
    { id: 9, web_name: 'FWD1', element_type: 4, team: 5, team_short_name: 'T5', now_cost: 90, total_points: 150, ppm: 0.58 },
    { id: 10, web_name: 'FWD2', element_type: 4, team: 5, team_short_name: 'T5', now_cost: 90, total_points: 150, ppm: 0.59 },
    { id: 11, web_name: 'FWD3', element_type: 4, team: 1, team_short_name: 'T1', now_cost: 90, total_points: 150, ppm: 0.60 },
  ]
  const bench = [
    { id: 12, web_name: 'GK2', element_type: 1, team: 2, team_short_name: 'T2', now_cost: 45, total_points: 80, ppm: 0.45 },
    { id: 13, web_name: 'DEF5', element_type: 2, team: 3, team_short_name: 'T3', now_cost: 45, total_points: 80, ppm: 0.46 },
    { id: 14, web_name: 'MID4', element_type: 3, team: 4, team_short_name: 'T4', now_cost: 50, total_points: 90, ppm: 0.47 },
    { id: 15, web_name: 'FWD4', element_type: 4, team: 5, team_short_name: 'T5', now_cost: 55, total_points: 85, ppm: 0.44 },
  ]
  return {
    starters,
    bench,
    formation: '4-3-3',
    budgetUsed: 900,
  }
}

// Fixture: archive with 20 players, each with 6+ history entries totalling >= 500 minutes
function makeArchiveFixture(): Record<string, { history: Array<{ total_points: number; minutes: number; element: number }> }> {
  const archive: Record<string, { history: Array<{ total_points: number; minutes: number; element: number }> }> = {}
  for (let id = 1; id <= 20; id++) {
    archive[String(id)] = {
      history: Array.from({ length: 6 }, (_, i) => ({
        element: id,
        total_points: 5,
        minutes: 90,
      })),
    }
  }
  return archive
}

// Fixture: FPL bootstrap with 20 elements (2 GK, 5 DEF, 6 MID, 7 FWD) and 7 teams
// Team cap <=3 per team. Budget: 2×45 + 5×50 + 5×65 + 3×90 = 935 ≤ 1000
// Player layout: 7 teams, 20 players, max 3 per team:
//   Teams 1-6 get 3 players each = 18, teams 7 gets 2 = 20 total
function makeBootstrapFixture() {
  // Element types assigned so each position group is representable:
  // IDs 1-2: GK (element_type 1)
  // IDs 3-7: DEF (element_type 2)
  // IDs 8-13: MID (element_type 3)
  // IDs 14-20: FWD (element_type 4)  — 7 FWDs available so budget math and slot fills cleanly
  const layout: Array<{ element_type: 1 | 2 | 3 | 4; team: number; now_cost: number }> = [
    { element_type: 1, team: 1, now_cost: 45 }, // ID 1 GK
    { element_type: 1, team: 2, now_cost: 45 }, // ID 2 GK
    { element_type: 2, team: 3, now_cost: 50 }, // ID 3 DEF
    { element_type: 2, team: 4, now_cost: 50 }, // ID 4 DEF
    { element_type: 2, team: 5, now_cost: 50 }, // ID 5 DEF
    { element_type: 2, team: 6, now_cost: 50 }, // ID 6 DEF
    { element_type: 2, team: 7, now_cost: 50 }, // ID 7 DEF
    { element_type: 3, team: 1, now_cost: 65 }, // ID 8 MID
    { element_type: 3, team: 2, now_cost: 65 }, // ID 9 MID
    { element_type: 3, team: 3, now_cost: 65 }, // ID 10 MID
    { element_type: 3, team: 4, now_cost: 65 }, // ID 11 MID
    { element_type: 3, team: 5, now_cost: 65 }, // ID 12 MID
    { element_type: 3, team: 6, now_cost: 65 }, // ID 13 MID
    { element_type: 4, team: 7, now_cost: 90 }, // ID 14 FWD
    { element_type: 4, team: 1, now_cost: 90 }, // ID 15 FWD
    { element_type: 4, team: 2, now_cost: 90 }, // ID 16 FWD
    { element_type: 4, team: 3, now_cost: 90 }, // ID 17 FWD
    { element_type: 4, team: 4, now_cost: 90 }, // ID 18 FWD
    { element_type: 4, team: 5, now_cost: 90 }, // ID 19 FWD
    { element_type: 4, team: 6, now_cost: 90 }, // ID 20 FWD
    // Team counts: T1: 1+8+15=3, T2: 2+9+16=3, T3: 3+10+17=3, T4: 4+11+18=3,
    //              T5: 5+12+19=3, T6: 6+13+20=3, T7: 7+14=2 — all within teamCap=3 ✓
  ]

  const elements = layout.map((p, idx) => ({
    id: idx + 1,
    web_name: `Player${idx + 1}`,
    element_type: p.element_type,
    team: p.team,
    now_cost: p.now_cost,
  }))

  const teams = [1, 2, 3, 4, 5, 6, 7].map(id => ({
    id,
    name: `Team${id}`,
    short_name: `T${id}`,
  }))

  return { elements, teams }
}

// Helper: wire readFile mock dispatch by path substring
interface SetupMocksOpts {
  archive?: object | null
  bootstrap?: object | null
  preSquad?: object | null
  health?: object | null
}

function setupMocks(opts: SetupMocksOpts): void {
  const { archive = makeArchiveFixture(), bootstrap = makeBootstrapFixture(), preSquad = makePreSquadFixture(), health = null } = opts

  ;(readFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
    if (path.includes('pre_season_squad_health.json')) {
      if (health === null) {
        const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        throw err
      }
      return JSON.stringify(health)
    }
    if (path.includes('pre_season_squad.json')) {
      if (preSquad === null) {
        const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        throw err
      }
      return JSON.stringify(preSquad)
    }
    if (path.includes('season_archive_gw38.json')) {
      if (archive === null) {
        const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        throw err
      }
      return JSON.stringify(archive)
    }
    if (path.includes('fpl_bootstrap.json')) {
      if (bootstrap === null) {
        const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
        throw err
      }
      return JSON.stringify(bootstrap)
    }
    const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    throw err
  })
}

describe('Phase 129 (COST-02): /api/pre-season-squad ?include=inputs query-param gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.USE_BLOB = 'false'
  })

  it('omits inputs field when ?include=inputs is absent (Resolution 1 ILP path)', async () => {
    setupMocks({})
    const { GET } = await import('./route')
    const res = await GET(makeRequest(false))
    expect(res.status).toBe(200)
    const body = await res.json() as PreSeasonSquadResponse
    // No inputs field when query param is absent (D-02 — regression guard)
    expect(body.inputs).toBeUndefined()
    // Existing envelope fields still present
    expect(body.squad).not.toBeNull()
    expect(body.solver).toBe('ilp')
  })

  it('attaches inputs on ILP path when ?include=inputs is present', async () => {
    setupMocks({})
    const { GET } = await import('./route')
    const res = await GET(makeRequest(true))
    expect(res.status).toBe(200)
    const body = await res.json() as PreSeasonSquadResponse
    // inputs field present (COST-02)
    expect(body.inputs).toBeDefined()
    // players array non-empty with PreSeasonPlayer shape
    expect(body.inputs!.players).toBeInstanceOf(Array)
    expect(body.inputs!.players.length).toBeGreaterThan(0)
    const firstPlayer = body.inputs!.players[0] as PreSeasonPlayer
    expect(typeof firstPlayer.id).toBe('number')
    expect(typeof firstPlayer.web_name).toBe('string')
    expect(typeof firstPlayer.now_cost).toBe('number')
    expect(typeof firstPlayer.ppm).toBe('number')
    // budget_default === 1000 (D-04: FPL tenths = £100m)
    expect(body.inputs!.budget_default).toBe(1000)
    // solver preserved
    expect(body.solver).toBe('ilp')
  })

  it('attaches inputs on greedy path when ?include=inputs is present', async () => {
    // Greedy path: pre_season_squad.json absent, archive + bootstrap available
    setupMocks({ preSquad: null })
    const { GET } = await import('./route')
    const res = await GET(makeRequest(true))
    expect(res.status).toBe(200)
    const body = await res.json() as PreSeasonSquadResponse
    // inputs present on greedy path too
    expect(body.inputs).toBeDefined()
    expect(body.inputs!.players).toBeInstanceOf(Array)
    expect(body.inputs!.players.length).toBeGreaterThan(0)
    expect(body.inputs!.budget_default).toBe(1000)
    // solver is greedy on this path
    expect(body.solver).toBe('greedy')
  })

  it('scoreMap serialises as Record<string, number> with non-empty keys', async () => {
    setupMocks({})
    const { GET } = await import('./route')
    const res = await GET(makeRequest(true))
    expect(res.status).toBe(200)
    const body = await res.json() as PreSeasonSquadResponse
    expect(body.inputs).toBeDefined()
    // scoreMap must be a plain object (not a Map serialised as {})
    expect(typeof body.inputs!.scoreMap).toBe('object')
    // Pitfall 2 regression: Map → Record conversion; empty {} would be Pitfall 2 failure
    expect(Object.keys(body.inputs!.scoreMap).length).toBeGreaterThan(0)
    // Every value is a number
    for (const v of Object.values(body.inputs!.scoreMap)) {
      expect(typeof v).toBe('number')
    }
    // Every key parses to a finite number
    for (const k of Object.keys(body.inputs!.scoreMap)) {
      expect(Number.isFinite(Number(k))).toBe(true)
    }
  })

  it('returns 404 when archive absent (both with and without ?include=inputs)', async () => {
    // Both pre_season_squad.json and season_archive_gw38.json absent → 404
    setupMocks({ preSquad: null, archive: null })
    const { GET } = await import('./route')

    // Without ?include=inputs
    const res1 = await GET(makeRequest(false))
    expect(res1.status).toBe(404)
    const body1 = await res1.json() as { error: string }
    expect(body1.error).toBe('Archive not available')

    // Reset module cache so fresh import works
    vi.resetModules()
    setupMocks({ preSquad: null, archive: null })
    const { GET: GET2 } = await import('./route')

    // With ?include=inputs — same 404
    const res2 = await GET2(makeRequest(true))
    expect(res2.status).toBe(404)
    const body2 = await res2.json() as { error: string }
    expect(body2.error).toBe('Archive not available')
  })

  it('degrades gracefully when ?include=inputs is set but archive or bootstrap is missing (no 503, no inputs field)', async () => {
    // Resolution 1 hits (pre_season_squad.json available), but archive is missing
    // Should return 200 with solver: 'ilp' but NO inputs field (graceful degradation)
    setupMocks({ archive: null })
    const { GET } = await import('./route')
    const res = await GET(makeRequest(true))
    // Must NOT 503 — ILP squad is still valid
    expect(res.status).toBe(200)
    const body = await res.json() as PreSeasonSquadResponse
    expect(body.solver).toBe('ilp')
    // inputs field absent when archive/bootstrap missing (graceful degradation)
    expect(body.inputs).toBeUndefined()
  })
})
