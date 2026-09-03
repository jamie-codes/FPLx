// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const countdownMock = vi.fn()
vi.mock('@/lib/hooks/useDeadlineCountdown', () => ({ useDeadlineCountdown: () => countdownMock() }))

import { MobileDeadlinePill } from './MobileDeadlinePill'
import { computeUrgency } from '@/components/DeadlineBanner'

describe('MobileDeadlinePill', () => {
  afterEach(() => countdownMock.mockReset())

  it('renders GW id and a minute-precision countdown', () => {
    countdownMock.mockReturnValue({ id: 5, ms: 21 * 86_400_000 + 23 * 3_600_000 + 33 * 60_000 + 7000 })
    const { container } = render(<MobileDeadlinePill />)
    expect(container.textContent).toContain('GW5')
    expect(container.textContent).toContain('21d 23:33')
    expect(container.textContent).not.toContain('21d 23:33:07') // no seconds on the pill
  })

  it('renders nothing when there is no deadline', () => {
    countdownMock.mockReturnValue(null)
    const { container } = render(<MobileDeadlinePill />)
    expect(container.firstChild).toBeNull()
  })

  // SHELL-01: the pill is the only deadline element on a phone now, so it has
  // to carry the escalation DeadlineBanner used to provide beside it.
  it.each([
    ['neutral', 25 * 3_600_000],   // over 24h out
    ['amber', 5 * 3_600_000],      // inside 24h
    ['red', 30 * 60_000],          // inside 2h
  ])('escalates to %s urgency', (urgency, ms) => {
    countdownMock.mockReturnValue({ id: 5, ms })
    const { container } = render(<MobileDeadlinePill />)
    const pill = container.querySelector('[data-testid="mobile-deadline-pill"]')!
    expect(pill.getAttribute('data-urgency')).toBe(urgency)
  })

  it('urgency matches DeadlineBanner exactly, so the two never disagree', () => {
    for (const ms of [48 * 3_600_000, 24 * 3_600_000, 23 * 3_600_000, 2 * 3_600_000, 90 * 60_000, 1000]) {
      countdownMock.mockReturnValue({ id: 5, ms })
      const { container, unmount } = render(<MobileDeadlinePill />)
      const pill = container.querySelector('[data-testid="mobile-deadline-pill"]')!
      expect(pill.getAttribute('data-urgency'), String(ms)).toBe(computeUrgency(ms))
      unmount()
    }
  })

  it('stays mobile-only while the banner stays desktop-only', () => {
    // jsdom applies no CSS, so the breakpoint contract is asserted on the class
    // names. These two must remain complements: showing both at any width is
    // what pushed the top bar past the viewport (SHELL-01).
    countdownMock.mockReturnValue({ id: 5, ms: 5 * 3_600_000 })
    const { container } = render(<MobileDeadlinePill />)
    expect(container.querySelector('[data-testid="mobile-deadline-pill"]')!.className)
      .toContain('lg:hidden')
  })
})
