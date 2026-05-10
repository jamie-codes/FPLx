// @vitest-environment jsdom
// Phase 88 SCRAPER-01: useNewsFlagEnabled — gate accessor hook tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useNewsFlagEnabled } from './useAccuracy'

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

describe('useNewsFlagEnabled — Phase 88 SCRAPER-01', () => {
  it('returns true when summary.news_flag_enabled is true', async () => {
    installFetchMock({
      '/api/accuracy': () => ({
        generated_at: '2026-05-09T00:00:00Z',
        gws_covered: [30, 31, 32, 33, 34],
        summary: { news_flag_enabled: true },
        haulters: [],
        players: [],
      }),
    })
    const { result } = renderHook(() => useNewsFlagEnabled(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('returns false when summary.news_flag_enabled is false', async () => {
    installFetchMock({
      '/api/accuracy': () => ({
        generated_at: '2026-05-09T00:00:00Z',
        gws_covered: [],
        summary: { news_flag_enabled: false },
        haulters: [],
        players: [],
      }),
    })
    const { result } = renderHook(() => useNewsFlagEnabled(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('returns false when summary.news_flag_enabled is missing (default-false safety)', async () => {
    installFetchMock({
      '/api/accuracy': () => ({
        generated_at: '2026-05-09T00:00:00Z',
        gws_covered: [],
        summary: {},
        haulters: [],
        players: [],
      }),
    })
    const { result } = renderHook(() => useNewsFlagEnabled(), { wrapper: makeWrapper() })
    // Initial render before fetch resolves: data undefined → ?? false → false
    expect(result.current).toBe(false)
    // After fetch resolves: still false (field absent on summary)
    await waitFor(() => expect(result.current).toBe(false))
  })
})
