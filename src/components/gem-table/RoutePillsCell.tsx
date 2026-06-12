import type { RouteFlags } from '@/lib/routes'

interface RoutePillsCellProps {
  flags: RouteFlags
}

// UIX-03: stays bespoke (9px micro-pills don't fit the Chip envelope) — internals
// retokenized per the badge policy: PK→negative, FK→warning, CK→positive (solid),
// xG→accent, xA→violet (outline). The 5-colour distinction is preserved.
// Set-piece pills: solid filled, on-accent ink, bold
const SETPIECE_BASE = 'text-[9px] px-[5px] py-[2px] rounded-[3px] leading-[1.4] font-bold text-on-accent'
// Statistical pills: outline only (no fill), coloured text, semibold
const STAT_BASE = 'text-[9px] px-[5px] py-[2px] rounded-[3px] leading-[1.4] font-semibold border'

export function RoutePillsCell({ flags }: RoutePillsCellProps) {
  const hasSome = flags.pk || flags.fk || flags.ck || flags.xg || flags.xa
  if (!hasSome) return <span className="text-ink-muted">—</span>

  return (
    <span className="inline-flex gap-[3px] flex-wrap items-center">
      {flags.pk && (
        <span className={`${SETPIECE_BASE} bg-negative`} title="Penalty taker">PK</span>
      )}
      {flags.fk && (
        <span className={`${SETPIECE_BASE} bg-warning`} title="Direct FK taker">FK</span>
      )}
      {flags.ck && (
        <span className={`${SETPIECE_BASE} bg-positive`} title="Corner taker">CK</span>
      )}
      {flags.xg && (
        <span className={`${STAT_BASE} border-accent text-accent`} title="Above-median xG in team">xG</span>
      )}
      {flags.xa && (
        <span className={`${STAT_BASE} border-violet text-violet`} title="Above-median xA in team">xA</span>
      )}
    </span>
  )
}
