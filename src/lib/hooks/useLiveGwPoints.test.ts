// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useLiveGwPoints } from './useLiveGwPoints'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function livePayload(elements: Array<{ id: number; total_points: number }>) {
  return {
    elements: elements.map(({ id, total_points }) => ({
      id,
      stats: { total_points },
    })),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useLiveGwPoints', () => {
  it('returns a playerId→points map on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(livePayload([
        { id: 10, total_points: 12 },
        { id: 20, total_points: 6 },
      ])), { status: 200 })
    ))
    const { result } = renderHook(() => useLiveGwPoints(38), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ 10: 12, 20: 6 })
  })

  it('is disabled (no fetch) when gw is null', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useLiveGwPoints(null), { wrapper: makeWrapper() })
    // isPending is true when query is disabled
    expect(result.current.isPending).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the correct URL for the given GW', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(livePayload([])), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useLiveGwPoints(25), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/fpl/event/25/live/')
  })

  it('sets isError when fetch returns non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('not found', { status: 404 })
    ))
    const { result } = renderHook(() => useLiveGwPoints(38), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
