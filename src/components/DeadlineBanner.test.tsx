import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { DeadlineBanner } from './DeadlineBanner'

vi.mock('@/lib/hooks/useNextDeadline', () => ({
  useNextDeadline: vi.fn(),
}))
import { useNextDeadline } from '@/lib/hooks/useNextDeadline'
const mockedUseNextDeadline = vi.mocked(useNextDeadline)

const NOW = new Date('2026-08-15T10:00:00Z').getTime()
const isoMsFromNow = (ms: number) => new Date(NOW + ms).toISOString()

function getRoot(container: HTMLElement): HTMLElement {
  return container.firstChild as HTMLElement
}

describe('DeadlineBanner — DL-01 display', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('A1: renders null when hook returns null (off-season)', () => {
    mockedUseNextDeadline.mockReturnValue({ data: null } as any)
    const { container } = render(<DeadlineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('A2: renders correct countdown text when hook returns valid future deadline', () => {
    const ms = (14 * 60 + 22) * 60_000 // 14h 22m in ms
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(ms) },
    } as any)
    render(<DeadlineBanner />)
    expect(screen.getByText(/GW32 deadline in 14h 22m/)).toBeDefined()
  })

  it('A3: renders null when deadline_time is not a valid ISO string (NaN guard)', () => {
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: 'not-an-iso' },
    } as any)
    const { container } = render(<DeadlineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('A4: renders null when deadline_time is in the past', () => {
    const pastMs = -1 * 60 * 60_000 // 1 hour ago
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(pastMs) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    expect(container.firstChild).toBeNull()
  })
})

describe('DeadlineBanner — DL-02 urgency states', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('B1: msRemaining >= 24h → neutral surface-2 classes, no sticky', () => {
    const ms = 25 * 60 * 60_000 // 25h
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(ms) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    const root = getRoot(container)
    expect(root.className).toContain('bg-surface-2')
    expect(root.className).not.toContain('bg-warning-soft')
    expect(root.className).not.toContain('bg-negative-soft')
    expect(root.className).not.toContain('sticky')
  })

  it('B2: msRemaining between 2h and 24h → warning token classes, no sticky', () => {
    const ms = 12 * 60 * 60_000 // 12h
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(ms) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    const root = getRoot(container)
    expect(root.className).toContain('bg-warning-soft')
    expect(root.className).toContain('text-warning')
    expect(root.className).not.toContain('sticky top-0')
  })

  it('B3: msRemaining < 2h → negative token classes + sticky top-0 z-50', () => {
    const ms = 1 * 60 * 60_000 // 1h
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(ms) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    const root = getRoot(container)
    expect(root.className).toContain('bg-negative-soft')
    expect(root.className).toContain('text-negative')
    expect(root.className).toContain('sticky')
    expect(root.className).toContain('top-0')
    expect(root.className).toContain('z-50')
  })

  it('B4: auto-escalates from warning to negative after 60s tick (D-06)', async () => {
    // Start at 2h 30m → warning
    const ms = (2 * 60 + 30) * 60_000
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(ms) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    const root = getRoot(container)
    expect(root.className).toContain('bg-warning-soft')

    // Advance system time by 1 hour — now 1h 30m remaining → negative
    act(() => {
      vi.setSystemTime(NOW + 60 * 60_000)
      vi.advanceTimersByTime(60_000)
    })

    const rootAfter = getRoot(container)
    expect(rootAfter.className).toContain('bg-negative-soft')
  })
})

describe('DeadlineBanner — DL-03 dismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('C1: renders null when localStorage shows already dismissed for current GW', () => {
    localStorage.setItem('deadline-dismissed:GW32', '1')
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('C2: dismiss button hides banner and sets localStorage key', () => {
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    expect(container.firstChild).not.toBeNull()

    const dismissBtn = screen.getByRole('button', { name: /dismiss deadline banner/i })
    fireEvent.click(dismissBtn)

    expect(container.firstChild).toBeNull()
    expect(localStorage.getItem('deadline-dismissed:GW32')).toBe('1')
  })

  it('C3: localStorage.getItem throws → component still renders (no crash)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    const { container } = render(<DeadlineBanner />)
    expect(container.firstChild).not.toBeNull()
  })

  it('C4: localStorage.setItem throws on dismiss → banner still hides (no crash)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    const { container } = render(<DeadlineBanner />)

    const dismissBtn = screen.getByRole('button', { name: /dismiss deadline banner/i })
    fireEvent.click(dismissBtn)

    expect(container.firstChild).toBeNull()
  })
})

describe('DeadlineBanner — lifecycle + a11y', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('D1: clears interval on unmount', () => {
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    const clearSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = render(<DeadlineBanner />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })

  it('D2: banner root has role="status" for screen reader announcements', () => {
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    render(<DeadlineBanner />)
    const statusEl = screen.getByRole('status')
    expect(statusEl).toBeDefined()
  })

  it('D3: dismiss button has aria-label "Dismiss deadline banner"', () => {
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(5 * 60 * 60_000) },
    } as any)
    render(<DeadlineBanner />)
    const btn = screen.getByRole('button', { name: /dismiss deadline banner/i })
    expect(btn.getAttribute('aria-label')).toBe('Dismiss deadline banner')
  })

  it('E1: when hours === 0 renders minutes-only label (e.g. "45m" not "0h 45m")', () => {
    const ms = 45 * 60_000 // 45 minutes
    mockedUseNextDeadline.mockReturnValue({
      data: { id: 32, deadline_time: isoMsFromNow(ms) },
    } as any)
    render(<DeadlineBanner />)
    expect(screen.getByText(/GW32 deadline in 45m/)).toBeDefined()
    expect(screen.queryByText(/0h/)).toBeNull()
  })

  // SHELL-01: complement of MobileDeadlinePill's lg:hidden. Both visible at the
  // same width is the bug — the pair overflowed the top bar to 506px at 430px.
  it('is desktop-only', () => {
    const { container } = render(<DeadlineBanner />)
    const banner = container.querySelector('[data-testid="deadline-banner"]')
    expect(banner, 'banner should render in this fixture').not.toBeNull()
    expect(banner!.className).toContain('hidden')
    expect(banner!.className).toContain('lg:flex')
  })
})