'use client'
// §5: deadline countdown pinned at the sidebar bottom — GW label + a
// seconds-precision volt-mono clock. Desktop-only by construction (mounted
// inside the hidden-lg:flex sidebar aside). Renders nothing off-season.
import { useDeadlineCountdown } from '@/lib/hooks/useDeadlineCountdown'
import { formatDeadlineCountdown } from '@/lib/deadline-format'

export function SidebarDeadlineCard() {
  const cd = useDeadlineCountdown()
  if (cd === null || cd.ms <= 0) return null
  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="rounded-lg bg-deadline-bg border border-deadline-border px-3 py-2">
        <div className="text-data text-ink-muted">GW{cd.id} deadline</div>
        <div className="text-h4 font-mono tabular text-accent leading-tight">
          {formatDeadlineCountdown(cd.ms, true)}
        </div>
      </div>
    </div>
  )
}
