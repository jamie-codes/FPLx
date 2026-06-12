// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'

// ── module mocks (set up BEFORE importing the component) ────────────────────

vi.mock('@/lib/hooks/useBootstrap', () => ({
  useBootstrap: vi.fn(),
}))
vi.mock('@/lib/hooks/useLiveGw', () => ({
  useLiveGw: vi.fn(),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: vi.fn(() => ({ data: [] })),
}))

import { useBootstrap } from '@/lib/hooks/useBootstrap'
import { useLiveGw }    from '@/lib/hooks/useLiveGw'
import { LiveGwTab }    from './LiveGwTab'
import type { LivePlayerStats, LivePicksResponse } from '@/lib/live-gw'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function makeStats(overrides: Partial<LivePlayerStats> = {}): LivePlayerStats {
  return {
    goals_scored: 0, assists: 0, bonus: 0, clean_sheets: 0,
    saves: 0, minutes: 90, total_points: 6, yellow_cards: 0, red_cards: 0,
    ...overrides,
  }
}

function makePicksData(overrides: Partial<LivePicksResponse> = {}): LivePicksResponse {
  return {
    active_chip: null,
    picks: [
      { element: 1,  position: 1,  multiplier: 1, is_captain: true,  is_vice_captain: false },
      { element: 2,  position: 2,  multiplier: 1, is_captain: false, is_vice_captain: true  },
      { element: 3,  position: 3,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 4,  position: 4,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 5,  position: 5,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 6,  position: 6,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 7,  position: 7,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 8,  position: 8,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 9,  position: 9,  multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 10, position: 10, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 11, position: 11, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 12, position: 12, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 13, position: 13, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 14, position: 14, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 15, position: 15, multiplier: 1, is_captain: false, is_vice_captain: false },
    ],
    automatic_subs: [],
    ...overrides,
  }
}

function makeLiveStats(): Map<number, LivePlayerStats> {
  const m = new Map<number, LivePlayerStats>()
  for (let id = 1; id <= 15; id++) {
    m.set(id, makeStats({ total_points: id === 1 ? 14 : 4 }))
  }
  return m
}

function makeBootstrap(overrides: { is_current?: boolean; finished?: boolean } = {}) {
  return {
    data: {
      events: [{
        id:           38,
        is_current:   overrides.is_current ?? true,
        is_next:      false,
        finished:     overrides.finished ?? false,
        deadline_time:'2026-05-15T10:00:00Z',
        data_checked: false,
      }],
      elements: [],
      teams:    [],
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('LiveGwTab', () => {
  it('T1: renders "load your squad" prompt when teamId is null', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: null, picksData: null, isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={null} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/load your squad/i)).toBeInTheDocument()
  })

  it('T2: renders live total points from computed score', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats:  makeLiveStats(),
      picksData:  makePicksData(),
      isLoading:  false,
      isError:    false,
      refetch:    vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    // captain elem 1 gets ×2: 14×2=28; 10 other starters ×4=40; total = 68
    expect(screen.getByText('68')).toBeInTheDocument()
  })

  it('T3: "LIVE" badge present when GW is_current and not finished', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap({ is_current: true, finished: false }) as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: makeLiveStats(), picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('T4: "Final" badge present when GW finished = true', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap({ is_current: true, finished: true }) as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: makeLiveStats(), picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('T5: VC promotion — "VC×2" label rendered when vc_promoted', () => {
    // Captain element 1 has 0 minutes, VC element 2 plays
    const statsMap = new Map<number, LivePlayerStats>()
    for (let id = 1; id <= 15; id++) {
      statsMap.set(id, makeStats({ total_points: 6, minutes: id === 1 ? 0 : 90 }))
    }
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: statsMap, picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/VC×2/)).toBeInTheDocument()
  })

  it('T6: auto-subs section rendered when auto_subs non-empty', () => {
    const picks = makePicksData({
      automatic_subs: [{ entry: 12345, element_in: 12, element_out: 5, event: 38 }],
    })
    const statsMap = makeLiveStats()
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: statsMap, picksData: picks,
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/Auto-subs/i)).toBeInTheDocument()
    // Verify the actual sub line content renders.
    // UIX-04 sanctioned tsc fix: the /s (dotAll) flag needs an es2018+ target —
    // [\s\S] matches across newlines without the flag (identical behaviour here).
    expect(screen.getByText(/Player5[\s\S]*Player12/)).toBeInTheDocument()
  })

  it('T7: provisional bonus disclaimer always rendered', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: makeLiveStats(), picksData: makePicksData(),
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/bonus points are provisional/i)).toBeInTheDocument()
  })

  it('T8: loading state renders skeleton placeholders, no player names', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: null, picksData: null,
      isLoading: true, isError: false, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    // Skeleton rows present, no actual player names
    expect(screen.queryByText('Player1')).not.toBeInTheDocument()
    const skeletons = document.querySelectorAll('[data-testid="skeleton-row"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('T9: error state — shows error message and Retry button', () => {
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: null, picksData: null,
      isLoading: false, isError: true, refetch: vi.fn(),
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/couldn't load live data/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('T10: clicking Retry calls refetch', async () => {
    const refetch = vi.fn()
    vi.mocked(useBootstrap).mockReturnValue(makeBootstrap() as any)
    vi.mocked(useLiveGw).mockReturnValue({
      liveStats: null, picksData: null,
      isLoading: false, isError: true, refetch,
    })
    render(<LiveGwTab teamId={12345} />, { wrapper: makeWrapper() })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
