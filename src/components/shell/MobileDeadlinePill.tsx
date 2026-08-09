'use client'
// §5: mobile-only GW + countdown pill for the top-bar right cluster. Volt
// outline + accent text (accent is volt in dark, pitch-green in light — both
// pass as text/border). Minute precision, no seconds. Renders nothing off-season.
import { useDeadlineCountdown } from '@/lib/hooks/useDeadlineCountdown'
import { formatDeadlineCountdown } from '@/lib/deadline-format'

export function MobileDeadlinePill() {
  const cd = useDeadlineCountdown()
  if (cd === null || cd.ms <= 0) return null
  return (
    <span className="lg:hidden inline-flex items-center rounded-full border border-accent text-accent px-2 py-0.5 text-data font-mono tabular whitespace-nowrap">
      GW{cd.id} · {formatDeadlineCountdown(cd.ms, false)}
    </span>
  )
}
