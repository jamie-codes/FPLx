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

function mockUpstream(picks: Pick[], elements: Array<{ id: number; web_name: string }>) {
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
