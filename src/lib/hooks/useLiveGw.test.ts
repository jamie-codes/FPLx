// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useLiveGw } from './useLiveGw'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function makeLivePayload(elements: Array<{ id: number; stats: Record<string, number> }>) {
  return { elements }
}

function makePicksPayload() {
  return {
    active_chip: null,
    picks: [
      { element: 1, position: 1, multiplier: 1, is_captain: true,  is_vice_captain: false },
      { element: 2, position: 2, multiplier: 1, is_captain: false, is_vice_captain: true  },
    ],
    automatic_subs: [],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useLiveGw', () => {
  it('is disabled when teamId is null', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(
      () => useLiveGw(null, 38, true),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled when currentGw is null', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(
      () => useLiveGw(12345, null, true),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches both endpoints and returns parsed data', async () => {
    const liveResponse  = makeLivePayload([{ id: 1, stats: { total_points: 12, goals_scored: 2, assists: 0, bonus: 3, clean_sheets: 0, saves: 0, minutes: 90, yellow_cards: 0, red_cards: 0 } }])
    const picksResponse = makePicksPayload()

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/live/'))   return new Response(JSON.stringify(liveResponse),  { status: 200 })
      if (url.includes('/picks/'))  return new Response(JSON.stringify(picksResponse), { status: 200 })
      return new Response('not found', { status: 404 })
    }))

    const { result } = renderHook(
      () => useLiveGw(12345, 38, false),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.liveStats).not.toBeNull()
    expect(result.current.picksData).not.toBeNull()
    // liveStats should be a Map keyed by player id
    expect(result.current.liveStats?.get(1)?.total_points).toBe(12)
  })

  it('isError true when live endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/live/')) return new Response('error', { status: 500 })
      return new Response(JSON.stringify(makePicksPayload()), { status: 200 })
    }))
    const { result } = renderHook(
      () => useLiveGw(12345, 38, false),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('returns null liveStats and picksData while loading', () => {
    // fetch never resolves
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { result } = renderHook(
      () => useLiveGw(12345, 38, false),
      { wrapper: makeWrapper() },
    )
    expect(result.current.liveStats).toBeNull()
    expect(result.current.picksData).toBeNull()
    expect(result.current.isLoading).toBe(true)
  })
})
