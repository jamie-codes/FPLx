// @vitest-environment jsdom
// NEWS-01: the two in-season news surfaces, rehoused out of the hidden
// Pre-Season tool. Children are mocked — they have their own tests, and both
// pull TanStack Query hooks this test does not provide a client for.
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

vi.mock('@/components/news/SummerWindowTab', () => ({
  SummerWindowTab: () => <div data-testid="summer-window-tab" />,
}))
vi.mock('@/components/transfers-confirmed/ConfirmedTransfersTab', () => ({
  ConfirmedTransfersTab: (props: { onOpenWindow: () => void }) => (
    <div data-testid="confirmed-transfers-tab">
      <button onClick={props.onOpenWindow}>see the window feed</button>
    </div>
  ),
}))

import { TransferNewsTab } from './TransferNewsTab'

describe('TransferNewsTab (NEWS-01)', () => {
  it('opens on confirmed moves — the "who has actually left" question', () => {
    render(<TransferNewsTab />)
    expect(screen.getByTestId('confirmed-transfers-tab')).toBeTruthy()
    expect(screen.queryByTestId('summer-window-tab')).toBeNull()
  })

  it('switches to the window feed from the toggle', () => {
    render(<TransferNewsTab />)
    fireEvent.click(screen.getByText('Window feed'))
    expect(screen.getByTestId('summer-window-tab')).toBeTruthy()
    expect(screen.queryByTestId('confirmed-transfers-tab')).toBeNull()
  })

  it('honours the confirmed tab’s own link into the window feed', () => {
    render(<TransferNewsTab />)
    fireEvent.click(screen.getByText('see the window feed'))
    expect(screen.getByTestId('summer-window-tab')).toBeTruthy()
  })
})
