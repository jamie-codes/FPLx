// @vitest-environment jsdom
// Phase 134 (PUSH-01): bell button permission gating tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { usePushSubscription } from './usePushSubscription'
import { BellNotificationButton } from './BellNotificationButton'

vi.mock('./usePushSubscription', () => ({
  usePushSubscription: vi.fn(),
}))

function mockHook(overrides: Partial<ReturnType<typeof usePushSubscription>> = {}) {
  const defaults = {
    status: 'default' as const,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    isLoading: false,
  }
  vi.mocked(usePushSubscription).mockReturnValue({ ...defaults, ...overrides })
  return { ...defaults, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(globalThis, 'Notification', {
    value: {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    },
    writable: true,
    configurable: true,
  })
})

describe('BellNotificationButton — PUSH-01 permission gating', () => {
  it('PUSH-01: does NOT call Notification.requestPermission on mount', () => {
    mockHook({ status: 'default' })
    render(<BellNotificationButton />)
    expect(globalThis.Notification.requestPermission).not.toHaveBeenCalled()
  })

  it('PUSH-01: calls subscribe only after Enable toggle click', () => {
    const mock = mockHook({ status: 'default' })
    render(<BellNotificationButton />)
    // Open the popover first
    fireEvent.click(screen.getByRole('button', { name: 'Push notifications' }))
    // Click the toggle
    fireEvent.click(screen.getByRole('switch'))
    expect(mock.subscribe).toHaveBeenCalledOnce()
    // requestPermission is NOT called directly by the component — it delegates to subscribe()
    expect(globalThis.Notification.requestPermission).not.toHaveBeenCalled()
  })
})

describe('BellNotificationButton — status text', () => {
  it('renders subscribed status text when status is granted', () => {
    mockHook({ status: 'granted' })
    render(<BellNotificationButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Push notifications' }))
    expect(screen.getByText("You're subscribed to push notifications")).toBeDefined()
  })

  it('renders denied status text when status is denied', () => {
    mockHook({ status: 'denied' })
    render(<BellNotificationButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Push notifications' }))
    expect(screen.getByText('Notifications blocked — check browser settings')).toBeDefined()
  })

  it('renders default status text when status is default', () => {
    mockHook({ status: 'default' })
    render(<BellNotificationButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Push notifications' }))
    expect(screen.getByText('Enable to receive price and deadline alerts')).toBeDefined()
  })
})
