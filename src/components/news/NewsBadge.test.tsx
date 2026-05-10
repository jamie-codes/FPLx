// @vitest-environment jsdom
// Phase 88 SCRAPER-01: NewsBadge — RTL component tests.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { NewsBadge } from './NewsBadge'

vi.mock('@/lib/hooks/useAccuracy', () => ({ useNewsFlagEnabled: vi.fn() }))
import { useNewsFlagEnabled } from '@/lib/hooks/useAccuracy'

beforeEach(() => {
  vi.mocked(useNewsFlagEnabled).mockReturnValue(true)
})

describe('NewsBadge — Phase 88 SCRAPER-01', () => {
  it('returns the news string when gate enabled and news non-empty', () => {
    const { container } = render(<NewsBadge news="Hamstring injury" />)
    expect(container.textContent).toBe('Hamstring injury')
  })

  it('returns null when gate enabled but news is empty string', () => {
    const { container } = render(<NewsBadge news="" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when gate enabled but news is whitespace-only', () => {
    const { container } = render(<NewsBadge news="   " />)
    expect(container.textContent).toBe('')
    expect(container.firstChild).toBeNull()
  })

  it('returns null when gate disabled even with non-empty news', () => {
    vi.mocked(useNewsFlagEnabled).mockReturnValue(false)
    const { container } = render(<NewsBadge news="Hamstring injury" />)
    expect(container.firstChild).toBeNull()
  })
})
