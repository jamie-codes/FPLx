import type { RouteFlags } from '@/lib/routes'

interface RoutePillsCellProps {
  flags: RouteFlags
}

// Set-piece pills: solid filled, white text, bold
const SETPIECE_BASE = 'text-[9px] px-[5px] py-[2px] rounded-[3px] leading-[1.4] font-bold text-white'
// Statistical pills: outline only (no fill), coloured text, semibold
const STAT_BASE = 'text-[9px] px-[5px] py-[2px] rounded-[3px] leading-[1.4] font-semibold border'

export function RoutePillsCell({ flags }: RoutePillsCellProps) {
  const hasSome = flags.pk || flags.fk || flags.ck || flags.xg || flags.xa
  if (!hasSome) return <span className="text-zinc-400">—</span>

  return (
    <span className="inline-flex gap-[3px] flex-wrap items-center">
      {flags.pk && (
        <span className={`${SETPIECE_BASE} bg-red-500`} title="Penalty taker">PK</span>
      )}
      {flags.fk && (
        <span className={`${SETPIECE_BASE} bg-orange-500`} title="Direct FK taker">FK</span>
      )}
      {flags.ck && (
        <span className={`${SETPIECE_BASE} bg-emerald-500`} title="Corner taker">CK</span>
      )}
      {flags.xg && (
        <span className={`${STAT_BASE} border-blue-500 text-blue-400`} title="Above-median xG in team">xG</span>
      )}
      {flags.xa && (
        <span className={`${STAT_BASE} border-violet-500 text-violet-400`} title="Above-median xA in team">xA</span>
      )}
    </span>
  )
}
