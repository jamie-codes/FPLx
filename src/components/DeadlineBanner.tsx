'use client'

import { useEffect, useState } from 'react'
import { useNextDeadline } from '@/lib/hooks/useNextDeadline'

// ─── Types ────────────────────────────────────────────────────────────────────

type UrgencyState = 'neutral' | 'amber' | 'red'

// ─── Constants ────────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS  // 86_400_000
const TWO_HOURS_MS = 2 * ONE_HOUR_MS            // 7_200_000
const TICK_MS = 60_000

const URGENCY_CLASSES: Record<UrgencyState, string> = {
  neutral: 'bg-surface-2 text-ink-muted border-line',
  amber:   'bg-warning-soft text-warning border-warning/40',
  red:     'bg-negative-soft text-negative border-negative/40',
}

const STICKY_CLASSES: Record<UrgencyState, string> = {
  neutral: '',
  amber:   '',
  red:     'sticky top-0 z-50',
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function computeUrgency(msRemaining: number): UrgencyState {
  if (msRemaining >= TWENTY_FOUR_HOURS_MS) return 'neutral'
  if (msRemaining >= TWO_HOURS_MS) return 'amber'
  return 'red'
}

export function formatCountdown(msRemaining: number): string {
  const totalMinutes = Math.floor(msRemaining / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeadlineBanner() {
  const { data } = useNextDeadline()

  const id = data?.id ?? null
  const deadlineTime = data?.deadline_time ?? null

  // NaN guard: treat missing or unparseable deadline_time as invalid
  const deadlineMs = deadlineTime ? new Date(deadlineTime).getTime() : NaN
  const invalidDeadline = !deadlineTime || Number.isNaN(deadlineMs)

  // Dismissed state — lazy initialiser reads localStorage on first mount only.
  // If id is null (data not yet available), default to false.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (id === null) return false
    try {
      return localStorage.getItem(`deadline-dismissed:GW${id}`) !== null
    } catch {
      return false
    }
  })

  // Reset dismissed when GW id changes (handles cross-GW tab sessions).
  useEffect(() => {
    if (id === null) {
      setDismissed(false)
      return
    }
    try {
      setDismissed(localStorage.getItem(`deadline-dismissed:GW${id}`) !== null)
    } catch {
      setDismissed(false)
    }
  }, [id])

  // msRemaining state — initialised from computed deadline, reset on each tick.
  const [msRemaining, setMsRemaining] = useState<number>(() =>
    invalidDeadline ? 0 : deadlineMs - Date.now()
  )

  // Countdown interval — depends only on deadlineTime, not on dismissed or msRemaining.
  useEffect(() => {
    if (!deadlineTime) return
    const tick = () => {
      const ms = new Date(deadlineTime).getTime() - Date.now()
      setMsRemaining(ms)
    }
    tick()
    const intervalId = setInterval(tick, TICK_MS)
    return () => clearInterval(intervalId)
  }, [deadlineTime])

  // ─── Render gates ───────────────────────────────────────────────────────────
  if (data === null || data === undefined) return null
  if (id === null) return null
  if (invalidDeadline) return null
  if (msRemaining <= 0) return null
  if (dismissed) return null

  const urgency = computeUrgency(msRemaining)

  // ─── Dismiss handler ────────────────────────────────────────────────────────
  function handleDismiss() {
    if (id !== null) {
      try {
        localStorage.setItem(`deadline-dismissed:GW${id}`, '1')
      } catch {
        // private browsing / quota exceeded — still hide locally via React state
      }
    }
    setDismissed(true)
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b px-4 py-2 -mx-4 flex items-center gap-2 text-sm font-medium ${URGENCY_CLASSES[urgency]} ${STICKY_CLASSES[urgency]}`}
    >
      <span>GW{id} deadline in {formatCountdown(msRemaining)}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss deadline banner"
        className="ml-auto min-h-[44px] px-2 py-1 opacity-60 hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  )
}
