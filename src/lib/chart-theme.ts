// §5: shared Recharts chrome — the grid stroke, grid dash, and axis-tick style
// repeated verbatim across the 4 chart tabs (Accuracy, SeasonReview, Back,
// RankSim). Values read the live theme via CSS vars, so they follow light/dark
// automatically. Series/domain colours and divergent ReferenceLine strokes stay
// in the tabs. This is a DRY extraction of existing literals — no behaviour change.
export const CHART_GRID_STROKE = 'color-mix(in srgb, var(--color-ink-muted) 30%, transparent)'
export const CHART_GRID_DASH = '3 3'
export const CHART_TICK = { fontSize: 12, fill: 'currentColor' } as const
