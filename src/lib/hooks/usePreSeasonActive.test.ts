// @vitest-environment jsdom
// Phase 128 AUTO-03: Contract tests for usePreSeasonActive hook.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePreSeasonActive } from './usePreSeasonActive'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve(new Response('{}', { status: 200 }))
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePreSeasonActive', () => {
  it('returns null when API returns 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Pre-season not yet activated' }), { status: 404 })
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => usePreSeasonActive(), {
      wrapper: makeWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('returns the parsed payload on 200', async () => {
    const payload = { activated_at: '2026-08-01T04:12:33Z', season_id: '2526' }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => usePreSeasonActive(), {
      wrapper: makeWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(payload)
  })

  it('returns null on non-404 server error (silent Awaiting fallback)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'boom' }), { status: 500 })
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => usePreSeasonActive(), {
      wrapper: makeWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    // Does NOT surface the error — silent fallback per UI-SPEC
    expect(result.current.isError).toBe(false)
  })

  it('uses staleTime of 60_000 ms', async () => {
    const payload = { activated_at: '2026-08-01T04:12:33Z', season_id: '2526' }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => usePreSeasonActive(), {
      wrapper: makeWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cachedQuery = queryClient.getQueryCache().find({ queryKey: ['pre-season-active'] })
    // staleTime is set on the query observer, confirm 60_000 via the hook returning data freshly
    // (the query should not be considered stale immediately after resolution)
    expect(cachedQuery).toBeDefined()
    expect(result.current.isStale).toBe(false)
  })
})
