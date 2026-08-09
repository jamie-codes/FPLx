// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const countdownMock = vi.fn()
vi.mock('@/lib/hooks/useDeadlineCountdown', () => ({ useDeadlineCountdown: () => countdownMock() }))

import { MobileDeadlinePill } from './MobileDeadlinePill'

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
})
