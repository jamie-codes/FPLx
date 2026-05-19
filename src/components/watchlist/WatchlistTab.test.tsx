// @vitest-environment jsdom
// Phase 127 WATCH-01, WATCH-02, WATCH-04: WatchlistTab component tests.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MergedPlayer, PreSeasonSquad, TransferNewsArticle } from '@/lib/types'

// Mock all four hooks
const usePlayers = vi.fn()
const useLineupNews = vi.fn()
const usePreSeasonSquad = vi.fn()
const useTransferNews = vi.fn()

vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: () => usePlayers() }))
vi.mock('@/lib/hooks/useLineupNews', () => ({ useLineupNews: () => useLineupNews() }))
vi.mock('@/lib/hooks/usePreSeasonSquad', () => ({ usePreSeasonSquad: () => usePreSeasonSquad() }))
vi.mock('@/lib/hooks/useTransferNews', () => ({ useTransferNews: () => useTransferNews() }))

// Import AFTER mocks
import { WatchlistTab } from './WatchlistTab'

function withQueryClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(createElement(QueryClientProvider, { client: qc }, ui))
}

function makePlayer(overrides: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1,
    web_name: 'Salah',
    element_type: 3,
    team: 14,
    team_short_name: 'LIV',
    now_cost: 130,
    selected_by_percent: '42.5',
    cost_change_event: 0,
    cost_change_start: 0,
    form: '8.5',
    status: 'a',
    minutes: 2700,
    starts: 30,
    total_points: 220,
    goals_scored: 18,
    assists: 12,
    expected_goals: 15.3,
    expected_assists: 10.1,
    pts_last3gw: 18,
    pts_last5gw: 28,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    xmins: 80,
    start_prob: 0.97,
    mins_risk: 'nailed',
    minutes_per90: 85,
    form_pts_per90: 8.0,
    fixtures: [],
    gem_score: 5.0,
    fdr_score: 0.7,
    form_score: 0.9,
    xg_score: 0.6,
    xa_score: 0.4,
    ownership_score: 0.5,
    minutes_score: 0.9,
    set_piece_score: 0.0,
    understat_id: 100,
    xg_per90: 0.5,
    xa_per90: 0.3,
    xPts_1gw: 6.8,
    xPts_3gw: 18.0,
    xPts_5gw: 28.0,
    regression_signal: null,
    actual_vs_xg_delta: null,
    differential_flag: null,
    ...overrides,
  } as unknown as MergedPlayer
}

function makeSquad(playerIds: number[] = [1]): PreSeasonSquad {
  return {
    starters: playerIds.slice(0, Math.min(11, playerIds.length)).map(id => ({
      id,
      web_name: `Player${id}`,
      element_type: 3 as const,
      team: 1,
      team_short_name: 'TST',
      now_cost: 60,
      total_points: 100,
      ppm: 0.5,
    })),
    bench: [],
    formation: '4-3-3',
    budgetUsed: 900,
  }
}

function defaultMocks() {
  usePlayers.mockReturnValue({ data: [makePlayer()], isLoading: false, isError: false })
  useLineupNews.mockReturnValue({ data: undefined })
  usePreSeasonSquad.mockReturnValue({ data: null })
  useTransferNews.mockReturnValue({ data: undefined })
}

describe('WatchlistTab', () => {
  it('renders loading skeleton when usePlayers is loading', () => {
    usePlayers.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    useLineupNews.mockReturnValue({ data: undefined })
    usePreSeasonSquad.mockReturnValue({ data: null })
    useTransferNews.mockReturnValue({ data: undefined })

    const { container } = withQueryClient(
      <WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />
    )
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('renders error message when usePlayers isError is true', () => {
    usePlayers.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    useLineupNews.mockReturnValue({ data: undefined })
    usePreSeasonSquad.mockReturnValue({ data: null })
    useTransferNews.mockReturnValue({ data: undefined })

    withQueryClient(<WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />)
    expect(screen.getByText(/Failed to load player data/i)).not.toBeNull()
  })

  it('renders empty-state copy when watchlistIds is empty', () => {
    defaultMocks()
    withQueryClient(<WatchlistTab watchlistIds={[]} toggleWatchlist={vi.fn()} />)
    expect(screen.getByText(/No players pinned yet/i)).not.toBeNull()
  })

  it('renders a card for each non-departed watchlistId', () => {
    defaultMocks()
    const { container } = withQueryClient(
      <WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />
    )
    // Salah's card should be present
    expect(container.textContent).toContain('Salah')
  })

  it('renders a Departed pill for an id present in watchlistIds but absent from usePlayers data', () => {
    defaultMocks()
    // watchlistIds includes id 999 which is not in the players data
    withQueryClient(<WatchlistTab watchlistIds={[1, 999]} toggleWatchlist={vi.fn()} />)
    expect(screen.getByText('Departed')).not.toBeNull()
  })

  it('renders amber border on a card when the corresponding lineupNewsMap entry has news', () => {
    usePlayers.mockReturnValue({ data: [makePlayer()], isLoading: false, isError: false })
    useLineupNews.mockReturnValue({
      data: new Map([[1, { id: 1, news_headline: 'Salah doubt', news_added: null }]]),
    })
    usePreSeasonSquad.mockReturnValue({ data: null })
    useTransferNews.mockReturnValue({ data: undefined })

    const { container } = withQueryClient(
      <WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />
    )
    expect(container.querySelector('.border-amber-400')).not.toBeNull()
  })

  it('renders squad-overlap dot on a card whose id is in the squad starters (envelope shape)', () => {
    usePlayers.mockReturnValue({ data: [makePlayer()], isLoading: false, isError: false })
    useLineupNews.mockReturnValue({ data: undefined })
    // envelope shape: { squad: PreSeasonSquad, health: null, solver: 'ilp' }
    usePreSeasonSquad.mockReturnValue({ data: { squad: makeSquad([1]), health: null, solver: 'ilp' } })
    useTransferNews.mockReturnValue({ data: undefined })

    withQueryClient(<WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />)
    expect(screen.getByLabelText('In your pre-season squad')).not.toBeNull()
  })

  it('renders ConfirmedSigningBadge when useTransferNews returns a confirmed_signing article matching a watchlist player', () => {
    const article: TransferNewsArticle = {
      title: 'Salah signs new deal',
      summary: null,
      url: 'https://bbc.co.uk/salah',
      published: null,
      source: 'bbc',
      classification: 'confirmed_signing',
      element_id: 1,
      scraped_at: new Date().toISOString(),
    }
    usePlayers.mockReturnValue({ data: [makePlayer()], isLoading: false, isError: false })
    useLineupNews.mockReturnValue({ data: undefined })
    usePreSeasonSquad.mockReturnValue({ data: null })
    useTransferNews.mockReturnValue({ data: { scraped_at: new Date().toISOString(), articles: [article], source_health: {} } })

    withQueryClient(<WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />)
    expect(screen.getByTestId('confirmed-signing-badge')).not.toBeNull()
  })

  it('does NOT render ConfirmedSigningBadge when useTransferNews returns an empty articles array', () => {
    usePlayers.mockReturnValue({ data: [makePlayer()], isLoading: false, isError: false })
    useLineupNews.mockReturnValue({ data: undefined })
    usePreSeasonSquad.mockReturnValue({ data: null })
    useTransferNews.mockReturnValue({ data: { scraped_at: new Date().toISOString(), articles: [], source_health: {} } })

    withQueryClient(<WatchlistTab watchlistIds={[1]} toggleWatchlist={vi.fn()} />)
    expect(screen.queryByTestId('confirmed-signing-badge')).toBeNull()
  })
})
