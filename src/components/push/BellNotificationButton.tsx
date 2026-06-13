'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePushSubscription, type PushPermissionStatus } from './usePushSubscription'

const STATUS_TEXT: Record<PushPermissionStatus, string> = {
  granted: "You're subscribed to push notifications",
  denied: 'Notifications blocked — check browser settings',
  default: 'Enable to receive price and deadline alerts',
  unsupported: 'Push notifications are not supported in this browser',
}

const STATUS_CLASS: Record<PushPermissionStatus, string> = {
  granted: 'text-positive',
  denied: 'text-warning',
  default: 'text-ink-muted',
  unsupported: 'text-ink-muted',
}

export function BellNotificationButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { status, subscribe, unsubscribe, isLoading } = usePushSubscription()
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleToggle() {
    if (status === 'denied' || status === 'unsupported') return
    if (status === 'granted') {
      void unsubscribe()
    } else {
      void subscribe()
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Push notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="p-2 rounded text-ink-muted hover:text-ink min-h-[44px]"
      >
        🔔
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Push notification settings"
          className="absolute right-0 top-full mt-2 w-60 bg-surface-1 border border-line rounded-lg p-4 shadow-lg z-50"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-ink">Push notifications</span>
            <button
              role="switch"
              aria-checked={status === 'granted'}
              aria-label="Enable push notifications"
              disabled={status === 'denied' || status === 'unsupported' || isLoading}
              onClick={handleToggle}
              className={[
                'relative inline-flex h-6 w-10 flex-shrink-0 rounded-full transition-colors',
                status === 'granted' ? 'bg-positive' : 'bg-surface-2',
                status === 'denied' || status === 'unsupported'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1',
                  status === 'granted' ? 'translate-x-5' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>
          <p aria-live="polite" className={`mt-2 text-sm ${STATUS_CLASS[status]}`}>
            {STATUS_TEXT[status]}
          </p>
        </div>
      )}
    </div>
  )
}
