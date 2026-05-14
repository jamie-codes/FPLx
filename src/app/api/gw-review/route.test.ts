// @vitest-environment node
// Phase 98 PGW-01 — /api/gw-review bench computation contract.
// Sources of truth:
//   .planning/phases/98-post-gw-review-core/98-CONTEXT.md §D-09
//   .planning/phases/98-post-gw-review-core/98-RESEARCH.md Pattern 4, Pitfall 4, Pitfall 5
//   .planning/phases/98-post-gw-review-core/98-PATTERNS.md src/app/api/gw-review/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// Mock fs/promises so the blob-base read is a JSON literal in memory.
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async () => JSON.stringify({ gw: 34, average_score: 55 })),
}))

interface Pick {
  element: number
  position: number
  multiplier: number
  is_captain: boolean
  is_vice_captain: boolean
  total_points: number
}

function mockUpstream(
  picks: Pick[],
  elements: Array<{ id: number; web_name: string }>,
  dreamTeam: { top_player: { id: number; points: number }; team: Array<{ element: number; points: number; position: number }> } | null = { top_player: { id: 999, points: 0 }, team: [] },
  dreamTeamOk: boolean = true,
  live: { elements: Array<{ id: number; stats: { total_points: number } }> } | null = null,
  liveOk: boolean = true,
) {
  // When no explicit live data is provided, synthesise it from pick.total_points
  // so baseline tests (which predate FIX-03/04) continue to see deterministic data.
  const effectiveLive = live ?? {
    elements: picks.map((p) => ({ id: p.element, stats: { total_points: p.total_points } })),
  }
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/picks/')) {
      return new Response(JSON.stringify({
        entry_history: { points: 72, points_on_bench: 8, event: 34 },
        picks,
      }), { status: 200 })
    }
    if (url.includes('/bootstrap-static/')) {
      return new Response(JSON.stringify({ elements }), { status: 200 })
    }
    if (url.includes('/dream-team/')) {
      if (!dreamTeamOk) return new Response('', { status: 503 })
      return new Response(JSON.stringify(dreamTeam), { status: 200 })
    }
    if (url.includes('/live/')) {
      if (!liveOk) return new Response('', { status: 503 })
      return new Response(JSON.stringify(effectiveLive), { status: 200 })
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function makeRequest(teamId = '12345', gw = '34') {
  return new NextRequest(`http://localhost/api/gw-review?teamId=${teamId}&gw=${gw}`)
}

function starter(element: number, total_points: number, opts: Partial<Pick> = {}): Pick {
  return { element, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false, total_points, ...opts }
}

function bench(element: number, total_points: number): Pick {
  return { element, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false, total_points }
}

function dreamTeamPayload(
  picks: Array<{ element: number; points: number; position: number }>
): { top_player: { id: number; points: number }; team: typeof picks } {
  return {
    top_player: { id: picks[0]?.element ?? 999, points: picks[0]?.points ?? 0 },
    team: picks,
  }
}

// Build a minimal 11-starter array with positions 1–11
function makeStarters(): Pick[] {
  return Array.from({ length: 11 }, (_, i) => ({
    element: i + 1,
    position: i + 1,
    multiplier: i === 0 ? 2 : 1,  // element 1 is captain
    is_captain: i === 0,
    is_vice_captain: i === 1,
    total_points: i === 0 ? 5 : 2,
  }))
}

beforeEach(() => {})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Phase 98 PGW-01: /api/gw-review bench computation', () => {
  it('returns best bench player from picks with position > 11 (highest total_points wins)', async () => {
    const starters = makeStarters()
    const benchPicks = [bench(101, 2), bench(102, 9), bench(103, 5), bench(104, 1)]
    const allPicks = [...starters, ...benchPicks]

    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Pickford' },
      { id: 102, web_name: 'Watkins' },
      { id: 103, web_name: 'Andersen' },
      { id: 104, web_name: 'Estupinan' },
    ]

    mockUpstream(allPicks, elements)

    const response = await GET(makeRequest())
    expect(response.status).toBe(200)

    const body = await response.json() as {
      best_bench_player_name: string
      best_bench_player_pts: number
      your_score: number
      bench_pts_left: number
      average_score: number
      gw: number
    }

    expect(body.best_bench_player_name).toBe('Watkins')
    expect(body.best_bench_player_pts).toBe(9)
    // Existing fields unchanged
    expect(body.your_score).toBe(72)
    expect(body.bench_pts_left).toBe(8)
    expect(body.average_score).toBe(55)
    expect(body.gw).toBe(34)
  })

  it('identifies the highest-scoring bench player (not simply the first by position order)', async () => {
    const starters = makeStarters()
    const benchPicks = [bench(201, 1), bench(202, 0), bench(203, 12), bench(204, 4)]
    const allPicks = [...starters, ...benchPicks]

    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 201, web_name: 'Ward' },
      { id: 202, web_name: 'Hall' },
      { id: 203, web_name: 'Mateta' },
      { id: 204, web_name: 'Nelson' },
    ]

    mockUpstream(allPicks, elements)

    const response = await GET(makeRequest())
    expect(response.status).toBe(200)

    const body = await response.json() as {
      best_bench_player_name: string
      best_bench_player_pts: number
      your_score: number
      bench_pts_left: number
      average_score: number
      gw: number
    }

    expect(body.best_bench_player_name).toBe('Mateta')
    expect(body.best_bench_player_pts).toBe(12)
    // Existing fields unchanged
    expect(body.your_score).toBe(72)
    expect(body.bench_pts_left).toBe(8)
    expect(body.average_score).toBe(55)
    expect(body.gw).toBe(34)
  })

  it("returns name '—' and pts 0 when bench picks array is empty (Pitfall 5)", async () => {
    // Exactly 11 starting picks at positions 1–11, ZERO bench picks
    const starters = Array.from({ length: 11 }, (_, i) => ({
      element: i + 1,
      position: i + 1,
      multiplier: i === 0 ? 2 : 1,
      is_captain: i === 0,
      is_vice_captain: i === 1,
      total_points: 3,
    }))

    const elements = starters.map(s => ({ id: s.element, web_name: `Starter${s.element}` }))

    mockUpstream(starters, elements)

    const response = await GET(makeRequest())
    expect(response.status).toBe(200)

    const body = await response.json() as {
      best_bench_player_name: string
      best_bench_player_pts: number
      your_score: number
      bench_pts_left: number
      average_score: number
      gw: number
    }

    expect(body.best_bench_player_name).toBe('—')
    expect(body.best_bench_player_pts).toBe(0)
    // Existing fields unchanged
    expect(body.your_score).toBe(72)
    expect(body.bench_pts_left).toBe(8)
    expect(body.average_score).toBe(55)
    expect(body.gw).toBe(34)
  })
})

describe('Phase 99 PGW-03: /api/gw-review benchmark + missed players', () => {
  it('returns benchmark_label="Dream team" and benchmark_score=sum(team[*].points) when dream-team fetch succeeds', async () => {
    const starters = makeStarters()
    const benchPicks = [bench(101, 2), bench(102, 9), bench(103, 5), bench(104, 1)]
    const allPicks = [...starters, ...benchPicks]
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Pickford' },
      { id: 102, web_name: 'Watkins' },
      { id: 103, web_name: 'Andersen' },
      { id: 104, web_name: 'Estupinan' },
      { id: 501, web_name: 'Saka' },
      { id: 502, web_name: 'Palmer' },
    ]
    // Dream team: 11 entries; 2 NOT in user picks (501 + 502) → expected missed
    const dt = dreamTeamPayload([
      { element: 1, points: 10, position: 1 },   // owned (captain)
      { element: 2, points: 9,  position: 2 },   // owned
      { element: 3, points: 8,  position: 3 },   // owned
      { element: 4, points: 7,  position: 4 },   // owned
      { element: 5, points: 6,  position: 5 },   // owned
      { element: 6, points: 6,  position: 6 },   // owned
      { element: 7, points: 5,  position: 7 },   // owned
      { element: 8, points: 5,  position: 8 },   // owned
      { element: 501, points: 12, position: 9 }, // MISSED
      { element: 502, points: 11, position: 10 },// MISSED
      { element: 102, points: 9, position: 11 }, // owned via bench (101..104 are bench picks)
    ])
    mockUpstream(allPicks, elements, dt, true)
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as { benchmark_label: string; benchmark_score: number; missed_players: { name: string; pts: number }[] }
    expect(body.benchmark_label).toBe('Dream team')
    expect(body.benchmark_score).toBe(10 + 9 + 8 + 7 + 6 + 6 + 5 + 5 + 12 + 11 + 9)
    // Missed sorted desc by pts: Saka (12) then Palmer (11)
    expect(body.missed_players).toEqual([
      { name: 'Saka', pts: 12 },
      { name: 'Palmer', pts: 11 },
    ])
  })

  it('returns benchmark_label="FPL average" and missed_players=[] when dream-team fetch fails (503)', async () => {
    const starters = makeStarters()
    const benchPicks = [bench(101, 2), bench(102, 9), bench(103, 5), bench(104, 1)]
    const allPicks = [...starters, ...benchPicks]
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Pickford' },
      { id: 102, web_name: 'Watkins' },
      { id: 103, web_name: 'Andersen' },
      { id: 104, web_name: 'Estupinan' },
    ]
    // dreamTeamOk = false → mock returns 503 → route falls back to average_score
    mockUpstream(allPicks, elements, null, false)
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as { benchmark_label: string; benchmark_score: number; missed_players: unknown[] }
    expect(body.benchmark_label).toBe('FPL average')
    expect(body.benchmark_score).toBe(55) // average_score from mocked fs/promises blob
    expect(body.missed_players).toEqual([])
  })

  it('missed_players contains only dream-team elements not in user squad, sorted desc by pts, capped at 3', async () => {
    const starters = makeStarters() // user owns elements 1..11
    const allPicks = [...starters] // no bench
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 901, web_name: 'A' },
      { id: 902, web_name: 'B' },
      { id: 903, web_name: 'C' },
      { id: 904, web_name: 'D' },
      { id: 905, web_name: 'E' },
    ]
    // 5 dream-team players NOT in user picks: 901..905 with pts 15,14,13,12,11
    // Plus 6 dream-team players that ARE in user picks (elements 1..6)
    const dt = dreamTeamPayload([
      { element: 901, points: 15, position: 1 },
      { element: 902, points: 14, position: 2 },
      { element: 903, points: 13, position: 3 },
      { element: 904, points: 12, position: 4 },
      { element: 905, points: 11, position: 5 },
      { element: 1, points: 5, position: 6 },
      { element: 2, points: 4, position: 7 },
      { element: 3, points: 4, position: 8 },
      { element: 4, points: 3, position: 9 },
      { element: 5, points: 3, position: 10 },
      { element: 6, points: 2, position: 11 },
    ])
    mockUpstream(allPicks, elements, dt, true)
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as { missed_players: { name: string; pts: number }[] }
    expect(body.missed_players).toHaveLength(3)
    expect(body.missed_players).toEqual([
      { name: 'A', pts: 15 },
      { name: 'B', pts: 14 },
      { name: 'C', pts: 13 },
    ])
  })

  it('missed_players excludes bench players that the user owns (cross-ref all 15 picks)', async () => {
    const starters = makeStarters() // owns 1..11
    const benchPicks = [bench(401, 3), bench(402, 2), bench(403, 1), bench(404, 0)]
    const allPicks = [...starters, ...benchPicks]
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 401, web_name: 'BenchA' },
      { id: 402, web_name: 'BenchB' },
      { id: 403, web_name: 'BenchC' },
      { id: 404, web_name: 'BenchD' },
      { id: 999, web_name: 'NotOwned' },
    ]
    // Dream team includes bench element 401 — must NOT appear in missed_players
    const dt = dreamTeamPayload([
      { element: 999, points: 20, position: 1 }, // missed
      { element: 401, points: 15, position: 2 }, // owned via bench → NOT missed
      { element: 1, points: 10, position: 3 },
      { element: 2, points: 9, position: 4 },
      { element: 3, points: 8, position: 5 },
      { element: 4, points: 7, position: 6 },
      { element: 5, points: 6, position: 7 },
      { element: 6, points: 5, position: 8 },
      { element: 7, points: 4, position: 9 },
      { element: 8, points: 3, position: 10 },
      { element: 9, points: 2, position: 11 },
    ])
    mockUpstream(allPicks, elements, dt, true)
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as { missed_players: { name: string; pts: number }[] }
    // Only element 999 ('NotOwned') is genuinely missed; 401 is on the bench
    expect(body.missed_players).toEqual([{ name: 'NotOwned', pts: 20 }])
    expect(body.missed_players.find(p => p.name === 'BenchA')).toBeUndefined()
  })
})

describe('Phase 110 FIX-03/04: /api/gw-review live endpoint for settled GW points', () => {
  // Test 1 (FIX-03 RED): top_scorer_pts must come from event/{gw}/live/ not pick.total_points
  it('top_scorer_pts equals live total_points for the top starter (FIX-03)', async () => {
    const starters = makeStarters()
    // starters[0] is element=1 captain; pick.total_points=5 but live returns 14
    // starters[1..10] have pick.total_points=2 and live returns 4
    const benchPicks = [bench(101, 0), bench(102, 0), bench(103, 0), bench(104, 0)]
    const allPicks = [...starters, ...benchPicks]
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Bench1' },
      { id: 102, web_name: 'Bench2' },
      { id: 103, web_name: 'Bench3' },
      { id: 104, web_name: 'Bench4' },
    ]
    // Live data: element=1 has 14 pts (highest), others have 4
    const liveData = {
      elements: [
        { id: 1, stats: { total_points: 14 } },
        ...Array.from({ length: 10 }, (_, i) => ({ id: i + 2, stats: { total_points: 4 } })),
        { id: 101, stats: { total_points: 2 } },
        { id: 102, stats: { total_points: 1 } },
        { id: 103, stats: { total_points: 0 } },
        { id: 104, stats: { total_points: 0 } },
      ],
    }
    mockUpstream(allPicks, elements, null, false, liveData, true)
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as {
      top_scorer_pts: number
      top_scorer_name: string
    }
    // FIX-03: must be 14 (live), not 5 (pick.total_points)
    expect(body.top_scorer_pts).toBe(14)
    expect(body.top_scorer_name).toBe('Player1')
  })

  // Test 2 (FIX-04 RED): best_bench_player_pts must come from event/{gw}/live/ not pick.total_points
  it('best_bench_player_pts equals live total_points for the best bench player (FIX-04)', async () => {
    const starters = makeStarters()
    // bench picks all have pick.total_points=0 (settled GW behaviour)
    const benchPicks = [bench(101, 0), bench(102, 0), bench(103, 0), bench(104, 0)]
    const allPicks = [...starters, ...benchPicks]
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Pickford' },
      { id: 102, web_name: 'Watkins' },
      { id: 103, web_name: 'Andersen' },
      { id: 104, web_name: 'Estupinan' },
    ]
    // Live data: bench element=102 (Watkins) has highest bench pts at 9
    const liveData = {
      elements: [
        ...starters.map(s => ({ id: s.element, stats: { total_points: 5 } })),
        { id: 101, stats: { total_points: 2 } },
        { id: 102, stats: { total_points: 9 } },
        { id: 103, stats: { total_points: 5 } },
        { id: 104, stats: { total_points: 1 } },
      ],
    }
    mockUpstream(allPicks, elements, null, false, liveData, true)
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as {
      best_bench_player_pts: number
      best_bench_player_name: string
    }
    // FIX-04: must be 9 (live), not 0 (pick.total_points)
    expect(body.best_bench_player_pts).toBe(9)
    expect(body.best_bench_player_name).toBe('Watkins')
  })

  // Test 3 (FIX-03/04 SC-5 RED): /live/ returning 503 must degrade to 0, never 502
  it('degrades gracefully to 0 when event/live/ returns 503 — route still returns HTTP 200 (SC-5)', async () => {
    const starters = makeStarters()
    const benchPicks = [bench(101, 0), bench(102, 0), bench(103, 0), bench(104, 0)]
    const allPicks = [...starters, ...benchPicks]
    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Bench1' },
      { id: 102, web_name: 'Bench2' },
      { id: 103, web_name: 'Bench3' },
      { id: 104, web_name: 'Bench4' },
    ]
    // liveOk=false → mock returns 503 → liveMap stays empty → pts fall back to 0
    mockUpstream(allPicks, elements, null, false, null, false)
    const response = await GET(makeRequest())
    // SC-5: route must still return 200 (not 502), other fields populated normally
    expect(response.status).toBe(200)
    const body = await response.json() as {
      top_scorer_pts: number
      best_bench_player_pts: number
      your_score: number
    }
    expect(body.top_scorer_pts).toBe(0)
    expect(body.best_bench_player_pts).toBe(0)
    expect(body.your_score).toBe(72)
  })

  // Test 4 (FIX-CAP-DELTA / CR-01): captain_delta must reflect liveMap point difference
  // when yourCaptain != optimalCaptain in a settled GW (pick.total_points=0 for all).
  // The broken formula reads pick.total_points=0 for both operands → captainDelta=0.
  // The fixed formula reads liveMap: element2=20 pts (optimal), element1=14 pts (captain)
  // → captainDeltaRaw = 20*2 - 14*2 = 12 → captain_delta = 12.
  it('captain_delta reflects liveMap point difference when yourCaptain != optimalCaptain in a settled GW (CR-01)', async () => {
    // Settled GW: all pick.total_points=0, liveMap carries actual points
    const starters = makeStarters()
    // Set pick.total_points=0 for all starters (settled-GW model)
    for (let i = 0; i < starters.length; i++) {
      starters[i].total_points = 0
    }
    // element=1 remains captain (multiplier=2, is_captain=true) from makeStarters()
    // element=2 remains is_vice_captain=true with multiplier=1

    const benchPicks = [bench(101, 0), bench(102, 0), bench(103, 0), bench(104, 0)]
    const allPicks = [...starters, ...benchPicks]

    const elements = [
      ...starters.map(s => ({ id: s.element, web_name: `Player${s.element}` })),
      { id: 101, web_name: 'Bench1' },
      { id: 102, web_name: 'Bench2' },
      { id: 103, web_name: 'Bench3' },
      { id: 104, web_name: 'Bench4' },
    ]

    // liveData: element=2 is the top scorer (20 pts), element=1 (user's captain) has 14 pts
    // All other starters have 4 pts so element=2 is unambiguously the optimal captain
    const liveData = {
      elements: [
        { id: 1, stats: { total_points: 14 } },
        { id: 2, stats: { total_points: 20 } },
        ...Array.from({ length: 9 }, (_, i) => ({ id: i + 3, stats: { total_points: 4 } })),
        { id: 101, stats: { total_points: 0 } },
        { id: 102, stats: { total_points: 0 } },
        { id: 103, stats: { total_points: 0 } },
        { id: 104, stats: { total_points: 0 } },
      ],
    }

    // dreamTeamOk=false keeps dream-team branch out of scope; liveOk=true so /live/ returns liveData
    mockUpstream(allPicks, elements, null, false, liveData, true)

    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as {
      captain_delta: number
      captain_name: string
      optimal_captain_name: string
      top_scorer_pts: number
    }

    // User picked element=1 as captain
    expect(body.captain_name).toBe('Player1')
    // Element=2 was optimal per liveMap (20 > 14 > 4)
    expect(body.optimal_captain_name).toBe('Player2')
    // Sanity: liveMap-driven top scorer
    expect(body.top_scorer_pts).toBe(20)
    // Critical: Math.max(0, 20*2 - 14*2) = Math.max(0, 40 - 28) = 12
    // FAILS against current production code: broken formula yields 0*2 - 0*2 = 0
    expect(body.captain_delta).toBe(12)
  })
})
