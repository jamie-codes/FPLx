'use client'
// PICK-01: honest pick-quality stats. Live (BT-02-in-pipeline) once the season
// has >= 8 finished GWs; until then, the 2025/26 validation numbers (exp05).
import type { HonestMetrics } from '@/lib/types'
import { haulCaptureLabel } from '@/lib/picks'

const LAST_SEASON: HonestMetrics = {
  top10_mean_pts: 5.66,        // exp05 promoted model, validation GW29-38
  haul_capture_20: 0.194,
  captain_return_rate: 0.60,
  n_gws: 10,
}
const MIN_LIVE_GWS = 8

// UIX-03 Task 3: retokenized (plan said token-pure already; raw zinc found → migrated).
const CARD_CLS = 'rounded-lg border border-line bg-surface-2 px-3 py-2'

export function ConfidenceStrip({ honest }: { honest: HonestMetrics | undefined }) {
  const live = honest != null && honest.n_gws >= MIN_LIVE_GWS
  const m = live ? honest : LAST_SEASON
  const caption = live
    ? `measured over this season's ${m.n_gws} GWs`
    : 'measured on 2025/26 — switches to live after GW8'

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <div className={CARD_CLS}>
        <span className="font-semibold">{m.top10_mean_pts != null ? m.top10_mean_pts.toFixed(1) : '—'}</span> pts/pick
        <div className="text-xs text-ink-muted">top-10 weekly avg</div>
      </div>
      <div className={CARD_CLS}>
        <span className="font-semibold">{haulCaptureLabel(m.haul_capture_20)}</span>
        <div className="text-xs text-ink-muted">hauls captured in top-20</div>
      </div>
      <div className={CARD_CLS}>
        <span className="font-semibold">{m.captain_return_rate != null ? `${Math.round(m.captain_return_rate * 100)}%` : '—'}</span>
        <div className="text-xs text-ink-muted">#1 pick returns 6+</div>
      </div>
      <div className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-ink-muted self-stretch flex items-center">
        {caption}
      </div>
    </div>
  )
}
