import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LastUpdated, LastUpdatedDisplay } from './LastUpdated'

vi.mock('@/lib/hooks/useLastUpdated', () => ({
  useLastUpdated: vi.fn(),
}))
import { useLastUpdated } from '@/lib/hooks/useLastUpdated'
const mockedUseLastUpdated = vi.mocked(useLastUpdated)

const NOW = new Date('2026-04-29T12:00:00Z').getTime()
const isoMinutesBefore = (mins: number) => new Date(NOW - mins * 60_000).toISOString()

function getDisplaySpan(container: HTMLElement): HTMLSpanElement {
  const span = container.querySelector('span')
  if (!span) throw new Error('expected <span> element')
  return span as HTMLSpanElement
}

describe('LastUpdatedDisplay', () => {
  it('renders the relativeTime string with Updated prefix', () => {
    render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={false} />)
    expect(screen.getByText('Updated 3 hours ago', { exact: false })).toBeDefined()
  })

  it('uses surface-elevated token when not stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={false} />)
    const span = getDisplaySpan(container)
    expect(span.className).toContain('bg-surface-elevated')
    expect(span.className).toContain('text-muted')
    expect(span.className).not.toContain('bg-amber-50')
  })

  it('uses amber colour when stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={true} />)
    const span = getDisplaySpan(container)
    expect(span.className).toContain('text-amber-600')
    expect(span.className).toContain('dark:text-amber-400')
    expect(span.className).toContain('bg-amber-50')
    expect(span.className).not.toContain('bg-surface-elevated')
  })

  it('applies base pill classes when not stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={false} />)
    const span = getDisplaySpan(container)
    expect(span.className).toContain('text-xs')
    expect(span.className).toContain('rounded-full')
    expect(span.className).toContain('px-2')
    expect(span.className).toContain('py-1')
  })

  it('applies base pill classes when stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={true} />)
    const span = getDisplaySpan(container)
    expect(span.className).toContain('text-xs')
    expect(span.className).toContain('rounded-full')
    expect(span.className).toContain('px-2')
    expect(span.className).toContain('py-1')
  })

  it('does not render "(stale)" suffix when stale is true', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={true} />)
    const span = getDisplaySpan(container)
    // Full textContent includes the dot character + "Updated 3 hours ago"
    expect(span.textContent).not.toContain('(stale)')
    expect(span.textContent).toContain('Updated 3 hours ago')
  })
})

describe('LastUpdated (connected)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders nothing when hook returns undefined data', () => {
    mockedUseLastUpdated.mockReturnValue({ data: undefined } as any)
    const { container } = render(<LastUpdated />)
    expect(container.firstChild).toBeNull()
  })

  it('renders formatted relative time on first paint', () => {
    mockedUseLastUpdated.mockReturnValue({
      data: { last_updated: isoMinutesBefore(60), stale: false },
    } as any)
    render(<LastUpdated />)
    expect(screen.getByText('Updated 1 hour ago', { exact: false })).toBeDefined()
  })

  it('does not render a blank label on first paint when data is cached', () => {
    mockedUseLastUpdated.mockReturnValue({
      data: { last_updated: isoMinutesBefore(60), stale: false },
    } as any)
    const { container } = render(<LastUpdated />)
    const span = container.querySelector('span')
    // span should be null (not rendered) or have non-empty text — never an empty <span>
    if (span) expect(span.textContent).not.toBe('')
  })

  it('re-formats label after 30 seconds elapse crossing a band boundary', async () => {
    mockedUseLastUpdated.mockReturnValue({
      data: { last_updated: isoMinutesBefore(59), stale: false },
    } as any)
    render(<LastUpdated />)
    expect(screen.getByText('Updated 59 min ago', { exact: false })).toBeDefined()

    act(() => {
      vi.setSystemTime(NOW + 60_000)
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText('Updated 1 hour ago', { exact: false })).toBeDefined()
  })

  it('clears interval on unmount', () => {
    mockedUseLastUpdated.mockReturnValue({
      data: { last_updated: isoMinutesBefore(60), stale: false },
    } as any)
    const clearSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = render(<LastUpdated />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })

  it('renders amber when stale flag is true', () => {
    mockedUseLastUpdated.mockReturnValue({
      data: { last_updated: isoMinutesBefore(60), stale: true },
    } as any)
    const { container } = render(<LastUpdated />)
    const span = getDisplaySpan(container)
    expect(span.className).toContain('text-amber-600')
  })
})
