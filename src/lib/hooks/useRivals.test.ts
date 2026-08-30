// @vitest-environment jsdom
// Phase 58 ML-01, ML-02, ML-08, D-05 — useRivals hook unit tests.
// Mocks global fetch with sequenced responses keyed by URL substring.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useRivals, RivalsError } from './useRivals'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function bootstrapPayload(deadlineISO: string) {
  return {
    elements: [],
    teams: [],
    events: [
      { id: 10, is_current: true, is_next: false, finished: false, data_checked: false, deadline_time: deadlineISO },
    ],
  }
}

/** Build a standings payload with rank 1..count and entry 1000..1000+count-1. */
function standingsPayload(count: number) {
  return {
    standings: {
      results: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        entry: 1000 + i,
        entry_name: `Team ${i + 1}`,
        player_name: `Manager ${i + 1}`,
        rank: i + 1,
      })),
    },
  }
}

function picksPayload(captainElement: number) {
  return {
    active_chip: null,
    picks: [
      { element: captainElement, position: 1, multiplier: 2, is_captain: true,  is_vice_captain: false },
      { element: 99,             position: 2, multiplier: 1, is_captain: false, is_vice_captain: true  },
    ],
  }
}

function historyPayload(usedChipNames: string[]) {
  return {
    chips: usedChipNames.map(n => ({ name: n, time: '2026-01-01', event: 5 })),
  }
}

function installFetchMock(routes: Record<string, () => unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    for (const key of Object.keys(routes)) {
      if (url.includes(key)) {
        return new Response(JSON.stringify(routes[key]()), { status: 200 })
      }
    }
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  // Use shouldAdvanceTime so waitFor polling (which uses setTimeout) still works.
  // The fixed 'now' value makes Date.now() deterministic for deadline gate tests.
  vi.useFakeTimers({ now: new Date('2026-05-01T12:00:00Z'), shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('useRivals', () => {
  it('ML-01: fetches the leagues-classic standings endpoint with the leagueId', async () => {
    const fetchMock = installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'leagues-classic/314/standings': () => standingsPayload(2),
      'event/10/picks': () => picksPayload(101),
      'history':       () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/fpl/leagues-classic/314/standings/'))
  })

  // Season-start UX (2026-08-30): classic league IDs are reissued every
  // season, so a 404 on standings is overwhelmingly a stale ID from last
  // season — the single generic message sent users hunting the wrong problem.
  it('surfaces a not_found RivalsError when standings 404s (stale league ID)', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      // no standings route -> mock returns 404
    })
    const { result } = renderHook(() => useRivals('999999', null), { wrapper: makeWrapper() })
    // useRivals sets retry: 1 (overriding the client default), so the error
    // state only settles after the retry delay — past waitFor's 1s default.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    const err = result.current.error as RivalsError
    expect(err).toBeInstanceOf(RivalsError)
    expect(err.kind).toBe('not_found')
  })

  it('surfaces an upstream RivalsError for non-404 standings failures', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bootstrap-static')) {
        return new Response(JSON.stringify(bootstrapPayload('2099-01-01T00:00:00Z')), { status: 200 })
      }
      return new Response('{}', { status: 503 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    // useRivals sets retry: 1 (overriding the client default), so the error
    // state only settles after the retry delay — past waitFor's 1s default.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect((result.current.error as RivalsError).kind).toBe('upstream')
  })

  it('surfaces a shape RivalsError when standings JSON does not match', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'leagues-classic/314/standings': () => ({ unexpected: true }),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    // useRivals sets retry: 1 (overriding the client default), so the error
    // state only settles after the retry delay — past waitFor's 1s default.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect((result.current.error as RivalsError).kind).toBe('shape')
  })

  it('ML-08: caps at 20 rivals and sets leagueTruncated when league is larger', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(25),
      'picks':            () => picksPayload(101),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals).toHaveLength(20)
    expect(result.current.data!.leagueTruncated).toBe(true)
  })

  it('ML-08: small league does not set leagueTruncated', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(5),
      'picks':            () => picksPayload(101),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals).toHaveLength(5)
    expect(result.current.data!.leagueTruncated).toBe(false)
  })

  it('numeric guard: non-numeric leagueId disables the query (no fetch)', async () => {
    const fetchMock = installFetchMock({})
    const { result } = renderHook(() => useRivals('abc', null), { wrapper: makeWrapper() })
    // Wait a tick — the query should never fire.
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('D-05 pre-deadline: captainPlayerId is null', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(1),
      'picks':            () => picksPayload(777),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals[0].captainPlayerId).toBeNull()
  })

  it('D-05 post-deadline: captainPlayerId equals is_captain element', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2000-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(1),
      'picks':            () => picksPayload(777),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals[0].captainPlayerId).toBe(777)
  })

  it('chipsRemaining excludes used chips and preserves CHIP_NAMES order', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(1),
      'picks':            () => picksPayload(101),
      'history':          () => historyPayload(['wildcard']),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals[0].chipsRemaining).toEqual(['bboost', '3xc', 'freehit'])
  })

  it('ML-02: rankGap = rival.rank - userRank when userTeamId resolves to a standings entry', async () => {
    // standingsPayload(5) -> entries with entry=1000..1004, rank=1..5.
    // userTeamId='1003' -> user is at entry=1003, rank=4.
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(5),
      'picks':            () => picksPayload(101),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', '1003'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const gaps = result.current.data!.rivals.map(r => r.rankGap)
    // ranks 1..5, userRank=4 -> gaps -3, -2, -1, 0, +1
    expect(gaps).toEqual([-3, -2, -1, 0, 1])
  })

  it('ML-02 fallback: rankGap = 0 for all rivals when userTeamId not found in standings', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(3),
      'picks':            () => picksPayload(101),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', '9999'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals.map(r => r.rankGap)).toEqual([0, 0, 0])
  })

  it('ML-02 fallback: rankGap = 0 for all rivals when userTeamId is null', async () => {
    installFetchMock({
      'bootstrap-static': () => bootstrapPayload('2099-01-01T00:00:00Z'),
      'standings':        () => standingsPayload(3),
      'picks':            () => picksPayload(101),
      'history':          () => historyPayload([]),
    })
    const { result } = renderHook(() => useRivals('314', null), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rivals.map(r => r.rankGap)).toEqual([0, 0, 0])
  })
})
