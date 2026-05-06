// @vitest-environment jsdom
// Phase 62 MC-03 — useEntryRank hook unit tests.
// Mirrors useRivals.test.ts scaffold (makeWrapper, installFetchMock, beforeEach/afterEach).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useEntryRank } from './useEntryRank'

function makeWrapper(retries = 0) {
  // retries defaults to 0 to avoid long retry backoff delays in tests.
  // gcTime: 0 prevents caching between test cases.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function installFetchMock(routes: Record<string, () => unknown>, status = 200) {
  const fetchMock = vi.fn(async (url: string) => {
    for (const key of Object.keys(routes)) {
      if (url.includes(key)) {
        return new Response(JSON.stringify(routes[key]()), { status })
      }
    }
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useEntryRank', () => {
  it('is disabled when teamId is null', async () => {
    const fetchMock = installFetchMock({})
    const { result } = renderHook(() => useEntryRank(null), { wrapper: makeWrapper() })
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when teamId is empty string', async () => {
    const fetchMock = installFetchMock({})
    const { result } = renderHook(() => useEntryRank(''), { wrapper: makeWrapper() })
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when teamId is non-numeric ("abc")', async () => {
    const fetchMock = installFetchMock({})
    const { result } = renderHook(() => useEntryRank('abc'), { wrapper: makeWrapper() })
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when teamId is mixed ("123abc")', async () => {
    const fetchMock = installFetchMock({})
    const { result } = renderHook(() => useEntryRank('123abc'), { wrapper: makeWrapper() })
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches /api/fpl/entry/{teamId}/ and returns summary_overall_rank + summary_overall_points', async () => {
    const fetchMock = installFetchMock({
      '/entry/1234567/': () => ({
        summary_overall_rank: 654321,
        summary_overall_points: 1842,
      }),
    })
    const { result } = renderHook(() => useEntryRank('1234567'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/fpl/entry/1234567/'))
    expect(result.current.data).toEqual({
      summary_overall_rank: 654321,
      summary_overall_points: 1842,
    })
  })

  it('returns null fields when response omits them (null guard)', async () => {
    installFetchMock({
      '/entry/9999999/': () => ({
        // Neither summary_overall_rank nor summary_overall_points present
        name: 'Some Team',
      }),
    })
    const { result } = renderHook(() => useEntryRank('9999999'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      summary_overall_rank: null,
      summary_overall_points: null,
    })
  })

  it('throws on non-ok response (500)', async () => {
    installFetchMock({
      '/entry/1111111/': () => ({ error: 'server error' }),
    }, 500)
    // Use makeWrapper(0) to disable retries so the error resolves immediately.
    const { result } = renderHook(() => useEntryRank('1111111'), { wrapper: makeWrapper(0) })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect((result.current.error as Error).message).toContain('Entry fetch failed: 500')
  })
})
