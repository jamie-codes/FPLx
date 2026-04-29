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

function getDisplayP(container: HTMLElement): HTMLParagraphElement {
  const p = container.querySelector('p')
  if (!p) throw new Error('expected <p> element')
  return p as HTMLParagraphElement
}

describe('LastUpdatedDisplay', () => {
  it('renders the relativeTime string verbatim', () => {
    render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={false} />)
    expect(screen.getByText('3 hours ago')).toBeDefined()
  })

  it('uses zinc colour when not stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={false} />)
    const p = getDisplayP(container)
    expect(p.className).toContain('text-zinc-400')
    expect(p.className).not.toContain('text-amber-600')
  })

  it('uses amber colour when stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={true} />)
    const p = getDisplayP(container)
    expect(p.className).toContain('text-amber-600')
    expect(p.className).toContain('dark:text-amber-500')
    expect(p.className).not.toContain('text-zinc-400')
  })

  it('applies base classes text-xs and mt-1 when not stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={false} />)
    const p = getDisplayP(container)
    expect(p.className).toContain('text-xs')
    expect(p.className).toContain('mt-1')
  })

  it('applies base classes text-xs and mt-1 when stale', () => {
    const { container } = render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={true} />)
    const p = getDisplayP(container)
    expect(p.className).toContain('text-xs')
    expect(p.className).toContain('mt-1')
  })

  it('does not render "(stale)" suffix when stale is true', () => {
    render(<LastUpdatedDisplay relativeTime="3 hours ago" stale={true} />)
    expect(screen.getByText('3 hours ago').textContent).toBe('3 hours ago')
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
    expect(screen.getByText('1 hour ago')).toBeDefined()
  })

  it('re-formats label after 30 seconds elapse crossing a band boundary', async () => {
    mockedUseLastUpdated.mockReturnValue({
      data: { last_updated: isoMinutesBefore(59), stale: false },
    } as any)
    render(<LastUpdated />)
    expect(screen.getByText('59 min ago')).toBeDefined()

    act(() => {
      vi.setSystemTime(NOW + 60_000)
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText('1 hour ago')).toBeDefined()
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
    const p = getDisplayP(container)
    expect(p.className).toContain('text-amber-600')
  })
})
