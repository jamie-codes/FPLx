'use client'

export type ViewPreset = 'default' | 'compact' | 'analysis'

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
  regression_signal: false,
  differential_flag: false,
  cs_prob_1gw: false,   // Phase 47 D-09: hidden on mobile (consistent with secondary numeric columns)
  routes_to_points: false,   // Phase 76 RTP-02: hidden on mobile per phase spec (D-A4: isMobile-only, no portrait branch)
}

export const PRESET_COLUMN_VISIBILITY: Record<ViewPreset, Record<string, boolean>> = {
  compact: {
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
    regression_signal: false,
    differential_flag: false,
    trend: false,
    fixtures: false,
    last_gw_actual_pts: false,   // ACC-05 D-10: hidden in Compact preset only
    cs_prob_1gw: false,   // Phase 47 D-09: hidden in Compact preset
  },
  default: {
    fdr_score: false,
    form_score: false,
    xg_per90: false,
    xa_per90: false,
    xg_score: false,
    xa_score: false,
    ownership_score: false,
    minutes_score: false,
    set_piece_score: false,
    cs_prob_1gw: false,   // Phase 47 D-09: hidden in Default preset
  },
  analysis: {
    fdr_score: false,
    form_score: false,
    xg_score: false,
    xa_score: false,
    ownership_score: false,
    minutes_score: false,
    set_piece_score: false,
  },
}

export function getColumnVisibility(
  horizon: 1 | 3 | 5,
  isMobile = false,
  preset: ViewPreset = 'default'
): Record<string, boolean> {
  const gwVisibility = {
    xPts_1gw: horizon === 1,
    xPts_3gw: horizon === 3,
    xPts_5gw: horizon === 5,
  }

  if (isMobile) {
    return { ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }
  }

  return { ...PRESET_COLUMN_VISIBILITY[preset], ...gwVisibility }
}

interface Props {
  value: 1 | 3 | 5
  onChange: (v: 1 | 3 | 5) => void
  disabled?: boolean  // Phase 46 (D-08): when true, add pointer-events-none opacity-50 to wrapper (FH mode)
}

export function GwToggle({ value, onChange, disabled }: Props) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <div
        role="group"
        aria-label="Projected points horizon"
        className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
      >
        {([1, 3, 5] as const).map((gw) => (
          <button
            key={gw}
            onClick={() => onChange(gw)}
            aria-pressed={value === gw}
            className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
              value === gw
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            }`}
          >
            {gw} GW
          </button>
        ))}
      </div>
    </div>
  )
}
