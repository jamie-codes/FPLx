'use client'

// Redesign Phase 3 (Cockpit): header row — "Cockpit — Gameweek N" + the loaded
// squad's Value/Bank stats (entry_history, tenths of £m) and, when authenticated,
// FTs (via the shared deriveFreeTransfers helper).
import { useSquad } from '@/lib/hooks/useSquad'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { deriveFreeTransfers } from '@/lib/free-transfers'

export function CockpitHeader({ submittedId, gw }: {
  submittedId: string | null
  gw: number | null
}) {
  const { data: squad } = useSquad(submittedId)
  const { isAuthenticated } = useAuthStatus()
  const { data: myTeam } = useMyTeam(isAuthenticated && !!submittedId)
  const eh = squad?.entry_history
  const ft = isAuthenticated && myTeam ? deriveFreeTransfers(myTeam, squad?.active_chip) : null

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-h3 font-semibold text-ink">
        Cockpit
        {gw != null && <span className="text-ink-muted font-normal"> — Gameweek {gw}</span>}
      </h2>
      {eh && (
        <div className="flex items-baseline gap-4 text-data text-ink-muted tabular">
          <span>Value <span className="text-ink font-medium">£{(eh.value / 10).toFixed(1)}m</span></span>
          <span>Bank <span className="text-ink font-medium">£{(eh.bank / 10).toFixed(1)}m</span></span>
          {ft != null && <span>FTs <span className="text-accent font-medium">{ft}</span></span>}
        </div>
      )}
    </div>
  )
}
