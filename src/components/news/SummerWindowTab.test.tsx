// @vitest-environment jsdom
// Phase 125 WIN-01 / D-01..D-09 — SummerWindowTab contract tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import { render, fireEvent } from '@testing-library/react'
import { SummerWindowTab } from './SummerWindowTab'
import type { TransferNewsArticle, TransferNewsFeed } from '@/lib/types'

vi.mock('@/lib/hooks/useTransferNews', () => ({
  useTransferNews: vi.fn(),
}))

import { useTransferNews } from '@/lib/hooks/useTransferNews'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ArticleOverride = Partial<TransferNewsArticle>

function makeArticle(overrides: ArticleOverride): TransferNewsArticle {
  return {
    title: 'Default Title',
    summary: null,
    url: 'https://example.com/article',
    published: '2026-05-19T10:00:00Z',
    source: 'skysports',
    classification: 'rumour',
    element_id: null,
    scraped_at: '2026-05-19T11:00:00Z',
    ...overrides,
  }
}

function mockFeed(
  articles: ArticleOverride[],
  scrapedAt?: string
): UseQueryResult<TransferNewsFeed> {
  return {
    data: {
      scraped_at: scrapedAt ?? '2026-05-19T11:00:00Z',
      articles: articles.map(makeArticle),
      source_health: {
        skysports: { ok: true, last_success: null, last_error: null },
        bbc: { ok: true, last_success: null, last_error: null },
      },
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: 'idle',
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetching: false,
    isStale: false,
    status: 'success',
    refetch: vi.fn(),
  } as unknown as UseQueryResult<TransferNewsFeed>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-19T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('SummerWindowTab — Phase 125 WIN-01', () => {
  it('Test 1 — renders 9 filter pills (5 classification + 4 tier) with labels in order', () => {
    vi.mocked(useTransferNews).mockReturnValue(mockFeed([]))
    const { getAllByRole } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    expect(pills).toHaveLength(9)
    const labels = pills.map(p => p.textContent)
    expect(labels).toEqual(['All', 'Confirmed', 'Rumour', 'Injury', 'Rotation', 'All', 'Official', 'Reliable', 'Speculative'])
  })

  it('Test 2 — default active filter is All on mount', () => {
    vi.mocked(useTransferNews).mockReturnValue(mockFeed([]))
    const { getAllByRole } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    expect(pills[0].getAttribute('aria-selected')).toBe('true')
    expect(pills[1].getAttribute('aria-selected')).toBe('false')
    expect(pills[2].getAttribute('aria-selected')).toBe('false')
    expect(pills[3].getAttribute('aria-selected')).toBe('false')
    expect(pills[4].getAttribute('aria-selected')).toBe('false')
  })

  it('Test 3 — clicking Confirmed pill filters articles to confirmed_signing only', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Confirmed Article', classification: 'confirmed_signing' },
        { title: 'Rumour Article', classification: 'rumour' },
        { title: 'Injury Article', classification: 'injury_return' },
        { title: 'Rotation Article', classification: 'rotation_signal' },
        { title: 'General Article', classification: 'general' },
      ])
    )
    const { getByText, getAllByRole, queryByText } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    fireEvent.click(pills[1]) // Confirmed
    expect(getByText('Confirmed Article')).toBeTruthy()
    expect(queryByText('Rumour Article')).toBeNull()
    expect(queryByText('Injury Article')).toBeNull()
    expect(queryByText('Rotation Article')).toBeNull()
    expect(queryByText('General Article')).toBeNull()
  })

  it('Test 4 — clicking a filter with no matching articles shows empty state', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Confirmed Article', classification: 'confirmed_signing' },
      ])
    )
    const { getAllByRole, container } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    fireEvent.click(pills[2]) // Rumour
    expect(container.textContent).toContain('No Rumour articles found.')
  })

  it('Test 5 — articles render sorted by published date descending', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Oldest Article', published: '2026-05-17T10:00:00Z', classification: 'rumour' },
        { title: 'Newest Article', published: '2026-05-19T10:00:00Z', classification: 'rumour' },
        { title: 'Middle Article', published: '2026-05-18T10:00:00Z', classification: 'rumour' },
      ])
    )
    const { container } = render(<SummerWindowTab />)
    const articleElements = container.querySelectorAll('article')
    expect(articleElements).toHaveLength(3)
    const titles = Array.from(articleElements).map(el => el.querySelector('a')?.textContent)
    expect(titles).toEqual(['Newest Article', 'Middle Article', 'Oldest Article'])
  })

  it('Test 6 — null published falls back to scraped_at for sorting', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Older Published',  published: '2026-05-17T10:00:00Z', scraped_at: '2026-05-17T10:30:00Z', classification: 'rumour' },
        { title: 'Null Published Newer Scraped', published: null, scraped_at: '2026-05-19T10:00:00Z', classification: 'rumour' },
      ])
    )
    const { container } = render(<SummerWindowTab />)
    const articleElements = container.querySelectorAll('article')
    expect(articleElements).toHaveLength(2)
    const titles = Array.from(articleElements).map(el => el.querySelector('a')?.textContent)
    // null-published uses scraped_at 2026-05-19 which is newer → renders first
    expect(titles[0]).toBe('Null Published Newer Scraped')
    expect(titles[1]).toBe('Older Published')
  })

  it('Test 7 — stale banner appears when scraped_at > 24h old', () => {
    // System time is 2026-05-19T12:00:00Z; scraped_at 26h earlier
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([], '2026-05-18T10:00:00Z')
    )
    const { container } = render(<SummerWindowTab />)
    expect(container.textContent).toContain('Feed last updated')
  })

  it('Test 8 — stale banner is absent when scraped_at is < 24h old', () => {
    // System time is 2026-05-19T12:00:00Z; scraped_at 1h earlier
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([], '2026-05-19T11:00:00Z')
    )
    const { container } = render(<SummerWindowTab />)
    expect(container.textContent).not.toContain('Feed last updated')
  })

  it('Test 9 — general-classification article appears under All only', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'General News Article', classification: 'general' },
      ])
    )
    const { getAllByRole, queryByText, getByText } = render(<SummerWindowTab />)
    // Under default All filter, article is visible
    expect(getByText('General News Article')).toBeTruthy()

    const pills = getAllByRole('tab')

    // Confirmed
    fireEvent.click(pills[1])
    expect(queryByText('General News Article')).toBeNull()

    // Rumour
    fireEvent.click(pills[2])
    expect(queryByText('General News Article')).toBeNull()

    // Injury
    fireEvent.click(pills[3])
    expect(queryByText('General News Article')).toBeNull()

    // Rotation
    fireEvent.click(pills[4])
    expect(queryByText('General News Article')).toBeNull()

    // Back to All — verify it returns
    fireEvent.click(pills[0])
    expect(getByText('General News Article')).toBeTruthy()
  })

  it('Test 10 — all <a> tags have target="_blank" rel="noopener noreferrer"', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Article One', url: 'https://example.com/1', classification: 'rumour' },
        { title: 'Article Two', url: 'https://example.com/2', classification: 'confirmed_signing' },
      ])
    )
    const { container } = render(<SummerWindowTab />)
    const links = container.querySelectorAll('a')
    expect(links.length).toBeGreaterThanOrEqual(1)
    links.forEach(link => {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })
})

describe('SummerWindowTab — Phase 131 SPEC-01/02/03', () => {
  // Test 11: tier badge renders (SPEC-01)
  // Query within article card — the filter row also has a Reliable pill button.
  // An article card with source_tier='Reliable' has 2 badge spans: [SKY] and Reliable.
  it('Test 11 — tier badge renders with tier label when source_tier present', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Sky Article', source: 'skysports', source_tier: 'Reliable' }])
    )
    const { container } = render(<SummerWindowTab />)
    const articleEl = container.querySelector('article')
    const badgeSpans = articleEl?.querySelectorAll('.flex.items-start.gap-2 > span')
    expect(badgeSpans?.length ?? 0).toBe(2)
    const tierBadge = badgeSpans?.[1]
    expect(tierBadge?.textContent).toBe('Reliable')
  })

  // Test 12: no tier badge on old blob (SPEC-01 / SC-4)
  // Query within article cards only — tier pill buttons in the filter row also render these labels.
  // An article card with no source_tier has exactly 1 badge span (the source badge).
  it('Test 12 — no tier badge rendered when source_tier absent (old blob)', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Old Article', source: 'skysports' }])
    )
    const { container } = render(<SummerWindowTab />)
    const articleEl = container.querySelector('article')
    // Only the [SKY] source badge span should be present — no tier badge span
    const badgeSpans = articleEl?.querySelectorAll('.flex.items-start.gap-2 > span')
    expect(badgeSpans?.length ?? 0).toBe(1)
    expect(badgeSpans?.[0]?.textContent).toBe('[SKY]')
  })

  // Test 13: stale opacity applied (SPEC-02)
  it('Test 13 — article >= 21 days old gets opacity-40 class', () => {
    // System time 2026-05-19T12:00:00Z; 22 days before = 2026-04-27
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Stale Article', published: '2026-04-27T10:00:00Z' }])
    )
    const { container } = render(<SummerWindowTab />)
    const article = container.querySelector('article')
    expect(article?.className).toContain('opacity-40')
  })

  // Test 14: fresh article no opacity (SPEC-02)
  it('Test 14 — article < 21 days old does not get opacity-40 class', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Fresh Article', published: '2026-05-18T10:00:00Z' }])
    )
    const { container } = render(<SummerWindowTab />)
    const article = container.querySelector('article')
    expect(article?.className).not.toContain('opacity-40')
  })

  // Test 15: pill count (SPEC-03)
  it('Test 15 — 9 pills total (5 classification + 4 tier) in default render', () => {
    vi.mocked(useTransferNews).mockReturnValue(mockFeed([]))
    const { getAllByRole } = render(<SummerWindowTab />)
    expect(getAllByRole('tab')).toHaveLength(9)
  })

  // Test 16: tier All shows all (SPEC-03)
  it('Test 16 — tier filter All shows all articles regardless of source_tier', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Reliable Article', source_tier: 'Reliable' },
        { title: 'Official Article', source_tier: 'Official' },
        { title: 'No Tier Article' },
      ])
    )
    const { getByText } = render(<SummerWindowTab />)
    expect(getByText('Reliable Article')).toBeTruthy()
    expect(getByText('Official Article')).toBeTruthy()
    expect(getByText('No Tier Article')).toBeTruthy()
  })

  // Test 17: tier filter click (SPEC-03)
  it('Test 17 — clicking Reliable tier pill filters to Reliable articles only', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Reliable Article', source_tier: 'Reliable' },
        { title: 'Official Article', source_tier: 'Official' },
      ])
    )
    const { getAllByRole, getByText, queryByText } = render(<SummerWindowTab />)
    fireEvent.click(getAllByRole('tab')[7]) // index 7 = Reliable tier pill
    expect(getByText('Reliable Article')).toBeTruthy()
    expect(queryByText('Official Article')).toBeNull()
  })

  // Test 18: AND logic (SPEC-03 / D-11)
  it('Test 18 — classification AND tier filter both apply (AND logic)', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Reliable Rumour',    classification: 'rumour',            source_tier: 'Reliable' },
        { title: 'Official Rumour',    classification: 'rumour',            source_tier: 'Official' },
        { title: 'Reliable Confirmed', classification: 'confirmed_signing', source_tier: 'Reliable' },
      ])
    )
    const { getAllByRole, getByText, queryByText } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    fireEvent.click(pills[2]) // Rumour classification pill
    fireEvent.click(pills[7]) // Reliable tier pill
    expect(getByText('Reliable Rumour')).toBeTruthy()
    expect(queryByText('Official Rumour')).toBeNull()
    expect(queryByText('Reliable Confirmed')).toBeNull()
  })
})
