'use client'

// Redesign Phase 3 (Cockpit): header row — "Cockpit — Gameweek N" + the loaded
// squad's Value/Bank stats (entry_history, tenths of £m). FTs are intentionally
// omitted: the free-transfer derivation rule currently lives inline (and
// duplicated) in TransferPanel + DecisionSummaryTab; it should be extracted to a
// shared helper before a third consumer renders it, rather than copied again.
import { useSquad } from '@/lib/hooks/useSquad'

export function CockpitHeader({ submittedId, gw }: {
  submittedId: string | null
  gw: number | null
}) {
  const { data: squad } = useSquad(submittedId)
  const eh = squad?.entry_history

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
        </div>
      )}
    </div>
  )
}
