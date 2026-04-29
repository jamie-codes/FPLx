import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'

const col = createColumnHelper<ScoredPlayer>()

// Position code to label map
const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// Format score as 0-100 integer for display
export const fmtScore = (v: number) => (v * 100).toFixed(0)
export const fmtScoreNull = (v: number | null) => (v === null ? '\u2014' : (v * 100).toFixed(0))
const fmtDec2 = (v: number | null) => (v === null ? '\u2014' : v.toFixed(2))

// Column header with hover tooltip
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>

// Phase 28 XPTS-01 / XPTS-02 — xPts cell renderer with variance badge + breakdown tooltip.
export function XPtsCell({
  value,
  ceiling,
  components,
  window,
}: {
  value: number | undefined
  ceiling: boolean | undefined
  components: { goal_pts: number; assist_pts: number; cs_pts: number; bonus_pts: number } | undefined
  window: 1 | 3 | 5
}) {
  const display = (value ?? 0).toFixed(1)

  // Empty/zero/negative/NaN short-circuit: no badge, no tooltip.
  // Explicit guards handle NaN and negative values that could arrive during a
  // partial pipeline failure or BGW cache serve (WR-03: tighten falsy check).
  if (value === undefined || value === null || value <= 0) {
    return <span>{display}</span>
  }

  // Breakdown tooltip ships only for the 1 GW window per CONTEXT.md (xPts_components_1gw only).
  // For 3GW/5GW, even if components are passed we suppress the tooltip to keep the contract clear.
  const showBreakdown = window === 1 && components !== undefined && components !== null
  const tip = showBreakdown
    ? `xPts breakdown (${window} GW):\nGoals: ${components!.goal_pts.toFixed(2)}\nAssists: ${components!.assist_pts.toFixed(2)}\nClean sheet: ${components!.cs_pts.toFixed(2)}\nBonus: ${components!.bonus_pts.toFixed(2)}`
    : undefined

  return (
    <span title={tip} className={tip ? 'cursor-help' : undefined}>
      {display}
      <VarianceBadge ceiling={ceiling} />
    </span>
  )
}

export function createColumns(onCompare: (player: ScoredPlayer) => void) {
  return [
    col.accessor('web_name', {
      header: 'Player',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="relative group/name flex items-center gap-1">
          <span>{row.original.web_name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCompare(row.original) }}
            className="opacity-0 group-hover/name:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1 text-xs cursor-pointer hidden sm:inline"
            aria-label={`Compare ${row.original.web_name}`}
          >
            ⊞
          </button>
        </div>
      ),
    }),
  col.accessor('team_short_name', { header: 'Team', enableSorting: false }),
  col.accessor('element_type', {
    header: H('Pos', 'Position: GK / DEF / MID / FWD'),
    filterFn: 'equals',
    enableSorting: false,
    cell: (info) => POS_LABEL[info.getValue()] ?? '?',
  }),
  col.accessor('now_cost', {
    header: H('Price', 'Current FPL price (£m)'),
    cell: (info) => `${(info.getValue() / 10).toFixed(1)}`,
  }),
  col.accessor('gem_score', {
    header: H('Gem', 'Composite Gem score (0–100): weighted blend of FDR, form, xG/90, xA/90, differential ownership, minutes reliability, and set-piece role'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('fdr_score', {
    header: H('FDR', 'Fixture Difficulty Rating score (0–100): higher = easier upcoming fixtures'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('form_score', {
    header: H('Form', 'Form score (0–100): normalised points-per-90 over the last 5 gameweeks'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('xg_per90', {
    header: H('xG/90', 'Expected goals per 90 minutes (Understat). Blank = no Understat data (promoted-team or new players)'),
    cell: (info) => fmtDec2(info.getValue()),
  }),
  col.accessor('xa_per90', {
    header: H('xA/90', 'Expected assists per 90 minutes (Understat). Blank = no Understat data (promoted-team or new players)'),
    cell: (info) => fmtDec2(info.getValue()),
  }),
  col.accessor('xg_score', {
    header: H('xG Sc', 'xG score (0–100): normalised xG/90 relative to all players. Blank = no Understat data'),
    cell: (info) => fmtScoreNull(info.getValue()),
  }),
  col.accessor('xa_score', {
    header: H('xA Sc', 'xA score (0–100): normalised xA/90 relative to all players. Blank = no Understat data'),
    cell: (info) => fmtScoreNull(info.getValue()),
  }),
  col.accessor('ownership_score', {
    header: H('Own', 'Differential score (0–100): higher = less owned = more differential value'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('minutes_score', {
    header: H('Min', 'Minutes reliability score (0–100): based on expected minutes per GW'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('set_piece_score', {
    header: H('SP', 'Set piece score (0–100): accounts for penalty, free-kick, and corner taker roles'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('selected_by_percent', {
    header: H('Own%', 'FPL ownership percentage — how many managers own this player'),
  }),
  col.accessor('status', {
    header: H('Status', 'Player availability: blank = available, D = doubtful, I = injured, S = suspended, N = unavailable'),
    enableSorting: false,
    cell: (info) => info.getValue() === 'a' ? '' : info.getValue().toUpperCase(),
  }),
  col.display({
    id: 'mins_risk',
    header: H('Risk', 'Minutes risk: Nailed (>85% start prob) · Likely (65–85%) · Rotation (40–65%) · Bench risk (<40%)'),
    enableSorting: false,
    cell: ({ row }) => <MinsRiskBadge minsRisk={row.original.mins_risk} />,
  }),
  col.accessor('xPts_1gw', {
    header: H('xPts', 'Expected FPL points next gameweek (Poisson goals/assists, Bernoulli CS/minutes; FDR++ adjusted). Blank GW or no fixture = 0.'),
    cell: (info) => (
      <XPtsCell
        value={info.getValue()}
        ceiling={info.row.original.xPts_ceiling_1gw}
        components={info.row.original.xPts_components_1gw ?? undefined}
        window={1}
      />
    ),
    enableSorting: true,
  }),
  col.accessor('xPts_3gw', {
    header: H('xPts (3)', 'Expected FPL points across next 3 gameweeks (DGW-aware sum, FDR++ adjusted).'),
    cell: (info) => (
      <XPtsCell
        value={info.getValue()}
        ceiling={info.row.original.xPts_ceiling_3gw}
        components={undefined}
        window={3}
      />
    ),
    enableSorting: true,
  }),
  col.accessor('xPts_5gw', {
    header: H('xPts (5)', 'Expected FPL points across next 5 gameweeks (DGW-aware sum, FDR++ adjusted).'),
    cell: (info) => (
      <XPtsCell
        value={info.getValue()}
        ceiling={info.row.original.xPts_ceiling_5gw}
        components={undefined}
        window={5}
      />
    ),
    enableSorting: true,
  }),
  col.accessor('regression_signal', {
    header: H('Signal', 'Regression signal: BUY = underperforming xG+xA over last 5 GW; SELL = overperforming. Min 900 min played. Sort ascending for buy candidates.'),
    cell: (info) => (
      <RegressionSignalBadge
        signal={info.getValue()}
        delta={info.row.original.actual_vs_xg_delta}
      />
    ),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const order: Record<string, number> = { sell: 2, buy: 0 }
      const a = order[rowA.original.regression_signal ?? ''] ?? 1
      const b = order[rowB.original.regression_signal ?? ''] ?? 1
      return a - b
    },
  }),
  col.accessor('differential_flag', {
    header: H('Diff', 'Differential flag: DIFF = low-owned (<5%), above-average xPts for position — rank gain potential. TRAP = high-owned (>15%), below-average xPts — consider selling. Sort ascending for differentials first.'),
    cell: (info) => (
      <DifferentialBadge
        flag={info.getValue()}
        ownership={parseFloat(info.row.original.selected_by_percent ?? '0')}
      />
    ),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const order: Record<string, number> = { diff: 0, trap: 2 }
      const a = order[rowA.original.differential_flag ?? ''] ?? 1
      const b = order[rowB.original.differential_flag ?? ''] ?? 1
      return a - b
    },
  }),
  col.display({
    id: 'trend',
    header: H('Trend', 'Price trend: this GW change (↑/↓) and season-to-date change'),
    cell: ({ row }) => {
      const ev = row.original.cost_change_event ?? 0
      const st = row.original.cost_change_start ?? 0
      const seasonAmt = (Math.abs(st) / 10).toFixed(1)
      const seasonSign = st > 0 ? '+' : st < 0 ? '-' : ''
      const seasonText = st !== 0 ? `${seasonSign}${seasonAmt}m season` : ''

      if (ev > 0) return (
        <div>
          <span className="text-green-600">↑ {(ev / 10).toFixed(1)}m</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
      if (ev < 0) return (
        <div>
          <span className="text-red-600">↓ {(Math.abs(ev) / 10).toFixed(1)}m</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
      return (
        <div>
          <span className="text-zinc-400">—</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
    },
  }),
  col.display({
    id: 'fixtures',
    header: 'Next 5',
    cell: ({ row }) => <FixtureBadges fixtures={row.original.fixtures.slice(0, 5)} />,
    enableSorting: false,
  }),
  ]
}

// Backwards-compat: any code importing { columns } gets a no-op onCompare wrapper.
// GemTable.tsx switches to createColumns in Plan 03 Task 2; this shim covers stragglers and old tests.
export const columns = createColumns(() => {})
