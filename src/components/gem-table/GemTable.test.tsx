// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

vi.mock('@/lib/hooks/usePlayerInsight', () => ({
  usePlayerInsight: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  readCachedInsight: vi.fn().mockReturnValue(null),
}))

vi.mock('@/components/shared/PlayerInsightSection', () => ({
  PlayerInsightSection: vi.fn(() =>
    createElement('div', { 'data-testid': 'player-insight-section' }, 'mock-section'),
  ),
}))

// Mock heavy hooks to avoid network calls in tests
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: vi.fn().mockReturnValue({
    data: [
      {
        id: 1,
        web_name: 'Salah',
        element_type: 3,
        team: 14,
        team_short_name: 'LIV',
        now_cost: 130,
        gem_score: 5.0,
        xPts_1gw: 6.8,
        start_prob: 0.98,
        form_pts_per90: 8.5,
        selected_by_percent: '40.0',
        cost_change_event: 0,
        rotation_risk: false,
        fixtures: [],
        xg_per90: 0.5,
        xa_per90: 0.3,
        news: '',
        news_added: null,
        chance_of_playing_next_round: null,
        mins_60_prob: 0.95,
        penalties_order: null,
        direct_freekicks_order: null,
        corners_and_indirect_freekicks_order: null,
        fdr_score: 0.7,
        form_score: 0.9,
        xg_score: 0.6,
        xa_score: 0.4,
        ownership_score: 0.5,
        minutes_score: 0.9,
        set_piece_score: 0.0,
        // Required by column renderers
        status: 'a',
        mins_risk: 'nailed',
        form: '8.5',
        total_points: 120,
        pts_last3gw: 15,
        pts_last5gw: 25,
        pts_gw_count: 5,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: vi.fn().mockReturnValue({ data: null, isLoading: false, error: null }),
  useNewsFlagEnabled: vi.fn().mockReturnValue(false),
}))

import { GemTable } from './GemTable'
import { usePlayerInsight } from '@/lib/hooks/usePlayerInsight'

function withQueryClient(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(createElement(QueryClientProvider, { client: qc }, ui))
}

describe('GemTable PlayerInsightSection integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePlayerInsight).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    } as never)
  })

  it('PlayerInsightSection rendered in mobile expand row', () => {
    const { container, getByText } = withQueryClient(<GemTable />)
    // Click the row to expand it
    const playerRow = getByText('Salah')
    fireEvent.click(playerRow)
    // Both mobile (sm:hidden) and desktop (hidden sm:table-row) expand rows exist in DOM
    const sections = container.querySelectorAll('[data-testid="player-insight-section"]')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('PlayerInsightSection rendered in desktop expand row', () => {
    const { container, getByText } = withQueryClient(<GemTable />)
    fireEvent.click(getByText('Salah'))
    // After expand, both rows exist in DOM (CSS controls visibility)
    // We check length === 2: one for mobile row, one for desktop row
    const sections = container.querySelectorAll('[data-testid="player-insight-section"]')
    expect(sections.length).toBe(2)
  })

  it('does not fire mutate on expand (no useEffect trigger)', () => {
    const mutate = vi.fn()
    vi.mocked(usePlayerInsight).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
    } as never)
    const { getByText } = withQueryClient(<GemTable />)
    // Expand the row
    fireEvent.click(getByText('Salah'))
    // mutate must NOT have been called — no useEffect auto-trigger allowed
    expect(mutate).not.toHaveBeenCalled()
  })
})

describe('watchlist star button', () => {
  it('renders "⭐ Pin to watchlist" text when player id is not in watchlistIds', () => {
    const { container, getByText } = withQueryClient(
      <GemTable watchlistIds={[]} toggleWatchlist={vi.fn()} />
    )
    fireEvent.click(getByText('Salah'))
    const buttons = container.querySelectorAll('button[type="button"]')
    const pinButtons = Array.from(buttons).filter(b => b.textContent?.includes('Pin to watchlist'))
    expect(pinButtons.length).toBeGreaterThan(0)
  })

  it('renders "⭐ Pinned" text and text-amber-500 class when id is in watchlistIds', () => {
    const { container, getByText } = withQueryClient(
      <GemTable watchlistIds={[1]} toggleWatchlist={vi.fn()} />
    )
    fireEvent.click(getByText('Salah'))
    const buttons = container.querySelectorAll('button[type="button"]')
    const pinnedButtons = Array.from(buttons).filter(b => b.textContent?.includes('Pinned'))
    expect(pinnedButtons.length).toBeGreaterThan(0)
    expect(pinnedButtons[0].className).toContain('text-amber-500')
  })

  it('clicking the star button calls toggleWatchlist with the player id', () => {
    const toggleWatchlist = vi.fn()
    const { container, getByText } = withQueryClient(
      <GemTable watchlistIds={[]} toggleWatchlist={toggleWatchlist} />
    )
    fireEvent.click(getByText('Salah'))
    const buttons = container.querySelectorAll('button[type="button"]')
    const pinButton = Array.from(buttons).find(b => b.textContent?.includes('Pin to watchlist'))
    expect(pinButton).toBeDefined()
    fireEvent.click(pinButton!)
    expect(toggleWatchlist).toHaveBeenCalledWith(1)
    expect(toggleWatchlist).toHaveBeenCalledTimes(1)
  })
})
