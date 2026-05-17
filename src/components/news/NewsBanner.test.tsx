// @vitest-environment jsdom
// Phase 88 SCRAPER-01: NewsBanner — RTL component tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { NewsBanner } from './NewsBanner'

vi.mock('@/lib/hooks/useAccuracy', () => ({ useNewsFlagEnabled: vi.fn() }))
import { useNewsFlagEnabled } from '@/lib/hooks/useAccuracy'

beforeEach(() => {
  vi.mocked(useNewsFlagEnabled).mockReturnValue(true)
})

describe('NewsBanner — Phase 88 SCRAPER-01', () => {
  it('renders with red severity when chance=50', () => {
    const { container } = render(<NewsBanner news="Hamstring injury" chance_of_playing_next_round={50} />)
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
    const cls = banner?.className ?? ''
    expect(cls).toContain('text-red-600')
    expect(cls).toContain('dark:text-red-400')
    expect(cls).toContain('text-xs')
    expect(banner?.textContent ?? '').toContain('Hamstring injury')
    const ariaHidden = container.querySelector('span[aria-hidden="true"]')
    expect(ariaHidden?.textContent ?? '').toContain('⚠')
    // Pitfall guard: no filled pill classes
    expect(cls).not.toContain('bg-red-100')
    expect(cls).not.toContain('rounded')
  })

  it('renders with amber severity when chance=75', () => {
    const { container } = render(<NewsBanner news="Knock - 75% chance" chance_of_playing_next_round={75} />)
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
    const cls = banner?.className ?? ''
    expect(cls).toContain('text-amber-600')
    expect(cls).toContain('dark:text-amber-400')
    expect(banner?.textContent ?? '').toContain('Knock - 75% chance')
    const ariaHidden = container.querySelector('span[aria-hidden="true"]')
    expect(ariaHidden?.textContent ?? '').toContain('⚠')
  })

  it('renders with zinc severity when chance=100 and news non-empty', () => {
    const { container } = render(<NewsBanner news="Returned from international duty" chance_of_playing_next_round={100} />)
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
    const cls = banner?.className ?? ''
    expect(cls).toContain('text-zinc-500')
    expect(cls).toContain('dark:text-zinc-400')
    expect(banner?.textContent ?? '').toContain('Returned from international duty')
    const ariaHidden = container.querySelector('span[aria-hidden="true"]')
    expect(ariaHidden?.textContent ?? '').toContain('ℹ')
  })

  it('returns null when severity is none (chance=100, news empty)', () => {
    const { container } = render(<NewsBanner news="" chance_of_playing_next_round={100} />)
    expect(container.firstChild).toBeNull()
    expect(container.querySelector('[data-testid="news-banner"]')).toBeNull()
  })

  it('returns null when gate is OFF even with red severity input', () => {
    vi.mocked(useNewsFlagEnabled).mockReturnValue(false)
    const { container } = render(<NewsBanner news="Hamstring" chance_of_playing_next_round={50} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('NewsBanner — Phase 115 NEWS-01 staleness gate', () => {
  const STALE_NOW = new Date('2026-01-01T00:00:00Z').getTime()
  const FRESH_NEWS_ADDED = '2025-12-19T00:00:00Z'  // 13 days before mocked now → within 14d → renders
  const STALE_NEWS_ADDED = '2025-12-17T00:00:00Z'  // 15 days before mocked now → stale

  afterEach(() => vi.restoreAllMocks())

  it('suppresses zinc badge when news_added is stale (> 14 days old)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(STALE_NOW)
    const { container } = render(
      <NewsBanner
        news="Returned from international duty"
        news_added={STALE_NEWS_ADDED}
        chance_of_playing_next_round={100}
      />
    )
    expect(container.firstChild).toBeNull()
    expect(container.querySelector('[data-testid="news-banner"]')).toBeNull()
  })

  it('renders zinc badge when news_added is fresh (< 14 days old)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(STALE_NOW)
    const { container } = render(
      <NewsBanner
        news="Returned from international duty"
        news_added={FRESH_NEWS_ADDED}
        chance_of_playing_next_round={100}
      />
    )
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
    const cls = banner?.className ?? ''
    expect(cls).toContain('text-zinc-500')
    expect(cls).toContain('dark:text-zinc-400')
  })

  it('does NOT suppress red badge when news_added is stale', () => {
    vi.spyOn(Date, 'now').mockReturnValue(STALE_NOW)
    const { container } = render(
      <NewsBanner
        news="Hamstring injury"
        news_added={STALE_NEWS_ADDED}
        chance_of_playing_next_round={50}
      />
    )
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
    const cls = banner?.className ?? ''
    expect(cls).toContain('text-red-600')
  })

  it('does NOT suppress amber badge when news_added is stale', () => {
    vi.spyOn(Date, 'now').mockReturnValue(STALE_NOW)
    const { container } = render(
      <NewsBanner
        news="Knock - 75% chance"
        news_added={STALE_NEWS_ADDED}
        chance_of_playing_next_round={75}
      />
    )
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
    const cls = banner?.className ?? ''
    expect(cls).toContain('text-amber-600')
  })

  it('does NOT suppress zinc badge when news_added is missing (undefined)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(STALE_NOW)
    const { container } = render(
      <NewsBanner
        news="Returned from international duty"
        chance_of_playing_next_round={100}
      />
    )
    const banner = container.querySelector('[data-testid="news-banner"]')
    expect(banner).not.toBeNull()
  })
})
