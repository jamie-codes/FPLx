// @vitest-environment jsdom
// Phase 96 BACK-01 Wave 1 RED — useDecisionHistory hook contract.
// useDecisionHistory.ts does not exist yet; this file fails at import. Plan 03 turns it GREEN.
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-06, SC-4, SC-5
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/lib/hooks/useDecisionHistory.ts
//   ROADMAP cross-cutting constraints (localStorage key `decisionHistory:teamId:{id}`, 38-GW ring buffer)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useDecisionHistory } from './useDecisionHistory'
import type { DecisionHistory, RegretEntry } from '../types'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function entry(gw: number): RegretEntry {
  return {
    gw,
    userCaptainId: 1, userCaptainName: 'U', userCaptainPts: 5,
    modelCeilingId: 2, modelCeilingName: 'M', modelCeilingPts: 8,
    hasSnapshot: true,
    regret: 6,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('useDecisionHistory — Phase 96 BACK-01', () => {
  it('is disabled when teamId is null (queryFn never called)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDecisionHistory(null), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when teamId is non-numeric (defence in depth)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDecisionHistory('abc'), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches /api/decision-history?teamId={id} for valid numeric teamId', async () => {
    const payload: DecisionHistory = { teamId: 12345, gwsWithData: 1, entries: [entry(30)] }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDecisionHistory('12345'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/decision-history?teamId=12345')
    )
    expect(result.current.data?.entries).toHaveLength(1)
  })

  it('hydrates from localStorage cache on initial render (cache-first, SC-4)', async () => {
    const cached: DecisionHistory = { teamId: 12345, gwsWithData: 1, entries: [entry(20)] }
    window.localStorage.setItem('decisionHistory:teamId:12345', JSON.stringify(cached))
    // Network fetch is deliberately slow so initial render comes from cache.
    const fetchMock = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDecisionHistory('12345'), { wrapper: makeWrapper() })
    // The hook should expose the cached entries synchronously via initialData or placeholderData.
    expect(result.current.data?.entries[0]?.gw).toBe(20)
  })

  it('persists fetched data to localStorage trimmed to MAX_GWS=38 (ring buffer, ROADMAP)', async () => {
    // 40 entries — hook should keep only the last 38 after write.
    const fortyEntries = Array.from({ length: 40 }, (_, i) => entry(i + 1))
    const payload: DecisionHistory = { teamId: 12345, gwsWithData: 40, entries: fortyEntries }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useDecisionHistory('12345'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const stored = window.localStorage.getItem('decisionHistory:teamId:12345')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!) as DecisionHistory
    expect(parsed.entries.length).toBe(38)
    // Ring buffer = LAST 38 entries — GWs 3 through 40.
    expect(parsed.entries[0]?.gw).toBe(3)
    expect(parsed.entries[37]?.gw).toBe(40)
  })
})
