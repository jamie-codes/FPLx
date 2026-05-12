// @vitest-environment jsdom
// Phase 100 HIST-02/03 Wave 2 RED — useSeasonAnalytics hook contract.
// useSeasonAnalytics.ts does not exist yet; this file fails at import. Task 2 turns it GREEN.
// Sources of truth:
//   .planning/phases/100-decision-history-analytics/100-CONTEXT.md §D-11, D-12
//   .planning/phases/100-decision-history-analytics/100-RESEARCH.md Pattern 1 (TanStack v5), Pitfall 7
//   .planning/phases/100-decision-history-analytics/100-PATTERNS.md §src/lib/hooks/useSeasonAnalytics.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useSeasonAnalytics } from './useSeasonAnalytics'
import type { SeasonAnalytics } from '../types'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function samplePayload(): SeasonAnalytics {
  return {
    chipRoi: [
      { chipName: 'bboost', event: 29, gwPoints: 74, seasonAvgPoints: 52, delta: 22 },
      { chipName: '3xc', event: 22, gwPoints: 48, seasonAvgPoints: 52, delta: -4 },
    ],
    hitTracking: [
      {
        event: 31, elementIn: 100, elementOut: 200,
        elementInName: 'Salah', elementOutName: 'Haaland',
        elementInPts: 18, elementOutPts: 10, netPts: 4, brokeEven: false,
      },
    ],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useSeasonAnalytics — Phase 100 HIST-02/03', () => {
  it('is disabled when teamId is null (queryFn never called) (D-12 graceful degradation)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSeasonAnalytics(null), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when teamId is non-numeric (defence in depth against T-100-03)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSeasonAnalytics('abc'), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches /api/season-analytics?teamId={id} for valid numeric teamId (D-11)', async () => {
    const payload = samplePayload()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSeasonAnalytics('12345'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/season-analytics?teamId=12345'),
    )
    expect(result.current.data?.chipRoi).toHaveLength(2)
    expect(result.current.data?.hitTracking).toHaveLength(1)
  })

  it('surfaces an error when /api/season-analytics returns 500', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSeasonAnalytics('12345'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toMatch(/500/)
  })
})
