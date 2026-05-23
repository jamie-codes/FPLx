// @vitest-environment jsdom
// Phase 134 (PUSH-01): bell button permission gating tests

import { describe, it } from 'vitest'

describe('BellNotificationButton', () => {
  it.todo('PUSH-01: does NOT call Notification.requestPermission on mount')
  it.todo('PUSH-01: calls Notification.requestPermission only after Enable toggle click')
  it.todo('renders status text matching subscription state (Subscribed / Permission denied / Not subscribed)')
})
