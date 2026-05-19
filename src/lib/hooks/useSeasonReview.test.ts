// @vitest-environment jsdom
// Phase 124 REV-03 Wave 2 RED — useSeasonReview hook contract.
// useSeasonReview.ts does not exist yet; this file fails at import. Task 1 GREEN turns it passing.
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md §D-03/D-04
//   .planning/phases/124-season-review/124-RESEARCH.md Pattern 3 (TanStack v5), Anti-Patterns
//   .planning/phases/124-season-review/124-PATTERNS.md §src/lib/hooks/useSeasonReview.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useSeasonReview } from './useSeasonReview'
import type { SeasonReview } from '../types'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

const stubbedSeasonReview: SeasonReview = {
  totalPoints: 1234,
  finalRank: 500000,
  bestGw: { gw: 7, points: 94 },
  worstGw: { gw: 4, points: 38 },
  transferNetPoints: -8,
  gwData: [
    {
      gw: 1,
      points: 60,
      avgManagerScore: 55,
      overallRank: 500000,
      chipPlayed: null,
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useSeasonReview', () => {
  it('is disabled when teamId is null — fetch never called (T-124-05 guard)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSeasonReview(null), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when teamId is non-numeric — fetch never called (defence-in-depth T-124-05)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useSeasonReview('abc'), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches /api/season-review?teamId={id} for valid numeric teamId and resolves data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => stubbedSeasonReview,
      }),
    )
    const { result } = renderHook(() => useSeasonReview('99999'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const fetchMock = (globalThis.fetch as ReturnType<typeof vi.fn>)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/season-review?teamId=99999'),
    )
    expect(result.current.data?.totalPoints).toBe(1234)
    expect(result.current.data?.finalRank).toBe(500000)
    expect(result.current.data?.gwData).toHaveLength(1)
  })

  it('surfaces isError=true and error.status=500 when fetch returns non-ok (T-124-06 error shape)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      }),
    )
    // retry: 0 on wrapper to keep test fast; hook's retry: 1 exercised in production
    const { result } = renderHook(() => useSeasonReview('99999'), { wrapper: makeWrapper(0) })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error & { status?: number }).status).toBe(500)
    expect((result.current.error as Error).message).toMatch(/500/)
  })

  it('uses queryKey ["season-review", teamId] — verifiable via cache lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => stubbedSeasonReview,
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(() => useSeasonReview('99999'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cached = qc.getQueryCache().findAll({ queryKey: ['season-review', '99999'] })
    expect(cached).toHaveLength(1)
  })

  it('does NOT use v4-removed options — source-level guard (TanStack v5 compliance)', () => {
    // Source assertion: the hook file must not contain onSuccess, onError, onSettled, placeholderData
    // This is enforced by the acceptance_criteria grep gate in the plan.
    // Here we verify the hook module can be imported and the function signature is correct.
    expect(typeof useSeasonReview).toBe('function')
    // Call with null — just confirms no crash at import / call time
    const { result } = renderHook(() => useSeasonReview(null), { wrapper: makeWrapper() })
    expect(result.current.isFetching).toBe(false)
  })
})
