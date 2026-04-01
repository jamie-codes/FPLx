'use client'

export const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  team_short_name: false,
  now_cost: false,
  fdr_score: false,
  form_score: false,
  xg_per90: false,
  xa_per90: false,
  xg_score: false,
  xa_score: false,
  ownership_score: false,
  minutes_score: false,
  set_piece_score: false,
  selected_by_percent: false,
  status: false,
  trend: false,
  fixtures: false,
}

export function getColumnVisibility(horizon: 1 | 3 | 5, isMobile = false): Record<string, boolean> {
  const gwVisibility = {
    proj_pts_1gw: horizon === 1,
    proj_pts_3gw: horizon === 3,
    proj_pts_5gw: horizon === 5,
  }

  if (!isMobile) {
    return gwVisibility
  }

  return { ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }
}

interface Props {
  value: 1 | 3 | 5
  onChange: (v: 1 | 3 | 5) => void
}

export function GwToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Projected points horizon"
      className="flex rounded overflow-hidden border border-zinc-300"
    >
      {([1, 3, 5] as const).map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === gw
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
