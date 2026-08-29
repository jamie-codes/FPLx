'use client'

// Planner (2026-08-29): window start selector — lets the heat map focus a
// future run (e.g. GW4 onwards for a wildcard) instead of always starting at
// the next gameweek.
interface Props {
  /** Ascending event ids available in the data (union across teams). */
  options: number[]
  /** null = auto-follow the first available GW (pre-planner behaviour). */
  value: number | null
  onChange: (v: number | null) => void
}

export function FromGwSelect({ options, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="text-ink-muted">From</span>
      <select
        aria-label="From gameweek"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="border border-line bg-surface-1 text-ink rounded px-2 py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 text-sm cursor-pointer"
      >
        {/* Explicit auto option (review 2026-08-29): keeps a pinned first GW
            distinguishable from "follow the season forward", and makes null
            reachable again after a pin. */}
        <option value="">Next</option>
        {options.map(gw => (
          <option key={gw} value={gw}>
            GW{gw}
          </option>
        ))}
      </select>
    </label>
  )
}
