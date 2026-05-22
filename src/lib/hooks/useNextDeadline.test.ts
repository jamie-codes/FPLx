// @vitest-environment jsdom
// Phase 132 DL-01 — useNextDeadline hook contract.
// Sources of truth:
//   .planning/phases/132-deadline-day-banner/132-CONTEXT.md §D-01, D-02
//   .planning/phases/132-deadline-day-banner/132-RESEARCH.md Validation Architecture
//   .planning/phases/132-deadline-day-banner/132-PATTERNS.md src/lib/hooks/useNextDeadline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useNextDeadline } from './useNextDeadline'

function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

interface EventInput {
  id?: number
  is_next?: boolean
  is_current?: boolean
  finished?: boolean
  data_checked?: boolean
  deadline_time?: string
}

function bootstrapPayload(events: EventInput[]) {
  return {
    elements: [],
    teams: [],
    events: events.map((e) => ({
      id: 1,
      is_current: false,
      is_next: false,
      finished: false,
      data_checked: false,
      deadline_time: '2026-01-01T11:00:00Z',
      ...e,
    })),
  }
}

beforeEach(() => {})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useNextDeadline — Phase 132 DL-01', () => {
  it('returns null when no event has is_next === true', async () => {
    const payload = bootstrapPayload([
      { id: 30, is_next: false, deadline_time: '2026-01-01T11:00:00Z' },
      { id: 31, is_next: false, deadline_time: '2026-01-08T11:00:00Z' },
      { id: 32, is_next: false, deadline_time: '2026-01-15T11:00:00Z' },
    ])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useNextDeadline(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('returns { id, deadline_time } when exactly one event has is_next === true', async () => {
    const payload = bootstrapPayload([
      { id: 32, is_next: false, deadline_time: '2026-01-15T11:00:00Z' },
      { id: 33, is_next: true, deadline_time: '2026-01-22T11:00:00Z' },
    ])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useNextDeadline(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 33, deadline_time: '2026-01-22T11:00:00Z' })
  })

  it('selects the is_next event even when surrounded by is_current and finished events', async () => {
    const payload = bootstrapPayload([
      { id: 30, finished: true, is_next: false },
      { id: 31, is_current: true, is_next: false },
      { id: 32, is_next: true, deadline_time: '2026-02-01T11:00:00Z' },
      { id: 33, is_next: false },
    ])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useNextDeadline(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 32, deadline_time: '2026-02-01T11:00:00Z' })
  })

  it('reaches isError when bootstrap returns non-OK status', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)
    // retry: 1 in the hook means the error state is reached after 1 retry (default ~1s delay).
    // Use a longer timeout to allow the retry cycle to complete.
    const { result } = renderHook(() => useNextDeadline(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.data).toBeUndefined()
  })
})
