'use client'
// §5: mobile-only GW + countdown pill for the top-bar right cluster.
// Minute precision, no seconds. Renders nothing off-season.
//
// SHELL-01 (2026-09-03): the pill now carries the same urgency states as
// DeadlineBanner. It used to be a fixed accent outline while the banner beside
// it did the amber/red escalation — and the banner is now desktop-only, because
// rendering both at mobile said the same thing twice and overflowed the top bar
// past the viewport. Urgency is the part of that banner worth keeping on a
// phone, which is where people check a deadline.
import { useDeadlineCountdown } from '@/lib/hooks/useDeadlineCountdown'
import { formatDeadlineCountdown } from '@/lib/deadline-format'
import { computeUrgency } from '@/components/DeadlineBanner'

// Outline + text, mirroring DeadlineBanner's URGENCY_CLASSES intent on a
// transparent pill rather than a filled banner. Accent is volt in dark and
// pitch-green in light — both pass as text and border.
const URGENCY_PILL: Record<string, string> = {
  neutral: 'border-accent text-accent',
  amber:   'border-warning text-warning',
  red:     'border-negative text-negative',
}

export function MobileDeadlinePill() {
  const cd = useDeadlineCountdown()
  if (cd === null || cd.ms <= 0) return null
  const urgency = computeUrgency(cd.ms)
  return (
    <span
      data-testid="mobile-deadline-pill"
      data-urgency={urgency}
      className={`lg:hidden inline-flex items-center rounded-full border px-2 py-0.5 text-data font-mono tabular whitespace-nowrap ${URGENCY_PILL[urgency]}`}
    >
      GW{cd.id} · {formatDeadlineCountdown(cd.ms, false)}
    </span>
  )
}
