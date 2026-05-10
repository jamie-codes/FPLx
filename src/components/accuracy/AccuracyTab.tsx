'use client'

import { Fragment, useMemo, useState } from 'react'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import { useDataHealth } from '@/lib/hooks/useDataHealth'
import type {
  AccuracyBacktest,
  AccuracyHaulter,
  VersionRecord,
  VersionGateFlags,
  CalibrationBucket,
  CalibrationData,
  DataHealth,         // Phase 82 DH-02
  SanityCheck,        // Phase 82 DH-02
} from '@/lib/types'
import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'

// Tier thresholds + colour classes — reused verbatim from InsightsTab (TIER_CLASSES locked by 33-UI-SPEC).
const TIER_CLASSES = {
  HIGH:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  LOW:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
} as const
type Tier = keyof typeof TIER_CLASSES

function getHitRateTier(rate: number): Tier {
  if (rate >= 0.50) return 'HIGH'
  if (rate >= 0.30) return 'MEDIUM'
  return 'LOW'
}

// ============================================================================
// Phase 82 DH-02: Data Health Panel helpers
// ============================================================================

const SANITY_CHECK_LABELS: Record<SanityCheck['id'], string> = {
  player_count:         'Player count',
  missing_player_delta: 'Missing player delta',
  understat_null_pct:   'Understat null %',
  pipeline_stale:       'Pipeline stale',
}

const RED_PILL_CLS = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'

function rollUpStatus(checks: SanityCheck[]): 'ok' | 'warn' | 'error' {
  if (checks.some(c => c.status === 'error')) return 'error'
  if (checks.some(c => c.status === 'warn'))  return 'warn'
  return 'ok'
}

function formatSanityValue(check: SanityCheck): string {
  if (typeof check.value === 'boolean') return check.value ? 'true' : 'false'
  if (check.id === 'understat_null_pct') return `${check.value.toFixed(2)}%`
  return String(check.value)
}

function SanityIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok')   return <span className="text-green-600 dark:text-green-400" aria-label="ok">✓</span>
  if (status === 'warn') return <span className="text-amber-600 dark:text-amber-400" aria-label="warning">⚠</span>
  return <span className="text-red-600 dark:text-red-400" aria-label="error">✗</span>
}

function HitRateBadge({ rate }: { rate: number }) {
  const tier = getHitRateTier(rate)
  return (
    <span className={`inline-block text-xs rounded px-2 py-0.5 ${TIER_CLASSES[tier]}`}>
      {(rate * 100).toFixed(1)}%
    </span>
  )
}

function FlaggedCell({ flagged }: { flagged: boolean }) {
  return flagged
    ? <span className="text-green-600 dark:text-green-400" aria-label="Flagged: yes">✓</span>
    : <span className="text-zinc-400 dark:text-zinc-500" aria-label="Flagged: no">✗</span>
}

function DeltaCell({ delta }: { delta: number }) {
  const formatted = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
  const cls = delta < 0
    ? 'text-red-600 dark:text-red-400'
    : delta > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500'
  return <span className={cls}>{formatted}</span>
}

// Locked table chrome classes (UI-SPEC).
const TH_CLS = 'text-left font-semibold text-zinc-600 dark:text-zinc-400 pb-1 border-b border-zinc-200 dark:border-zinc-700'
const TR_CLS = 'even:bg-zinc-50 dark:even:bg-zinc-800/50'
const TD_CLS = 'py-1'
const TABLE_CLS = 'w-full text-sm border-collapse'

// Phase 63 VER-02: helpers for VersionHistoryTable
function formatRecordedAt(iso: string): string {
  // YYYY-MM-DD only — daily pipeline cadence makes time-of-day noise (UI-SPEC line 210)
  return new Date(iso).toISOString().slice(0, 10)
}

const GATE_LABEL: Record<keyof VersionGateFlags, string> = {
  xmins_v2_enabled: 'xmins v2',
  bonus_predictor_enabled: 'bonus predictor',
  form_signal_enabled: 'form signal',
  save_predictor_enabled: 'save predictor',
  mc_enabled: 'MC sim',
}

function GateFlagsCell({ flags }: { flags: VersionGateFlags }) {
  const enabled = (Object.entries(flags) as Array<[keyof VersionGateFlags, boolean]>)
    .filter(([, on]) => on)
    .map(([key]) => GATE_LABEL[key])

  if (enabled.length === 0) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {enabled.map((label) => (
        <span
          key={label}
          className="inline-block text-xs rounded px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function VersionHistoryTable({ data }: { data: AccuracyBacktest }) {
  const versions = data.versions ?? []
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Model Version History</h2>
      <div className="overflow-x-auto">
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={TH_CLS}>Version</th>
            <th scope="col" className={TH_CLS}>Recorded</th>
            <th scope="col" className={TH_CLS}>Hit Rate</th>
            <th scope="col" className={TH_CLS} title="Change vs previous version">Δ</th>
            <th scope="col" className={TH_CLS}>Active Gates</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v, i) => {
            const prev = versions[i - 1]
            const delta = prev ? (v.hit_rate - prev.hit_rate) * 100 : null
            const isCurrent = i === versions.length - 1
            return (
              <tr key={v.formula_version} className={TR_CLS}>
                <td className={TD_CLS}>
                  {v.formula_version}
                  {isCurrent && (
                    <span className="ml-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      (current)
                    </span>
                  )}
                </td>
                <td className={TD_CLS}>{formatRecordedAt(v.recorded_at)}</td>
                <td className={TD_CLS}><HitRateBadge rate={v.hit_rate} /></td>
                <td className={TD_CLS}>
                  {delta === null
                    ? <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    : <DeltaCell delta={delta} />}
                </td>
                <td className={TD_CLS}>
                  <GateFlagsCell flags={v.gate_flags} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      {versions.length === 1 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          First pipeline run — no version history yet.
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Phase 63 CAL-01 / CAL-02: Calibration Reliability section
// ============================================================================

type CalibrationPosition = 'all' | '1' | '2' | '3' | '4'

const POSITION_PILLS: ReadonlyArray<{ value: CalibrationPosition; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'GK' },
  { value: '2', label: 'DEF' },
  { value: '3', label: 'MID' },
  { value: '4', label: 'FWD' },
]

function positionLabel(p: CalibrationPosition): string {
  const found = POSITION_PILLS.find((pill) => pill.value === p)
  return found ? found.label : 'All'
}

function PositionTabSelector({
  value,
  onChange,
}: {
  value: CalibrationPosition
  onChange: (v: CalibrationPosition) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Calibration position filter"
      className="flex flex-wrap gap-2 mb-2"
    >
      {POSITION_PILLS.map((pill) => {
        const active = pill.value === value
        const cls = active
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        return (
          <button
            key={pill.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(pill.value)}
            className={`min-h-[44px] px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${cls}`}
          >
            {pill.label}
          </button>
        )
      })}
    </div>
  )
}

function CalibrationTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as CalibrationBucket
  const bucketLow = Math.round((p.bucket_mid - 0.05) * 100)
  const bucketHigh = Math.round((p.bucket_mid + 0.05) * 100)
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Decile {bucketLow}%–{bucketHigh}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Predicted: {(p.predicted_rate * 100).toFixed(1)}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Actual: {(p.actual_rate * 100).toFixed(1)}%
      </p>
      <p className="text-zinc-500 dark:text-zinc-400 mt-1">n = {p.sample_n}</p>
    </div>
  )
}

function XptsTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as CalibrationBucket
  // Pitfall 3: legacy-cache buckets lack the new fields — guard before use.
  if (p.predicted_mean == null || p.actual_mean == null) return null
  const bucketLow = Math.round((p.bucket_mid - 0.05) * 100)
  const bucketHigh = Math.round((p.bucket_mid + 0.05) * 100)
  const deviation = p.actual_mean - p.predicted_mean
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Decile {bucketLow}%–{bucketHigh}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Predicted: {p.predicted_mean.toFixed(2)} pts
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Actual: {p.actual_mean.toFixed(2)} pts
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Deviation: {deviation.toFixed(2)} pts
      </p>
      <p className="text-zinc-500 dark:text-zinc-400 mt-1">n = {p.sample_n}</p>
    </div>
  )
}

function CalibrationSection({ data }: { data: AccuracyBacktest }) {
  const [position, setPosition] = useState<CalibrationPosition>('all')

  const chartData = useMemo<CalibrationBucket[]>(() => {
    const all = data.calibration?.by_position?.[position] ?? []
    return all.filter((b) => b.sample_n >= 5)  // Pitfall 5: omit sparse, do NOT zero
  }, [data.calibration, position])

  // Phase 91 CAL-01: separate filter for the xPts chart (Pitfall 5: mean-aware predicate
  // drops legacy-cache buckets that lack the new optional fields).
  const xptsData = useMemo<CalibrationBucket[]>(() => {
    const all = data.calibration?.by_position?.[position] ?? []
    return all.filter(
      (b) => b.sample_n >= 5 && b.predicted_mean != null && b.actual_mean != null,
    )
  }, [data.calibration, position])

  // Phase 91 CAL-01: dynamic ReferenceLine endpoint. Pitfall 4: empty array -> default to 1
  // to avoid Math.max(...[]) returning -Infinity and corrupting the auto-domain.
  const maxPredictedMean = useMemo(() => {
    if (xptsData.length === 0) return 1
    return Math.max(...xptsData.map((b) => b.predicted_mean ?? 0))
  }, [xptsData])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Calibration Reliability</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        Predicted xPts decile vs actual haul rate. A well-calibrated model traces
        the diagonal — points above mean under-confidence, points below mean over-confidence.
      </p>

      <PositionTabSelector value={position} onChange={setPosition} />

      <div className="flex gap-4 text-xs text-zinc-600 dark:text-zinc-400 mb-2">
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 12, height: 2, background: 'currentColor' }} />
          Actual haul rate
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: 12, height: 0, borderTop: '1px dashed rgba(161,161,170,0.7)' }} />
          Perfect calibration (y=x)
        </span>
      </div>

      <div
        data-testid="calibration-chart"
        className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative"
      >
        <ResponsiveContainer width="100%" height={288}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
            <XAxis
              type="number"
              dataKey="bucket_mid"
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={CalibrationTooltip} />
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
              stroke="rgba(161,161,170,0.5)"
              strokeDasharray="4 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
            <Line
              type="monotone"
              dataKey="actual_rate"
              stroke="currentColor"
              strokeWidth={2}
              dot={{ r: 3, fill: 'currentColor' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Insufficient sample (n&lt;5) for {positionLabel(position)} this window.
            </p>
          </div>
        )}
      </div>

      {/* Phase 91 CAL-01: xPts-mean calibration chart (UI-SPEC §Chart Specification) */}
      <div className="mt-12">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Predicted vs Actual xPts
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
          Predicted xPts decile mean vs actual points mean. A well-calibrated model traces
          the diagonal — points above mean over-prediction, points below mean under-prediction.
        </p>
        <div className="flex gap-4 text-xs text-zinc-600 dark:text-zinc-400 mb-2">
          <span className="flex items-center gap-1">
            <span
              aria-hidden="true"
              style={{ display: 'inline-block', width: 12, height: 2, background: 'currentColor' }}
            />
            Actual mean pts
          </span>
          <span className="flex items-center gap-1">
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 12,
                height: 0,
                borderTop: '1px dashed rgba(161,161,170,0.7)',
              }}
            />
            Perfect calibration (y=x)
          </span>
        </div>
        <div
          data-testid="calibration-xpts-chart"
          className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative"
        >
          <ResponsiveContainer width="100%" height={288}>
            <ComposedChart data={xptsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
              <XAxis
                type="number"
                dataKey="predicted_mean"
                tickFormatter={(v: number) => v.toFixed(1)}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                tickFormatter={(v: number) => v.toFixed(1)}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={XptsTooltip} />
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: maxPredictedMean, y: maxPredictedMean },
                ]}
                stroke="rgba(161,161,170,0.5)"
                strokeDasharray="4 4"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
              <Line
                type="monotone"
                dataKey="actual_mean"
                stroke="currentColor"
                strokeWidth={2}
                dot={{ r: 3, fill: 'currentColor' }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          {xptsData.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Insufficient sample (n&lt;5) for {positionLabel(position)} this window.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type GwSortKey = 'gw' | 'haulter_count' | 'xpts_flagged' | 'xpts_hit_rate'

function GwSummaryTable({ data }: { data: AccuracyBacktest }) {
  const [sortKey, setSortKey] = useState<GwSortKey>('gw')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Phase 76 ACC2-01: single-expand drill-down state. expandedGw === r.gw means the row is expanded.
  const [expandedGw, setExpandedGw] = useState<number | null>(null)

  const rows = useMemo(() => {
    const copy = [...data.summary.gws]
    copy.sort((a, b) => {
      const cmp = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [data.summary.gws, sortKey, sortDir])

  function handleSort(key: GwSortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function shCls(key: GwSortKey) {
    const active = sortKey === key
    return `text-left font-semibold pb-1 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`
  }

  function arrow(key: GwSortKey) {
    if (sortKey !== key) return null
    return <span className="ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // WR-02: hoist flagged-misses computation out of rows.map() to avoid O(rows × players × gws)
  // on every sort-triggered re-render. Keyed on data.players — stable reference between sorts.
  const flaggedMissesByGw = useMemo(() => {
    const map = new Map<number, { player_id: number; player_name: string; team: string; actual_pts: number; xpts_predicted: number }[]>()
    for (const p of data.players) {
      for (const g of p.gws) {
        if (g.xpts_flagged === true && g.actual_pts <= 2) {
          const entry = map.get(g.gw) ?? []
          entry.push({ player_id: p.player_id, player_name: p.player_name, team: p.team,
                       actual_pts: g.actual_pts, xpts_predicted: g.xpts_predicted })
          map.set(g.gw, entry)
        }
      }
    }
    map.forEach(list => list.sort((a, b) => b.xpts_predicted - a.xpts_predicted))
    return map
  }, [data.players])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">GW Accuracy Summary</h2>
      <div className="overflow-x-auto">
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={shCls('gw')} onClick={() => handleSort('gw')}>GW{arrow('gw')}</th>
            <th scope="col" className={shCls('haulter_count')} onClick={() => handleSort('haulter_count')}>Haulers{arrow('haulter_count')}</th>
            <th scope="col" className={shCls('xpts_flagged')} onClick={() => handleSort('xpts_flagged')}>xPts Flagged{arrow('xpts_flagged')}</th>
            <th scope="col" className={shCls('xpts_hit_rate')} onClick={() => handleSort('xpts_hit_rate')}>xPts Hit Rate{arrow('xpts_hit_rate')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isExpanded = expandedGw === r.gw
            const gwHaulters = data.haulters
              .filter(h => h.gw === r.gw)
              .sort((a, b) => b.xpts_predicted - a.xpts_predicted)
            // Flagged Misses MUST source from data.players[].gws[] — data.haulters only carries
            // actual_pts >= 10 entries (HAULTER_THRESHOLD = 10 in pipeline/accuracy.py:27), so a
            // haulters-based filter for actual_pts <= 2 is always [] (mutually exclusive predicates).
            // WR-02: lookup from flaggedMissesByGw memo (computed once per data.players change).
            const gwFlaggedMisses = flaggedMissesByGw.get(r.gw) ?? []
            return (
              <Fragment key={r.gw}>
                <tr
                  className={`${TR_CLS} cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700`}
                  onClick={() => setExpandedGw(isExpanded ? null : r.gw)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedGw(isExpanded ? null : r.gw)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                  aria-controls={`gw-drilldown-${r.gw}`}
                  aria-label={isExpanded ? `Hide drill-down for GW${r.gw}` : `Show drill-down for GW${r.gw}`}
                  data-testid={`gw-row-${r.gw}`}
                >
                  <td className={TD_CLS}>
                    GW{r.gw}
                    <span className="ml-2 text-zinc-400 dark:text-zinc-500" aria-hidden="true">
                      {isExpanded ? '▴' : '▾'}
                    </span>
                  </td>
                  <td className={TD_CLS}>{r.haulter_count}</td>
                  <td className={TD_CLS}>{r.xpts_flagged}</td>
                  <td className={TD_CLS}><HitRateBadge rate={r.xpts_hit_rate} /></td>
                </tr>
                {isExpanded && (
                  <tr id={`gw-drilldown-${r.gw}`} data-testid={`gw-drilldown-${r.gw}`}>
                    <td colSpan={4} className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                        {/* Haulers sub-panel */}
                        <div>
                          <h3 className="text-sm font-semibold mb-1">Haulers (≥10 pts)</h3>
                          {gwHaulters.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">No haulers this GW.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-left pb-1 border-b border-zinc-200 dark:border-zinc-700 font-semibold">Player</th>
                                  <th className="text-right pb-1 border-b border-zinc-200 dark:border-zinc-700 font-semibold">Actual</th>
                                  <th className="text-right pb-1 border-b border-zinc-200 dark:border-zinc-700 font-semibold">Predicted</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gwHaulters.map(h => (
                                  <tr key={`${r.gw}-h-${h.player_id}`}>
                                    <td className="px-2 py-1 text-sm">{h.player_name}</td>
                                    <td className="px-2 py-1 text-sm text-right tabular-nums">{h.actual_pts}</td>
                                    <td className="px-2 py-1 text-sm text-right tabular-nums">{h.xpts_predicted.toFixed(1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                        {/* Flagged Misses sub-panel */}
                        <div>
                          <h3 className="text-sm font-semibold mb-1">xPts Flagged Misses</h3>
                          {gwFlaggedMisses.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">No flagged misses this GW — predictions held.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-left pb-1 border-b border-zinc-200 dark:border-zinc-700 font-semibold">Player</th>
                                  <th className="text-right pb-1 border-b border-zinc-200 dark:border-zinc-700 font-semibold">Actual</th>
                                  <th className="text-right pb-1 border-b border-zinc-200 dark:border-zinc-700 font-semibold">Predicted</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gwFlaggedMisses.map(h => (
                                  <tr key={`${r.gw}-m-${h.player_id}`}>
                                    <td className="px-2 py-1 text-sm">{h.player_name}</td>
                                    <td className="px-2 py-1 text-sm text-right tabular-nums">{h.actual_pts}</td>
                                    <td className="px-2 py-1 text-sm text-right tabular-nums">{h.xpts_predicted.toFixed(1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          <tr className="font-semibold bg-zinc-50 dark:bg-zinc-800">
            <td className={TD_CLS}>Overall</td>
            <td className={TD_CLS}>—</td>
            <td className={TD_CLS}>—</td>
            <td className={TD_CLS}><HitRateBadge rate={data.summary.xpts_hit_rate} /></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  )
}

type HaulterSortKey = 'player_name' | 'gw' | 'actual_pts' | 'xpts_predicted' | 'xpts_rank'

function HaulterList({ data }: { data: AccuracyBacktest }) {
  const [sortKey, setSortKey] = useState<HaulterSortKey>('gw')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const copy = [...data.haulters]
    copy.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [data.haulters, sortKey, sortDir])

  function handleSort(key: HaulterSortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'gw' ? 'desc' : 'asc') }
  }

  function shCls(key: HaulterSortKey) {
    const active = sortKey === key
    return `text-left font-semibold pb-1 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`
  }

  function arrow(key: HaulterSortKey) {
    if (sortKey !== key) return null
    return <span className="ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">All Haulers (GW Backtest)</h2>
      <div className="overflow-x-auto">
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={shCls('player_name')} onClick={() => handleSort('player_name')}>Player{arrow('player_name')}</th>
            <th scope="col" className={shCls('gw')} onClick={() => handleSort('gw')}>GW{arrow('gw')}</th>
            <th scope="col" className={shCls('actual_pts')} onClick={() => handleSort('actual_pts')}>Actual Pts{arrow('actual_pts')}</th>
            <th scope="col" className={shCls('xpts_predicted')} onClick={() => handleSort('xpts_predicted')}>xPts Pred{arrow('xpts_predicted')}</th>
            <th scope="col" className={shCls('xpts_rank')} title="Lower rank = higher xPts prediction" onClick={() => handleSort('xpts_rank')}>xPts Rank{arrow('xpts_rank')}</th>
            <th scope="col" className={TH_CLS} title="Model predicted this player would score 10+ points in this GW">xPts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h: AccuracyHaulter) => (
            <tr key={`${h.gw}-${h.player_id}`} className={TR_CLS}>
              <td className={TD_CLS}>{h.player_name}</td>
              <td className={TD_CLS}>GW{h.gw}</td>
              <td className={TD_CLS}>{h.actual_pts}</td>
              <td className={TD_CLS}>{h.xpts_predicted.toFixed(1)}</td>
              <td className={TD_CLS}>{h.xpts_rank}</td>
              <td className={TD_CLS}><FlaggedCell flagged={h.xpts_flagged} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

type DeltaRow = {
  player_name: string
  team: string
  gw: number
  actual_pts: number
  xpts_predicted: number
  xpts_delta: number
}

type SortKey = 'player_name' | 'gw' | 'actual_pts' | 'xpts_predicted' | 'xpts_delta'
type SortDir = 'asc' | 'desc'

function PlayerDeltaTable({ data }: { data: AccuracyBacktest }) {
  const [sortKey, setSortKey] = useState<SortKey>('xpts_delta')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const flat = useMemo<DeltaRow[]>(() => {
    const out: DeltaRow[] = []
    for (const p of data.players) {
      for (const g of p.gws) {
        out.push({
          player_name: p.player_name,
          team: p.team,
          gw: g.gw,
          actual_pts: g.actual_pts,
          xpts_predicted: g.xpts_predicted,
          xpts_delta: g.xpts_delta,
        })
      }
    }
    return out
  }, [data.players])

  const sorted = useMemo(() => {
    const copy = [...flat]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [flat, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function sortableHeaderCls(key: SortKey) {
    const active = sortKey === key
    const colour = active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
    return `text-left font-semibold pb-1 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer ${colour}`
  }

  function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Player Prediction Errors</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
        Sorted by biggest xPts over-prediction (most negative delta first). Click any column header to re-sort.
      </p>
      <div className="overflow-x-auto">
      <table className={TABLE_CLS}>
        <thead>
          <tr>
            <th scope="col" className={sortableHeaderCls('player_name')} aria-sort={ariaSort('player_name')} onClick={() => handleSort('player_name')}>Player</th>
            <th scope="col" className={TH_CLS} aria-sort="none">Team</th>
            <th scope="col" className={sortableHeaderCls('gw')} aria-sort={ariaSort('gw')} onClick={() => handleSort('gw')}>GW</th>
            <th scope="col" className={sortableHeaderCls('actual_pts')} aria-sort={ariaSort('actual_pts')} onClick={() => handleSort('actual_pts')}>Actual Pts</th>
            <th scope="col" className={sortableHeaderCls('xpts_predicted')} aria-sort={ariaSort('xpts_predicted')} onClick={() => handleSort('xpts_predicted')}>xPts Pred</th>
            <th scope="col" className={sortableHeaderCls('xpts_delta')} aria-sort={ariaSort('xpts_delta')} onClick={() => handleSort('xpts_delta')}>xPts Δ</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.player_name}-${r.gw}-${i}`} className={TR_CLS}>
              <td className={TD_CLS}>{r.player_name}</td>
              <td className={TD_CLS}>{r.team}</td>
              <td className={TD_CLS}>GW{r.gw}</td>
              <td className={TD_CLS}>{r.actual_pts}</td>
              <td className={TD_CLS}>{r.xpts_predicted.toFixed(1)}</td>
              <td className={TD_CLS}><DeltaCell delta={r.xpts_delta} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ============================================================================
// Phase 82 DH-02: Data Health Panel
// ============================================================================

function DataHealthPanel() {
  const { data, isLoading, error } = useDataHealth()
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  // NOTE: NO useEffect on `data` resetting isExpanded — Pitfall 6.
  // The 60s refetchInterval re-renders this component but state is preserved.

  let pillText: string
  let pillCls: string
  let canExpand: boolean

  if (isLoading && !data) {
    pillText = 'Loading…'
    pillCls = TIER_CLASSES.LOW
    canExpand = false
  } else if (error || !data) {
    pillText = 'Unavailable'
    pillCls = RED_PILL_CLS
    canExpand = false
  } else {
    // WR-03: guard against malformed API response where sanity_checks is not an array.
    const overall = Array.isArray(data.sanity_checks)
      ? rollUpStatus(data.sanity_checks)
      : 'error'
    if (overall === 'error') { pillText = 'Errors';   pillCls = RED_PILL_CLS }
    else if (overall === 'warn')  { pillText = 'Warnings'; pillCls = TIER_CLASSES.MEDIUM }
    else                          { pillText = 'All OK';   pillCls = TIER_CLASSES.HIGH }
    canExpand = true
  }

  return (
    <div data-testid="data-health-panel">
      <button
        type="button"
        aria-expanded={canExpand ? isExpanded : false}
        aria-disabled={!canExpand}
        disabled={!canExpand}
        onClick={() => setIsExpanded(e => !e)}
        className="flex items-center gap-2 w-full text-left min-h-[44px]"
      >
        <h2 className="text-lg font-semibold">Data Health</h2>
        <span className={`inline-block text-xs rounded px-2 py-0.5 ${pillCls}`}>
          {pillText}
        </span>
        {canExpand && (
          <span aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
        )}
      </button>

      {isExpanded && data && (
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              <th scope="col" className={TH_CLS}>Check</th>
              <th scope="col" className={TH_CLS}>Status</th>
              <th scope="col" className={TH_CLS}>Value</th>
              <th scope="col" className={TH_CLS}>Threshold</th>
            </tr>
          </thead>
          <tbody>
            {(data.sanity_checks ?? []).map(check => (
              <tr key={check.id} className={TR_CLS}>
                <td className={TD_CLS}>{SANITY_CHECK_LABELS[check.id]}</td>
                <td className={TD_CLS}><SanityIcon status={check.status} /></td>
                <td className={TD_CLS}>{formatSanityValue(check)}</td>
                <td className={TD_CLS}>{check.threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function AccuracyTab() {
  const { data, isLoading, error } = useAccuracy()

  // DH-02 D-10/D-11: panel always renders, regardless of useAccuracy state.
  const panel = <DataHealthPanel />

  if (isLoading) {
    return (
      <section className="mt-6 space-y-8" aria-label="Projection accuracy">
        {panel}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
          Loading accuracy data…
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="mt-6 space-y-8" aria-label="Projection accuracy">
        {panel}
        <p className="text-sm text-red-600 dark:text-red-400 py-4">
          Failed to load accuracy data. Run the pipeline and refresh.
        </p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="mt-6 space-y-8" aria-label="Projection accuracy">
        {panel}
        <h2 className="text-lg font-semibold">No accuracy data yet</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run the pipeline to generate backtest data.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-8" aria-label="Projection accuracy">
      {panel}
      {data.versions && data.versions.length >= 1 && <VersionHistoryTable data={data} />}
      {data.calibration && <CalibrationSection data={data} />}
      <GwSummaryTable data={data} />
      <HaulterList data={data} />
      <PlayerDeltaTable data={data} />
    </section>
  )
}
