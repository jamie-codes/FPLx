// @vitest-environment node
// Phase 100 HIST-02/03 Wave 2 RED — /api/season-analytics contract.
// route.ts does not exist yet; this file fails at import. Task 2 of this plan turns it GREEN.
// Sources of truth:
//   .planning/phases/100-decision-history-analytics/100-CONTEXT.md §D-04, D-05, D-07, D-08, D-10
//   .planning/phases/100-decision-history-analytics/100-RESEARCH.md Pitfalls 3, 4, 6
//   .planning/phases/100-decision-history-analytics/100-PATTERNS.md §src/app/api/season-analytics/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import type { SeasonAnalytics } from '@/lib/types'

interface HistoryPayload {
  chips: Array<{ name: string; event: number; time: string }>
  current: Array<{ event: number; points: number; event_transfers_cost: number }>
}
interface TransferEntry { element_in: number; element_out: number; event: number; time: string }
interface ElementSummaryPayload {
  history: Array<{ round: number; total_points: number }>
}
interface BootstrapElement { id: number; web_name: string }

function makeRequest(teamId: string | null = '12345') {
  const url = teamId === null
    ? 'http://localhost/api/season-analytics'
    : `http://localhost/api/season-analytics?teamId=${teamId}`
  return new NextRequest(url)
}

function mockUpstream(opts: {
  history?: HistoryPayload | null
  transfers?: TransferEntry[] | null
  elementSummaries?: Record<number, ElementSummaryPayload | null>
  bootstrapElements?: BootstrapElement[]
  historyOk?: boolean
}) {
  const {
    history = { chips: [], current: [] },
    transfers = [],
    elementSummaries = {},
    bootstrapElements = [],
    historyOk = true,
  } = opts
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/bootstrap-static/')) {
      return new Response(JSON.stringify({ elements: bootstrapElements }), { status: 200 })
    }
    if (url.includes('/history/')) {
      if (!historyOk) return new Response('', { status: 503 })
      return new Response(JSON.stringify(history), { status: 200 })
    }
    if (url.includes('/transfers/')) {
      return new Response(JSON.stringify(transfers ?? []), { status: 200 })
    }
    if (url.includes('/element-summary/')) {
      const m = url.match(/\/element-summary\/(\d+)\//)
      if (!m) throw new Error(`Unparseable element-summary URL: ${url}`)
      const id = Number(m[1])
      const payload = elementSummaries[id]
      if (payload === null) return new Response('', { status: 503 })
      if (payload === undefined) {
        return new Response(JSON.stringify({ history: [] }), { status: 200 })
      }
      return new Response(JSON.stringify(payload), { status: 200 })
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Phase 100 HIST-02/03: /api/season-analytics input validation', () => {
  it('returns 400 when teamId query parameter is missing', async () => {
    mockUpstream({})
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/teamId/i)
  })

  it('returns 400 when teamId is non-numeric (T-100-03: prevents path injection)', async () => {
    mockUpstream({})
    const res1 = await GET(makeRequest('abc'))
    const res2 = await GET(makeRequest('12;rm'))
    const res3 = await GET(makeRequest('-1'))
    expect(res1.status).toBe(400)
    expect(res2.status).toBe(400)
    expect(res3.status).toBe(400)
  })
})

describe('Phase 100 HIST-02: chip ROI assembly', () => {
  it('returns chipRoi entries only for bboost / 3xc / freehit; wildcard is excluded (D-04)', async () => {
    mockUpstream({
      history: {
        chips: [
          { name: 'wildcard', event: 8, time: '' },
          { name: 'bboost', event: 29, time: '' },
          { name: '3xc', event: 22, time: '' },
          { name: 'freehit', event: 18, time: '' },
        ],
        current: [
          { event: 18, points: 50, event_transfers_cost: 0 },
          { event: 22, points: 48, event_transfers_cost: 0 },
          { event: 29, points: 74, event_transfers_cost: 0 },
        ],
      },
    })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonAnalytics
    expect(body.chipRoi.map(c => c.chipName).sort()).toEqual(['3xc', 'bboost', 'freehit'])
    expect(body.chipRoi.find(c => (c.chipName as string) === 'wildcard')).toBeUndefined()
  })

  it('computes seasonAvgPoints as sum(current[].points)/current.length and delta = gwPoints − seasonAvgPoints (D-05)', async () => {
    // current points = 50, 48, 74 → sum = 172 → avg = 172/3 ≈ 57.333…
    // BB event=29 gwPoints=74 → delta = 74 − 57.333… = 16.666…
    mockUpstream({
      history: {
        chips: [{ name: 'bboost', event: 29, time: '' }],
        current: [
          { event: 18, points: 50, event_transfers_cost: 0 },
          { event: 22, points: 48, event_transfers_cost: 0 },
          { event: 29, points: 74, event_transfers_cost: 0 },
        ],
      },
    })
    const res = await GET(makeRequest('12345'))
    const body = await res.json() as SeasonAnalytics
    const bb = body.chipRoi.find(c => c.chipName === 'bboost')
    expect(bb).toBeDefined()
    expect(bb!.event).toBe(29)
    expect(bb!.gwPoints).toBe(74)
    expect(bb!.seasonAvgPoints).toBeCloseTo(172 / 3, 5)
    expect(bb!.delta).toBeCloseTo(74 - 172 / 3, 5)
  })

  it('returns { chipRoi: [], hitTracking: [] } when current is empty (Pitfall 6: no NaN, no /0)', async () => {
    mockUpstream({ history: { chips: [{ name: 'bboost', event: 1, time: '' }], current: [] } })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonAnalytics
    expect(body.chipRoi).toEqual([])
    expect(body.hitTracking).toEqual([])
  })
})

describe('Phase 100 HIST-03: hit identification + break-even', () => {
  it('emits one hitTracking row per transfer in a multi-transfer hit GW (Pitfall 3)', async () => {
    // GW5 has event_transfers_cost = 4 → hit GW. Two transfers happened in GW5.
    mockUpstream({
      history: {
        chips: [],
        current: [
          { event: 4, points: 60, event_transfers_cost: 0 },
          { event: 5, points: 50, event_transfers_cost: 4 },  // hit GW
          { event: 6, points: 55, event_transfers_cost: 0 },
        ],
      },
      transfers: [
        { element_in: 100, element_out: 200, event: 5, time: '' },
        { element_in: 101, element_out: 201, event: 5, time: '' },
        { element_in: 102, element_out: 202, event: 6, time: '' }, // NOT a hit (no cost on GW6)
      ],
      elementSummaries: {
        100: { history: [{ round: 5, total_points: 5 }, { round: 6, total_points: 5 }] },
        101: { history: [{ round: 5, total_points: 5 }, { round: 6, total_points: 5 }] },
        200: { history: [{ round: 5, total_points: 5 }, { round: 6, total_points: 5 }] },
        201: { history: [{ round: 5, total_points: 5 }, { round: 6, total_points: 5 }] },
      },
      bootstrapElements: [
        { id: 100, web_name: 'In100' }, { id: 101, web_name: 'In101' },
        { id: 200, web_name: 'Out200' }, { id: 201, web_name: 'Out201' },
        { id: 102, web_name: 'In102' }, { id: 202, web_name: 'Out202' },
      ],
    })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonAnalytics
    const gw5Hits = body.hitTracking.filter(h => h.event === 5)
    expect(gw5Hits).toHaveLength(2)
    expect(gw5Hits.map(h => h.elementIn).sort()).toEqual([100, 101])
    // GW6 transfer was NOT a hit → not in hitTracking
    expect(body.hitTracking.find(h => h.event === 6)).toBeUndefined()
  })

  it('break-even uses round >= event (transfer GW inclusive, Pitfall 4)', async () => {
    // Transfer at event=10. element_in history has round=10:8pts, round=11:5pts → 13pts total.
    // element_out history has round=10:3pts, round=11:4pts → 7pts total.
    // netPts = 13 − 7 − 4 = 2 → brokeEven=true.
    mockUpstream({
      history: {
        chips: [],
        current: [
          { event: 10, points: 60, event_transfers_cost: 4 },
          { event: 11, points: 55, event_transfers_cost: 0 },
        ],
      },
      transfers: [{ element_in: 300, element_out: 400, event: 10, time: '' }],
      elementSummaries: {
        // Include rounds < 10 to verify they are EXCLUDED:
        300: { history: [{ round: 9, total_points: 99 }, { round: 10, total_points: 8 }, { round: 11, total_points: 5 }] },
        400: { history: [{ round: 9, total_points: 99 }, { round: 10, total_points: 3 }, { round: 11, total_points: 4 }] },
      },
      bootstrapElements: [
        { id: 300, web_name: 'In300' }, { id: 400, web_name: 'Out400' },
      ],
    })
    const res = await GET(makeRequest('12345'))
    const body = await res.json() as SeasonAnalytics
    expect(body.hitTracking).toHaveLength(1)
    const hit = body.hitTracking[0]
    expect(hit.event).toBe(10)
    expect(hit.elementInPts).toBe(13)   // 8 + 5; round 9 EXCLUDED
    expect(hit.elementOutPts).toBe(7)   // 3 + 4; round 9 EXCLUDED
    expect(hit.netPts).toBe(2)          // 13 − 7 − 4
    expect(hit.brokeEven).toBe(true)
    expect(hit.elementInName).toBe('In300')
    expect(hit.elementOutName).toBe('Out400')
  })

  it('folds per-player /element-summary/ failures to null pts (partial-failure pattern)', async () => {
    mockUpstream({
      history: {
        chips: [],
        current: [{ event: 7, points: 50, event_transfers_cost: 4 }],
      },
      transfers: [{ element_in: 500, element_out: 600, event: 7, time: '' }],
      elementSummaries: {
        500: null,  // explicit null = mock 503 for this element-summary
        600: { history: [{ round: 7, total_points: 6 }] },
      },
      bootstrapElements: [{ id: 500, web_name: 'In500' }, { id: 600, web_name: 'Out600' }],
    })
    const res = await GET(makeRequest('12345'))
    expect(res.status).toBe(200)
    const body = await res.json() as SeasonAnalytics
    expect(body.hitTracking).toHaveLength(1)
    const hit = body.hitTracking[0]
    expect(hit.elementInPts).toBeNull()
    expect(hit.elementOutPts).toBe(6)
    expect(hit.netPts).toBeNull()
    expect(hit.brokeEven).toBeNull()
  })
})
