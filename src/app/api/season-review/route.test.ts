// @vitest-environment node
// Phase 124 Wave 1 RED — /api/season-review route contract.
// route.ts does not exist yet; this file fails at import. Task 3 turns it GREEN.
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md D-01..D-04
//   .planning/phases/124-season-review/124-RESEARCH.md Pitfalls 1, 3, 4, 6
//   .planning/phases/124-season-review/124-PATTERNS.md §src/app/api/season-review/route.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import type { SeasonReview } from '@/lib/types'

interface HistoryPayload {
  chips: Array<{ name: string; event: number; time: string }>
  current: Array<{ event: number; points: number; event_transfers_cost: number; overall_rank: number }>
}

interface BootstrapEvent {
  id: number
  average_entry_score: number
  finished: boolean
}

function makeRequest(teamId: string | null = '12345') {
  const url = teamId === null
    ? 'http://localhost/api/season-review'
    : `http://localhost/api/season-review?teamId=${teamId}`
  return new NextRequest(url)
}

function mockFetch(opts: {
  history?: HistoryPayload | null
  historyOk?: boolean
  bootstrapEvents?: BootstrapEvent[]
  bootstrapOk?: boolean
}) {
  const {
    history = { chips: [], current: [] },
    historyOk = true,
    bootstrapEvents = [],
    bootstrapOk = true,
  } = opts

  const fetchMock = vi.fn(async (url: string) => {
    if ((url as string).includes('/bootstrap-static/')) {
      if (!bootstrapOk) return new Response('', { status: 503 })
      return new Response(JSON.stringify({ events: bootstrapEvents }), { status: 200 })
    }
    if ((url as string).includes('/history/')) {
      if (!historyOk) return new Response('', { status: 503 })
      if (history === null) return new Response('', { status: 404 })
      return new Response(JSON.stringify(history), { status: 200 })
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

describe('Phase 124 REV-01: /api/season-review input validation', () => {
  it('returns 400 with error body when teamId is missing', async () => {
    mockFetch({})
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid teamId parameter')
  })

  it('returns 400 when teamId is non-numeric (SSRF guard)', async () => {
    mockFetch({})
    const res = await GET(makeRequest('abc'))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid teamId parameter')
  })
})

describe('Phase 124 REV-01: /api/season-review upstream failure handling', () => {
  it('returns 502 when FPL history fetch returns null (non-ok response)', async () => {
    mockFetch({ historyOk: false })
    const res = await GET(makeRequest('99999'))
    expect(res.status).toBe(502)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/history/i)
  })
})

describe('Phase 124 REV-01: /api/season-review aggregation', () => {
  it('returns 200 with correct SeasonReview shape for valid teamId with chips', async () => {
    mockFetch({
      history: {
        chips: [
          { name: 'bboost', event: 2, time: '' },
        ],
        current: [
          { event: 1, points: 50, event_transfers_cost: 0, overall_rank: 1000 },
          { event: 2, points: 70, event_transfers_cost: 4, overall_rank: 900 },
          { event: 3, points: 40, event_transfers_cost: 0, overall_rank: 1100 },
        ],
      },
      bootstrapEvents: [
        { id: 1, average_entry_score: 45, finished: true },
        { id: 2, average_entry_score: 55, finished: true },
        { id: 3, average_entry_score: 38, finished: true },
      ],
    })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonReview

    // totalPoints: 50 + 70 + 40 = 160
    expect(body.totalPoints).toBe(160)
    // finalRank: last entry's overall_rank = 1100
    expect(body.finalRank).toBe(1100)
    // bestGw: event 2 had 70 points
    expect(body.bestGw).toEqual({ gw: 2, points: 70 })
    // worstGw: event 3 had 40 points
    expect(body.worstGw).toEqual({ gw: 3, points: 40 })
    // transferNetPoints: -(0 + 4 + 0) = -4
    expect(body.transferNetPoints).toBe(-4)
    // gwData has 3 entries ordered by gw
    expect(body.gwData).toHaveLength(3)

    // GW1: no chip
    expect(body.gwData[0].gw).toBe(1)
    expect(body.gwData[0].points).toBe(50)
    expect(body.gwData[0].avgManagerScore).toBe(45)
    expect(body.gwData[0].overallRank).toBe(1000)
    expect(body.gwData[0].chipPlayed).toBeNull()

    // GW2: chip = 'bboost'
    expect(body.gwData[1].gw).toBe(2)
    expect(body.gwData[1].chipPlayed).toBe('bboost')
    expect(body.gwData[1].avgManagerScore).toBe(55)

    // GW3: no chip
    expect(body.gwData[2].chipPlayed).toBeNull()
    expect(body.gwData[2].avgManagerScore).toBe(38)
  })

  it('includes Cache-Control header', async () => {
    mockFetch({
      history: { chips: [], current: [{ event: 1, points: 60, event_transfers_cost: 0, overall_rank: 500 }] },
      bootstrapEvents: [{ id: 1, average_entry_score: 50, finished: true }],
    })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=1800, stale-while-revalidate=86400')
  })

  it('Pitfall 6: empty current[] returns zero/empty payload without crashing', async () => {
    mockFetch({ history: { chips: [], current: [] } })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonReview
    expect(body.totalPoints).toBe(0)
    expect(body.finalRank).toBe(0)
    expect(body.bestGw).toEqual({ gw: 0, points: 0 })
    expect(body.worstGw).toEqual({ gw: 0, points: 0 })
    expect(body.transferNetPoints).toBe(0)
    expect(body.gwData).toEqual([])
  })

  it('Pitfall 6: avgManagerScore sourced from average_entry_score (NOT average_score)', async () => {
    // Use distinctive values to verify exact field mapping
    mockFetch({
      history: {
        chips: [],
        current: [
          { event: 5, points: 66, event_transfers_cost: 0, overall_rank: 777 },
          { event: 6, points: 44, event_transfers_cost: 0, overall_rank: 888 },
        ],
      },
      bootstrapEvents: [
        { id: 5, average_entry_score: 123, finished: true },
        { id: 6, average_entry_score: 456, finished: true },
      ],
    })
    const res = await GET(makeRequest('12345'))
    const body = await res.json() as SeasonReview
    expect(body.gwData[0].avgManagerScore).toBe(123)
    expect(body.gwData[1].avgManagerScore).toBe(456)
  })

  it('falls back to avgManagerScore=0 when bootstrap events array is empty', async () => {
    mockFetch({
      history: {
        chips: [],
        current: [{ event: 1, points: 60, event_transfers_cost: 0, overall_rank: 500 }],
      },
      bootstrapEvents: [],
    })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonReview
    expect(body.gwData[0].avgManagerScore).toBe(0)
  })
})
