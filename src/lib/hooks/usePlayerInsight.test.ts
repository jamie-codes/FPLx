// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// The module under test does not exist yet — Wave 1 creates it.
import { usePlayerInsight, readCachedInsight } from './usePlayerInsight'
import type { PlayerInsightRequest, PlayerInsightResponse } from '../types'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children)
  }
  return { qc, Wrapper }
}

const validRequest: PlayerInsightRequest = {
  gw: 35,
  player: { id: 100, web_name: 'Salah', element_type: 3 },
  rejection_reasons: [],
  fragility: { tier: 'robust', reasons: [] },
}
const validResponse: PlayerInsightResponse = {
  prose: 'Salah looks strong this week.',
  player_id: 100,
  gw: 35,
  generated_at: '2026-05-13T12:00:00.000Z',
}

describe('readCachedInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    global.fetch = vi.fn()
  })

  it('returns null when localStorage is empty', () => {
    const result = readCachedInsight(100, 35)
    expect(result).toBeNull()
  })

  it('returns parsed payload from localStorage', () => {
    window.localStorage.setItem('playerInsight:100:gw35', JSON.stringify(validResponse))
    const result = readCachedInsight(100, 35)
    expect(result).toEqual(validResponse)
  })

  it('returns null on JSON parse error', () => {
    window.localStorage.setItem('playerInsight:100:gw35', '{ broken')
    const result = readCachedInsight(100, 35)
    expect(result).toBeNull()
  })
})

describe('usePlayerInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    global.fetch = vi.fn()
  })

  it('mutation posts to /api/player-insight with JSON body', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(validResponse),
    })
    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePlayerInsight(100, 35), { wrapper: Wrapper })

    act(() => {
      result.current.mutate(validRequest)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/player-insight',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(validRequest),
      }),
    )
    void qc
  })

  it('mutation throws GUARDRAIL_FAILED on 422 response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
    })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePlayerInsight(100, 35), { wrapper: Wrapper })

    act(() => {
      result.current.mutate(validRequest)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('GUARDRAIL_FAILED')
  })

  it('mutation throws generic error on 500 response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePlayerInsight(100, 35), { wrapper: Wrapper })

    act(() => {
      result.current.mutate(validRequest)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/Insight failed: 500/)
  })

  it('mutation writes localStorage on 200 success', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(validResponse),
    })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePlayerInsight(100, 35), { wrapper: Wrapper })

    act(() => {
      result.current.mutate(validRequest)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const stored = window.localStorage.getItem('playerInsight:100:gw35')
    expect(stored).toBe(JSON.stringify(validResponse))
  })

  it('mutationKey includes playerId and gw', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(validResponse),
    })
    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => usePlayerInsight(100, 35), { wrapper: Wrapper })

    act(() => {
      result.current.mutate(validRequest)
    })

    // Allow mutation to register in the cache
    await waitFor(() => {
      const mutations = qc.getMutationCache().findAll({ mutationKey: ['playerInsight', 100, 35] })
      expect(mutations.length).toBeGreaterThan(0)
    })
  })
})
