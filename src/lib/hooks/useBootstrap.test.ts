// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useBootstrap } from './useBootstrap'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

const validBootstrap = {
  elements: [
    {
      id: 1, code: 1, web_name: 'Salah', team: 10, element_type: 3,
      now_cost: 132, selected_by_percent: '40.0', form: '8.0', status: 'a',
      minutes: 90, starts: 1, defensive_contribution: null,
      defensive_contribution_per_90: null, clearances_blocks_interceptions: null,
      direct_freekicks_order: null, penalties_order: null,
      corners_and_indirect_freekicks_order: null, news: '',
    },
  ],
  teams: [{ id: 10, name: 'Liverpool', short_name: 'LIV', code: 14 }],
  events: [
    { id: 38, is_current: false, is_next: false, finished: true, data_checked: true, deadline_time: '2026-05-17T10:00:00Z' },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useBootstrap', () => {
  it('returns parsed bootstrap data on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(validBootstrap), { status: 200 })
    ))
    const { result } = renderHook(() => useBootstrap(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.elements).toHaveLength(1)
    expect(result.current.data?.elements[0].web_name).toBe('Salah')
    expect(result.current.data?.teams[0].short_name).toBe('LIV')
  })

  it('sets isError when fetch returns non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('bad gateway', { status: 502 })
    ))
    const { result } = renderHook(() => useBootstrap(), { wrapper: makeWrapper() })
    // retry: 1 in the hook means the error state is reached after 1 retry (default ~1s delay).
    // Use a longer timeout to allow the retry cycle to complete.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
  })

  it('sets isError when bootstrap parse fails (invalid shape)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ unexpected: true }), { status: 200 })
    ))
    const { result } = renderHook(() => useBootstrap(), { wrapper: makeWrapper() })
    // retry: 1 in the hook means the error state is reached after 1 retry (default ~1s delay).
    // Use a longer timeout to allow the retry cycle to complete.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
  })
})
