// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useTransferNews } from './useTransferNews'
import type { TransferNewsFeed } from '../types'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

const MOCK_FEED: TransferNewsFeed = {
  scraped_at: '2026-05-18T12:00:00Z',
  articles: [],
  source_health: {
    skysports: { ok: true, last_success: '2026-05-18T12:00:00Z', last_error: null },
    bbc: { ok: true, last_success: '2026-05-18T12:00:00Z', last_error: null },
  },
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useTransferNews', () => {
  it('successful fetch returns the TransferNewsFeed payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(MOCK_FEED), { status: 200 }))
    )

    const { result } = renderHook(() => useTransferNews(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.scraped_at).toBe('2026-05-18T12:00:00Z')
    expect(Array.isArray(result.current.data?.articles)).toBe(true)
    expect(result.current.data?.source_health.skysports.ok).toBe(true)
    expect(result.current.data?.source_health.bbc.ok).toBe(true)
  })

  it('non-ok response causes error state with the locked message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Internal Server Error', { status: 500 }))
    )

    const { result } = renderHook(() => useTransferNews(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect((result.current.error as Error).message).toBe('Failed to fetch transfer news')
  })

  it('404 response sets isNotAvailable=true with locked message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not Found', { status: 404 }))
    )

    const { result } = renderHook(() => useTransferNews(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.isNotAvailable).toBe(true)
    expect((result.current.error as Error).message).toBe('Transfer news not available')
  })

  it('hook fetches from /api/transfer-news exactly once on initial render', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(MOCK_FEED), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useTransferNews(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchMock).toHaveBeenCalledWith('/api/transfer-news')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
