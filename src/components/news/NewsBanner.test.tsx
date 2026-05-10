// @vitest-environment jsdom
// Phase 88 SCRAPER-01: NewsBanner — RTL component tests.
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
