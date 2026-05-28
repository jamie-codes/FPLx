'use client'

import { useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer, MinsRisk } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { MinsRiskBadge } from '@/components/shared/MinsRiskBadge'
import { VarianceBadge } from '@/components/gem-table/VarianceBadge'
import { RegressionSignalBadge } from '@/components/gem-table/RegressionSignalBadge'
import { DifferentialBadge } from '@/components/gem-table/DifferentialBadge'
import { TeamBadge } from '@/components/shared/TeamBadge'
import { MCDistributionBar } from '@/components/mc/MCDistributionBar'
import { computeRouteFlags } from '@/lib/routes'
import { RoutePillsCell } from '@/components/gem-table/RoutePillsCell'
import { BonusEvCell } from '@/components/gem-table/BonusEvCell'

const col = createColumnHelper<ScoredPlayer>()

// Position code to label map
const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// Format score as 0-100 integer for display
export const fmtScore = (v: number) => (v * 100).toFixed(0)
export const fmtScoreNull = (v: number | null) => (v === null ? '\u2014' : (v * 100).toFixed(0))
const fmtDec2 = (v: number | null) => (v === null ? '\u2014' : v.toFixed(2))

// Column header with hover tooltip
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>

// Phase 48 XPT-01 / XPT-02 — xPts cell renderer with CSS-only hover card breakdown.
// Replaces native title tooltip per D-03. 'use client' required for useState mobile toggle.
export function XPtsCell({
  value,
  ceiling,
  components,
  elementType,
  minsRisk,
  mins60Prob,
  window,
  blankProb,
  haulProb,
  p10Pts,
  p90Pts,
}: {
  value: number | undefined
  ceiling: boolean | undefined
  components: {
    goal_pts: number
    assist_pts: number
    cs_pts: number
    bonus_pts: number
    appearance_pts: number
    save_pts?: number    // Phase 83 GK-02 — GK save-point EV; present and >0 only for GKs when gate ON
  } | undefined
  elementType?: number   // Phase 83 GK-02 / D-07 — defense-in-depth render guard (1=GK)
  minsRisk?: MinsRisk
  mins60Prob?: number
  window: 1 | 3 | 5
  // Phase 61 MC-02 (D-13): MC simulation outputs from pipeline/simulate.py.
  // Optional — present only on 1GW window after Phase 61 pipeline ships.
  blankProb?: number
  haulProb?: number
  p10Pts?: number
  p90Pts?: number
}) {
  const [open, setOpen] = useState(false)
  const display = Number.isFinite(value ?? 0) ? (value ?? 0).toFixed(1) : '0.0'

  // Empty/zero/negative/NaN short-circuit: no badge, no hover card (BGW = D-06).
  // Explicit guards handle NaN and negative values that could arrive during a
  // partial pipeline failure or BGW cache serve (WR-03: tighten falsy check).
  if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) {
    return <span>{display}</span>
  }

  // Breakdown hover card ships only for the 1 GW window (xPts_components_1gw only).
  // For 3GW/5GW, even if components are passed we suppress the card to keep the contract clear.
  const showBreakdown = window === 1 && components !== undefined && components !== null

  if (!showBreakdown) {
    return (
      <span>
        {display}
        <VarianceBadge ceiling={ceiling} />
      </span>
    )
  }

  const c = components!
  // Total computed from components — NOT from xPts_1gw. Satisfies XPT-02 sum invariant.
  // Phase 83 GK-02 / D-06 / D-08: cardTotal includes save_pts so the displayed Total
  // matches xPts_1gw within 0.015 (Vitest invariant in XPtsCell-saves.test.tsx).
  const cardTotal = (
    c.appearance_pts + c.goal_pts + c.assist_pts + c.cs_pts + c.bonus_pts + (c.save_pts ?? 0)
  ).toFixed(2)

  // Phase 61 MC-02 (D-13): show MC stats only when window===1 and all 4 MC props defined
  const showMC = window === 1
    && blankProb !== undefined
    && haulProb !== undefined
    && p10Pts !== undefined
    && p90Pts !== undefined

  // Phase 83 GK-02 / D-07: insert "Saves" row AFTER "Clean sheet" and BEFORE "Bonus"
  // ONLY for GKs (elementType===1) when save_pts is present and > 0. BGW GKs have
  // save_pts=0.0 -> row suppressed by the > 0 guard. Non-GKs blocked by elementType===1.
  const rows: [string, string][] = [
    ['Appearance', c.appearance_pts.toFixed(2)],
    ['Goals',      c.goal_pts.toFixed(2)],
    ['Assists',    c.assist_pts.toFixed(2)],
    ['Clean sheet', c.cs_pts.toFixed(2)],
    ...(c.save_pts !== undefined && c.save_pts > 0 && elementType === 1
      ? [['Saves', c.save_pts.toFixed(2)] as [string, string]]
      : []),
    ['Bonus',      c.bonus_pts.toFixed(2)],
  ]

  return (
    <div
      className="relative group/xpts inline-block cursor-help"
      onClick={() => setOpen(o => !o)}
    >
      <span>
        {display}
        <VarianceBadge ceiling={ceiling} />
      </span>
      {/* Hover card: visible on desktop hover (CSS) or mobile tap (state). z-50 clears sticky web_name z-10. */}
      <div
        className={[
          'absolute bottom-full left-0 mb-1 w-44 z-50',
          'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
          'rounded shadow-lg p-2 text-xs',
          'invisible opacity-0 group-hover/xpts:visible group-hover/xpts:opacity-100',
          'transition-opacity',
          open ? 'visible opacity-100' : '',
        ].join(' ')}
      >
        {rows.map(([label, val]) => (
          <div key={label} className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
            <span className="font-mono">{val}</span>
          </div>
        ))}
        <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
        {showMC && (
          <>
            <MCDistributionBar
              blankProb={blankProb!}
              haulProb={haulProb!}
              p10Pts={p10Pts!}
              p90Pts={p90Pts!}
            />
            <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
          </>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="font-mono">{cardTotal}</span>
        </div>
        <div className="mt-1">
          <MinsRiskBadge minsRisk={minsRisk} mins60Prob={mins60Prob} />
        </div>
      </div>
    </div>
  )
}

export function createColumns(
  onCompare: (player: ScoredPlayer) => void,
  gwN: number | null = null,
  newsFlagEnabled: boolean = false,
  allPlayers: ScoredPlayer[] = [],
) {
  const routeFlagsMap = computeRouteFlags(allPlayers)
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
  col.accessor('team_short_name', {
    header: 'Team',
    enableSorting: false,
    cell: (info) => (
      <div className="flex items-center gap-1.5">
        <TeamBadge shortName={info.getValue()} size={16} />
        <span>{info.getValue()}</span>
      </div>
    ),
  }),
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
    cell: (info) => {
      const s = info.getValue()
      if (s === 'a') return null
      const cfg: Record<string, { label: string; cls: string }> = {
        d: { label: 'D', cls: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200' },
        i: { label: 'I', cls: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' },
        s: { label: 'S', cls: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' },
        u: { label: 'U', cls: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' },
        n: { label: 'N', cls: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' },
      }
      const c = cfg[s] ?? { label: s.toUpperCase(), cls: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' }
      // Phase 88 SCRAPER-01: title= when news non-empty AND gate enabled (D-05)
      const news = (info.row.original as ScoredPlayer).news
      const titleAttr = (newsFlagEnabled && news && news.trim().length > 0) ? news : undefined
      return <span className={`inline-block text-xs font-normal rounded px-2 py-1 ${c.cls}`} title={titleAttr}>{c.label}</span>
    },
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
        elementType={info.row.original.element_type}
        minsRisk={info.row.original.mins_risk}
        mins60Prob={info.row.original.mins_60_prob}
        window={1}
        blankProb={info.row.original.blank_prob}
        haulProb={info.row.original.haul_prob}
        p10Pts={info.row.original.p10_pts}
        p90Pts={info.row.original.p90_pts}
      />
    ),
    enableSorting: true,
  }),
  col.accessor('last_gw_actual_pts', {
    header: () => (
      <span title={`Actual FPL points scored in GW${gwN ?? '?'} — from backtest data`} className="cursor-help">
        {gwN ? `GW${gwN} Pts` : 'GW Pts'}
      </span>
    ),
    cell: (info) => {
      const v = info.getValue()
      return v === null || v === undefined
        ? <span className="text-zinc-400">{'—'}</span>
        : Math.round(v).toString()
    },
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
  // Phase 114 SPARK-01: rank_trajectory sparkline micro-column (inline SVG polyline, no Recharts).
  // Values: 0.0 = best rank (top of position), 1.0 = worst rank; length always 5 when present.
  // Green stroke = rank improving (trend < -0.05), red = declining (trend > +0.05), zinc-400 = flat.
  col.accessor('rank_trajectory', {
    header: H('Trend', 'Rank trajectory over last 5 gameweeks. Green = rank improving (lower percentile). Red = rank declining.'),
    enableSorting: false,
    cell: (info) => {
      const trajectory = info.getValue()
      if (!trajectory || trajectory.length < 2) return <span className="text-zinc-400">—</span>
      const trend = trajectory[trajectory.length - 1] - trajectory[0]
      const stroke = trend < -0.05 ? 'var(--color-positive)' : trend > 0.05 ? 'var(--color-negative)' : '#a1a1aa'
      const pointsStr = trajectory.map((v, i) => `${2 + i * 9},${(1 + v * 18).toFixed(1)}`).join(' ')
      return (
        <svg width="40" height="20" viewBox="0 0 40 20" aria-hidden="true">
          <polyline points={pointsStr} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
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
  // Phase 47 CS-01 / CS-03 (D-08): Clean sheet probability for the next fixture.
  // GK (element_type=1) and DEF (element_type=2) show the percentage.
  // MID (element_type=3) and FWD (element_type=4) show em-dash (this metric is not
  // attacking-relevant). BGW players (cs_prob_1gw === 0) show "0%" — that is the
  // correct meaningful value, not an absence of data, per UI-SPEC.
  col.accessor('cs_prob_1gw', {
    header: H('CS%', 'Clean sheet probability for next fixture, derived from rolling xGA. DGW players show combined CS%: 1-(1-p1)(1-p2).'),
    cell: (info) => {
      const position = info.row.original.element_type
      // GK (1) and DEF (2) get a percentage; MID (3) and FWD (4) get em-dash.
      if (position === 1 || position === 2) {
        const csProb = info.getValue()
        if (csProb === null || csProb === undefined) {
          return <span className="text-zinc-400">—</span>
        }
        // 0% is meaningful (BGW or zero xmins) — render explicitly, not as em-dash.
        return `${(csProb * 100).toFixed(0)}%`
      }
      return <span className="text-zinc-400">—</span>
    },
    enableSorting: true,
  }),
  // Phase 76 RTP-02 / ROUTES-01: Routes to points — pill display.
  // Player not found in routeFlagsMap (stale cache or allPlayers=[]) → em-dash via guard below.
  // All-false flags → RoutePillsCell renders its own em-dash fallback.
  col.accessor('routes_to_points', {
    header: H('Routes', 'Point-scoring routes: PK = penalty taker, FK = direct FK taker, CK = corner taker, xG = above-median xG in team, xA = above-median xA in team.'),
    cell: (info) => {
      const flags = routeFlagsMap.get(info.row.original.id)
      if (!flags) return <span className="text-zinc-400">—</span>
      return <RoutePillsCell flags={flags} />
    },
    enableSorting: true,
  }),
  // Phase 53 BPS-01: per-player bonus EV.
  // Muted (text-zinc-500) for flat_default players — position prior only, insufficient data.
  col.accessor('bonus_ev', {
    header: H('Bonus EV', 'Expected bonus points per game start. Shrinkage-estimated from recent history — muted values use the position prior (insufficient data).'),
    cell: (info) => (
      <BonusEvCell
        value={info.getValue()}
        source={info.row.original.bonus_source}
      />
    ),
    enableSorting: true,
  }),
  // Phase FLOOR-01: Historical consistency rate.
  // Colour bands: >=70% emerald (reliable), 40-69% zinc-100 (average), <40% zinc-500 (unreliable).
  col.accessor('cons_rate', {
    header: H('Cons%', 'Consistency rate: % of last 10 starts returning ≥ position threshold (GK/DEF ≥ 6 pts, MID/FWD ≥ 5 pts). Blank = fewer than 4 starts on record.'),
    cell: (info) => {
      const v = info.getValue()
      if (v == null) return <span className="text-zinc-400">—</span>
      const pct = Math.round(v * 100)
      const cls = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-zinc-100' : 'text-zinc-500'
      return <span className={cls}>{pct}%</span>
    },
    enableSorting: true,
  }),
  // Phase FLOOR-01: Simulated points floor (10th-percentile MC outcome).
  // p10_pts already exists in player dict from Phase 102 simulate.py — surfaced here as a
  // dedicated sortable column. No colour coding — raw number is self-interpreting.
  col.accessor('p10_pts', {
    header: H('Floor', 'Simulated points floor: 10th-percentile outcome from 10,000 season simulations. Low floor = boom-or-bust; high floor = reliable scorer.'),
    cell: (info) => {
      const v = info.getValue()
      if (v == null) return <span className="text-zinc-400">—</span>
      return <span className="text-zinc-100">{v.toFixed(1)}</span>
    },
    enableSorting: true,
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
