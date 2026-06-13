// @vitest-environment node
// Phase 110 FIX-06 — /api/decision-history element-summary lookup for modelCeilingPts.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// Mock fs/promises so the blob-base read is a JSON literal in memory.
// decision-history/route.ts uses readFile for captain_picks_gw{N}.json
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('captain_picks_gw35')) {
      return JSON.stringify({
        gw: 35,
        ceiling: { id: 306, name: 'Salah', xPts_1gw: 8.5 },
      })
    }
    if (path.includes('captain_picks_gw36')) {
      return JSON.stringify({
        gw: 36,
        ceiling: { id: 306, name: 'Salah', xPts_1gw: 8.2 },
      })
    }
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    throw err
  }),
}))

interface MockPick {
  element: number
  position: number
  multiplier: number
  is_captain: boolean
  is_vice_captain: boolean
  total_points: number
}

interface MockUpstreamOpts {
  finishedGws?: number[]
  elementMap?: Array<{ id: number; web_name: string }>
  gwPicks?: Record<number, MockPick[]>
  elementSummary?: Record<number, Array<{ element: number; round: number; total_points: number }>>
  elementSummaryFailIds?: number[]
}

function mockUpstream(opts: MockUpstreamOpts) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/bootstrap-static/')) {
      return new Response(
        JSON.stringify({
          elements: opts.elementMap ?? [],
          events: (opts.finishedGws ?? [35]).map((id) => ({ id, finished: true })),
        }),
        { status: 200 },
      )
    }
    if (url.includes('/picks/')) {
      const gwMatch = url.match(/event\/(\d+)\/picks/)
      const gw = gwMatch ? Number(gwMatch[1]) : 35
      const picks = opts.gwPicks?.[gw] ?? []
      return new Response(
        JSON.stringify({
          entry_history: { points: 60, points_on_bench: 4, event: gw },
          picks,
        }),
        { status: 200 },
      )
    }
    if (url.includes('/element-summary/')) {
      const idMatch = url.match(/element-summary\/(\d+)/)
      const id = idMatch ? Number(idMatch[1]) : 0
      if (opts.elementSummaryFailIds?.includes(id)) {
        return new Response('', { status: 503 })
      }
      const history = opts.elementSummary?.[id] ?? []
      return new Response(JSON.stringify({ history }), { status: 200 })
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Phase 110 FIX-06: /api/decision-history modelCeilingPts from element-summary', () => {
  it('Test 1 (FIX-06 RED — happy path): entries[0].modelCeilingPts is 14 and regret is 16 when element-summary returns actual points', async () => {
    // Salah (id=306) scored 14pts raw in GW35
    // User captain element=1, multiplier=2, total_points=12 → userCaptainPts = 12/2 = 6
    // computeRegret(14, 6) = Math.round((14*2 - 6*2) * 10) / 10 = Math.round(160) / 10 = 16
    mockUpstream({
      finishedGws: [35],
      elementMap: [
        { id: 306, web_name: 'Salah' },
        { id: 1, web_name: 'Trent' },
      ],
      gwPicks: {
        35: [
          { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 12 },
          { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: true, total_points: 6 },
        ],
      },
      elementSummary: {
        306: [{ element: 306, round: 35, total_points: 14 }],
      },
    })

    const req = new NextRequest('http://localhost/api/decision-history?teamId=12345')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      entries: Array<{ regret: number | null; modelCeilingPts: number | null; hasSnapshot: boolean }>
    }
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].modelCeilingPts).toBe(14)
    expect(body.entries[0].regret).toBe(16)
  })

  it('Test 2 (FIX-06 RED — SC-5 element-summary failure): modelCeilingPts is null and regret is null when element-summary returns 503; route returns 200; element-summary was still attempted', async () => {
    // element-summary/306/ returns 503 → SC-5: modelCeilingPts stays null, regret stays null
    // Route must NOT 502 (return HTTP 200)
    // IMPORTANT: The fix must still ATTEMPT to call element-summary/306/ (exactly once),
    // even though it fails. This assertion is what makes this test fail against the current
    // hardcoded-null code (which never calls element-summary at all).
    const fetchMock = mockUpstream({
      finishedGws: [35],
      elementMap: [
        { id: 306, web_name: 'Salah' },
        { id: 1, web_name: 'Trent' },
      ],
      gwPicks: {
        35: [
          { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 12 },
        ],
      },
      elementSummaryFailIds: [306],
      elementSummary: {},
    })

    const req = new NextRequest('http://localhost/api/decision-history?teamId=12345')
    const res = await GET(req)
    // Must be 200, never 502 — SC-5 graceful degradation
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      entries: Array<{ regret: number | null; modelCeilingPts: number | null }>
    }
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].modelCeilingPts).toBeNull()
    expect(body.entries[0].regret).toBeNull()

    // SC-5 proof: element-summary/306/ was attempted (1 call), failed gracefully (503 → null)
    // This fails against the current hardcoded-null code (0 calls instead of 1)
    const elementSummaryCalls = fetchMock.mock.calls.filter((args) => {
      const url = String(args[0])
      return url.includes('/element-summary/306/')
    })
    expect(elementSummaryCalls).toHaveLength(1)
  })

  it('Test 3 (FIX-06 RED — dedup invariant): element-summary/306/ is called exactly once when ceiling.id=306 appears in both GW35 and GW36', async () => {
    // Salah (id=306) is ceiling in both GW35 and GW36 → deduplication must fire
    // element-summary/{306}/ must be called exactly ONCE (not twice)
    const fetchMock = mockUpstream({
      finishedGws: [35, 36],
      elementMap: [
        { id: 306, web_name: 'Salah' },
        { id: 1, web_name: 'Trent' },
      ],
      gwPicks: {
        35: [
          { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 12 },
        ],
        36: [
          { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 10 },
        ],
      },
      elementSummary: {
        306: [
          { element: 306, round: 35, total_points: 14 },
          { element: 306, round: 36, total_points: 18 },
        ],
      },
    })

    const req = new NextRequest('http://localhost/api/decision-history?teamId=12345')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      entries: Array<{ modelCeilingPts: number | null; regret: number | null }>
    }

    // Both entries should be populated from the single element-summary response
    expect(body.entries).toHaveLength(2)
    expect(body.entries[0].modelCeilingPts).toBe(14)
    expect(body.entries[1].modelCeilingPts).toBe(18)

    // Dedup assertion: count how many fetch calls were for /element-summary/306/
    const elementSummaryCalls = fetchMock.mock.calls.filter((args) => {
      const url = String(args[0])
      return url.includes('/element-summary/306/')
    })
    expect(elementSummaryCalls).toHaveLength(1)
  })

  it('Test 4 (FIX-06 RED — null snapshot skip): snapshot for gw=36 returns ENOENT; only one element-summary call fires (for gw=35); entries[1].hasSnapshot is false', async () => {
    // GW35 has a snapshot (ceiling.id=306), GW36 does NOT (ENOENT)
    // The unique ceiling ID set should only include 306 (from GW35)
    // element-summary/306/ must be called exactly once
    // entries[0].modelCeilingPts populated; entries[1].modelCeilingPts null; entries[1].hasSnapshot false

    // Override readFile: gw35 → snapshot, gw36 → ENOENT
    const fsMod = await import('fs/promises')
    ;(vi.mocked(fsMod.readFile) as unknown as { mockImplementation: (fn: (path: unknown) => Promise<Buffer>) => void }).mockImplementation(async (path: unknown) => {
      const p = String(path)
      if (p.includes('captain_picks_gw35')) {
        return JSON.stringify({ gw: 35, ceiling: { id: 306, name: 'Salah', xPts_1gw: 8.5 } }) as unknown as Buffer
      }
      // gw36 throws ENOENT — no snapshot
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      throw err
    })

    const fetchMock = mockUpstream({
      finishedGws: [35, 36],
      elementMap: [
        { id: 306, web_name: 'Salah' },
        { id: 1, web_name: 'Trent' },
      ],
      gwPicks: {
        35: [
          { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 12 },
        ],
        36: [
          { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 10 },
        ],
      },
      elementSummary: {
        306: [
          { element: 306, round: 35, total_points: 14 },
        ],
      },
    })

    const req = new NextRequest('http://localhost/api/decision-history?teamId=12345')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      entries: Array<{ modelCeilingPts: number | null; hasSnapshot: boolean; regret: number | null }>
    }

    expect(body.entries).toHaveLength(2)

    // GW35: snapshot exists → modelCeilingPts populated from element-summary
    expect(body.entries[0].hasSnapshot).toBe(true)
    expect(body.entries[0].modelCeilingPts).toBe(14)

    // GW36: no snapshot → modelCeilingPts null; hasSnapshot false
    expect(body.entries[1].hasSnapshot).toBe(false)
    expect(body.entries[1].modelCeilingPts).toBeNull()

    // Dedup: only one element-summary call (for id=306, triggered by gw=35 snapshot only)
    const elementSummaryCalls = fetchMock.mock.calls.filter((args) => {
      const url = String(args[0])
      return url.includes('/element-summary/')
    })
    expect(elementSummaryCalls).toHaveLength(1)
  })
})
