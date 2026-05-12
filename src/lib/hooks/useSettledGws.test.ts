// @vitest-environment jsdom
// Phase 98 PGW-04 — useSettledGws hook contract.
// Sources of truth:
//   .planning/phases/98-post-gw-review-core/98-CONTEXT.md §D-06, D-07
//   .planning/phases/98-post-gw-review-core/98-RESEARCH.md Pattern 1, Validation Architecture
//   .planning/phases/98-post-gw-review-core/98-PATTERNS.md src/lib/hooks/useSettledGws.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useSettledGws } from './useSettledGws'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

interface EventInput { id: number; finished: boolean; data_checked: boolean }
function bootstrapPayload(events: EventInput[]) {
  return {
    elements: [],
    teams: [],
    events: events.map((e) => ({
      ...e,
      is_current: false,
      is_next: false,
      deadline_time: '2026-01-01T11:00:00Z',
    })),
  }
}

beforeEach(() => {})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useSettledGws — Phase 98 PGW-04', () => {
  it('returns empty array when no settled GWs exist (all flags false)', async () => {
    const payload = bootstrapPayload([
      { id: 35, finished: false, data_checked: false },
      { id: 36, finished: true, data_checked: false },  // unfinished after-finalisation: still excluded
      { id: 37, finished: false, data_checked: true },  // impossible combo, defensively excluded
    ])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSettledGws(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('filters by finished === true AND data_checked === true (D-06)', async () => {
    const payload = bootstrapPayload([
      { id: 30, finished: true,  data_checked: true  },
      { id: 31, finished: true,  data_checked: false }, // excluded
      { id: 32, finished: false, data_checked: true  }, // excluded
      { id: 33, finished: true,  data_checked: true  },
    ])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSettledGws(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([30, 33])
  })

  it('returns the LAST 3 settled GWs in ascending order when more than 3 are settled (D-07)', async () => {
    const payload = bootstrapPayload([
      { id: 30, finished: true, data_checked: true },
      { id: 31, finished: true, data_checked: true },
      { id: 32, finished: true, data_checked: true },
      { id: 33, finished: true, data_checked: true },
      { id: 34, finished: true, data_checked: true },
    ])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSettledGws(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([32, 33, 34])
  })

  it('throws (isError === true) when bootstrap returns non-OK status', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)
    // retry: 1 in the hook means the error state is reached after 1 retry (default ~1s delay).
    // Use a longer timeout to allow the retry cycle to complete.
    const { result } = renderHook(() => useSettledGws(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.data).toBeUndefined()
  })
})
