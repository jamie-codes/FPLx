// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const countdownMock = vi.fn()
vi.mock('@/lib/hooks/useDeadlineCountdown', () => ({ useDeadlineCountdown: () => countdownMock() }))

import { SidebarDeadlineCard } from './SidebarDeadlineCard'

describe('SidebarDeadlineCard', () => {
  afterEach(() => countdownMock.mockReset())

  it('renders the GW label and a seconds-precision countdown', () => {
    countdownMock.mockReturnValue({ id: 5, ms: 21 * 86_400_000 + 23 * 3_600_000 + 33 * 60_000 + 7000 })
    const { container } = render(<SidebarDeadlineCard />)
    expect(container.textContent).toContain('GW5 deadline')
    expect(container.textContent).toContain('21d 23:33:07')
  })

  it('renders nothing when there is no deadline', () => {
    countdownMock.mockReturnValue(null)
    const { container } = render(<SidebarDeadlineCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the deadline has passed (ms <= 0)', () => {
    countdownMock.mockReturnValue({ id: 5, ms: 0 })
    const { container } = render(<SidebarDeadlineCard />)
    expect(container.firstChild).toBeNull()
  })
})
