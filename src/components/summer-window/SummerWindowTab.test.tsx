// @vitest-environment jsdom
// Phase 125 WIN-01 — SummerWindowTab render tests.
// Tests: loading state, error state, stale banner (D-04), filter pills (D-05/D-06),
// article list (D-01/D-02/D-03), empty state (D-09).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SummerWindowTab } from './SummerWindowTab'
import type { TransferNewsFeed } from '@/lib/types'

vi.mock('@/lib/hooks/useTransferNews', () => ({ useTransferNews: vi.fn() }))

import { useTransferNews } from '@/lib/hooks/useTransferNews'

const mockedUseTransferNews = vi.mocked(useTransferNews)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const NOW = new Date('2026-05-19T12:00:00Z').getTime()

// Articles covering the full set of classifications
const FRESH_AT = new Date(NOW - 1 * 60 * 60 * 1000).toISOString()   // 1h ago — fresh
const STALE_AT = new Date(NOW - 25 * 60 * 60 * 1000).toISOString()  // 25h ago — stale

const FEED_FRESH: TransferNewsFeed = {
  scraped_at: FRESH_AT,
  articles: [
    {
      title: 'Salah signs new deal',
      summary: null,
      url: 'https://skysports.com/salah',
      published: FRESH_AT,
      source: 'skysports',
      classification: 'confirmed_signing',
      element_id: 1,
      scraped_at: FRESH_AT,
    },
    {
      title: 'Haaland injury return',
      summary: null,
      url: 'https://bbc.co.uk/haaland',
      published: FRESH_AT,
      source: 'bbc',
      classification: 'injury_return',
      element_id: 2,
      scraped_at: FRESH_AT,
    },
    {
      title: 'Saka rumour',
      summary: null,
      url: 'https://skysports.com/saka',
      published: FRESH_AT,
      source: 'skysports',
      classification: 'rumour',
      element_id: 3,
      scraped_at: FRESH_AT,
    },
    {
      title: 'Some rotation news',
      summary: null,
      url: 'https://bbc.co.uk/rotation',
      published: FRESH_AT,
      source: 'bbc',
      classification: 'rotation_signal',
      element_id: null,
      scraped_at: FRESH_AT,
    },
    {
      title: 'General transfer news',
      summary: null,
      url: 'https://bbc.co.uk/general',
      published: FRESH_AT,
      source: 'bbc',
      classification: 'general',
      element_id: null,
      scraped_at: FRESH_AT,
    },
  ],
  source_health: {
    skysports: { ok: true, article_count: 2, last_scraped_at: FRESH_AT },
    bbc: { ok: true, article_count: 3, last_scraped_at: FRESH_AT },
  },
}

const FEED_STALE: TransferNewsFeed = {
  ...FEED_FRESH,
  scraped_at: STALE_AT,
}

describe('SummerWindowTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fix Date.now() so stale threshold calculations are deterministic
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders loading skeleton when isLoading', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: true, isError: false, data: undefined } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    expect(screen.getByTestId('summer-window-loading')).toBeTruthy()
  })

  it('renders error state when isError', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: true, data: undefined } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    expect(screen.getByTestId('summer-window-error')).toBeTruthy()
  })

  it('renders the tab container when data is available', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    expect(screen.getByTestId('summer-window-tab')).toBeTruthy()
  })

  it('does NOT show stale banner when feed is fresh', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    expect(screen.queryByTestId('stale-feed-banner')).toBeNull()
  })

  it('shows stale banner when feed.scraped_at is older than 24h (D-04)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_STALE } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    expect(screen.getByTestId('stale-feed-banner')).toBeTruthy()
  })

  it('renders 5 filter pills: All, Confirmed, Rumour, Injury, Rotation (D-05)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    const pillGroup = screen.getByTestId('filter-pills')
    const buttons = pillGroup.querySelectorAll('button')
    expect(buttons.length).toBe(5)
    const labels = Array.from(buttons).map(b => b.textContent)
    expect(labels).toContain('All')
    expect(labels).toContain('Confirmed')
    expect(labels).toContain('Rumour')
    expect(labels).toContain('Injury')
    expect(labels).toContain('Rotation')
  })

  it('default active pill is "All" (D-07)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    const allButton = screen.getByRole('button', { name: 'All' })
    expect(allButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows all 5 articles under "All" filter (D-08: general visible under All)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    const cards = screen.getAllByTestId('article-card')
    expect(cards.length).toBe(5)
  })

  it('filters to confirmed_signing articles when "Confirmed" pill is clicked (D-08)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }))
    const cards = screen.getAllByTestId('article-card')
    expect(cards.length).toBe(1)
    expect(cards[0].textContent).toContain('Salah signs new deal')
  })

  it('filters to injury_return articles when "Injury" pill is clicked (D-08)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Injury' }))
    const cards = screen.getAllByTestId('article-card')
    expect(cards.length).toBe(1)
    expect(cards[0].textContent).toContain('Haaland injury return')
  })

  it('shows empty state when no articles match active filter (D-09)', () => {
    const feedWithNoRumours: TransferNewsFeed = {
      ...FEED_FRESH,
      articles: FEED_FRESH.articles.filter(a => a.classification !== 'rumour'),
    }
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: feedWithNoRumours } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Rumour' }))
    expect(screen.getByTestId('empty-state')).toBeTruthy()
    expect(screen.getByTestId('empty-state').textContent).toContain('No Rumour articles found.')
  })

  it('article titles link to the original URL in new tab (D-02)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    const links = screen.getAllByRole('link')
    const salahLink = links.find(l => l.textContent === 'Salah signs new deal')
    expect(salahLink).not.toBeUndefined()
    expect(salahLink?.getAttribute('href')).toBe('https://skysports.com/salah')
    expect(salahLink?.getAttribute('target')).toBe('_blank')
  })

  it('renders source badge [SKY] for skysports articles (D-03)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    // The first card (Salah) is skysports
    const cards = screen.getAllByTestId('article-card')
    expect(cards[0].textContent).toContain('[SKY]')
  })

  it('renders source badge [BBC] for bbc articles (D-03)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    // Haaland (index 1) is BBC
    const cards = screen.getAllByTestId('article-card')
    expect(cards[1].textContent).toContain('[BBC]')
  })

  it('general articles are NOT shown under Rotation filter (D-05: general only under All)', () => {
    mockedUseTransferNews.mockReturnValue({ isLoading: false, isError: false, data: FEED_FRESH } as ReturnType<typeof useTransferNews>)
    render(<SummerWindowTab />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: 'Rotation' }))
    const cards = screen.getAllByTestId('article-card')
    // Only rotation_signal article, not general
    expect(cards.length).toBe(1)
    expect(cards[0].textContent).toContain('Some rotation news')
  })
})
