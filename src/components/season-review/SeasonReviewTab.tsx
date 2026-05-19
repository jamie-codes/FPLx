'use client'

// Phase 124 REV-01/REV-02/REV-03/REV-04: Season Review Tab component.
// Renders the Season Summary card, Decision Quality grade card, and Season Points chart.
//
// Sources of truth:
//   .planning/phases/124-season-review/124-CONTEXT.md §D-01..D-08
//   .planning/phases/124-season-review/124-UI-SPEC.md (Component Inventory + Copywriting Contract)
//   .planning/phases/124-season-review/124-PATTERNS.md §SeasonReviewTab.tsx
//   .planning/phases/124-season-review/124-RESEARCH.md Pitfalls 2, 3, 4, 5
import { useMemo } from 'react'
import type React from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { useSeasonReview } from '@/lib/hooks/useSeasonReview'
import { useSeasonAnalytics } from '@/lib/hooks/useSeasonAnalytics'
import { useDecisionHistory } from '@/lib/hooks/useDecisionHistory'
import { computeSeasonSummary } from '@/lib/regret'
import { computeDecisionGrade, type GradeLabel } from '@/lib/season-review'
import type { SeasonGwEntry } from '@/lib/types'

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

// Chip slug → display name map. Includes wildcard (unlike BackTab which excludes it per D-04).
// T-124-07: unknown slugs fall through to the raw slug string — no markup injection possible
// because all chip values are passed through React text interpolation, never dangerouslySetInnerHTML.
const CHIP_DISPLAY_NAME: Record<'bboost' | '3xc' | 'freehit' | 'wildcard', string> = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  freehit: 'Free Hit',
  wildcard: 'Wildcard',
}

// REV-02: grade badge background + text color classes per grade letter.
// UI-SPEC §Color §REV-02 Grade Card.
const GRADE_CLS: Record<GradeLabel, string> = {
  A: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  B: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  D: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

// REV-02: descriptive labels shown next to the grade letter badge.
// UI-SPEC §Component Inventory §REV-02 Grade labels.
const GRADE_LABEL: Record<GradeLabel, string> = {
  A: 'Excellent — top-tier decision-making this season',
  B: 'Good — solid decisions across captain, transfers, and chips',
  C: 'Average — mixed results; room to improve',
  D: 'Below average — decisions cost points this season',
}

// ---------------------------------------------------------------------------
// Helper functions (module-scope)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChipDot(props: any): React.ReactElement {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: SeasonGwEntry }
  if (!payload?.chipPlayed) {
    return <circle cx={cx} cy={cy} r={3} fill="currentColor" stroke="none" />
  }
  return <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="none" />
}

function SeasonChartTooltip({ active, payload }: TooltipContentProps): React.ReactElement | null {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as SeasonGwEntry
  const chipName = p.chipPlayed
    ? (CHIP_DISPLAY_NAME[p.chipPlayed as keyof typeof CHIP_DISPLAY_NAME] ?? p.chipPlayed)
    : null
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">GW{p.gw}</p>
      <p className="text-zinc-700 dark:text-zinc-300">Your score: {p.points}pts</p>
      <p className="text-zinc-700 dark:text-zinc-300">Avg manager: {p.avgManagerScore}pts</p>
      <p className="text-zinc-700 dark:text-zinc-300">Overall rank: {p.overallRank.toLocaleString()}</p>
      {chipName && (
        <p className="text-amber-600 dark:text-amber-400 mt-1">Chip: {chipName}</p>
      )}
    </div>
  )
}

/** REV-01 Transfer Net formatter. Returns display text and CSS class.
 *  Uses U+2212 (real minus sign) for negative values per UI-SPEC §Copywriting.
 */
function formatTransferNet(n: number): { text: string; cls: string } {
  if (n > 0) return { text: '+' + n, cls: 'text-green-600 dark:text-green-400' }
  if (n < 0) return { text: '−' + Math.abs(n), cls: 'text-red-600 dark:text-red-400' }
  return { text: '0', cls: 'text-zinc-500 dark:text-zinc-400' }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SeasonReviewTab({ teamId = null }: { teamId?: string | null }) {
  // ---------------------------------------------------------------------------
  // Step 1: Three hooks — called UNCONDITIONALLY (rules of hooks).
  // The hooks internally guard via `enabled: !!teamId && /^\d+$/.test(teamId)`,
  // so when teamId is null all three remain idle (isLoading=false, isSuccess=false).
  // ---------------------------------------------------------------------------
  const reviewQuery = useSeasonReview(teamId)
  const analyticsQuery = useSeasonAnalytics(teamId)
  const historyQuery = useDecisionHistory(teamId)

  // ---------------------------------------------------------------------------
  // Step 2: Grade useMemo — gated on all three hooks being isSuccess (Pitfall 2).
  // Called UNCONDITIONALLY before any conditional return.
  // ---------------------------------------------------------------------------
  const grade: GradeLabel | null = useMemo(() => {
    if (!reviewQuery.isSuccess || !analyticsQuery.isSuccess || !historyQuery.isSuccess) return null
    const summary = computeSeasonSummary(historyQuery.data.entries)
    if (summary.captainHitRate === null) return null
    const chipRoi = analyticsQuery.data.chipRoi
    const hitTracking = analyticsQuery.data.hitTracking
    const chipCount = reviewQuery.data.gwData.filter(g => g.chipPlayed !== null).length
    // Pitfall 4: zero-hits guard — vacuously true (no hits taken, reward clean play)
    const hitBreakEvenRate = hitTracking.length === 0
      ? 1.0
      : hitTracking.filter(h => h.brokeEven === true).length / hitTracking.length
    // Pitfall 3: chip ROI denominator guard — ignored when chipCount === 0 by computeDecisionGrade (D-06)
    const chipROIPositiveRate = chipRoi.length === 0
      ? 0
      : chipRoi.filter(c => c.delta > 0).length / chipRoi.length
    return computeDecisionGrade(summary.captainHitRate, hitBreakEvenRate, chipROIPositiveRate, chipCount)
  }, [
    reviewQuery.isSuccess, analyticsQuery.isSuccess, historyQuery.isSuccess,
    reviewQuery.data, analyticsQuery.data, historyQuery.data,
  ])

  // ---------------------------------------------------------------------------
  // Step 3: Component-scores useMemo — for REV-02 grade card and REV-01 captain stat.
  // Called UNCONDITIONALLY before any conditional return.
  // ---------------------------------------------------------------------------
  const componentScores = useMemo<{
    captainEVRate: number | null
    hitBreakEvenRate: number | null
    chipROIPositiveRate: number | null
    chipCount: number
  }>(() => {
    const captainEVRate = historyQuery.isSuccess
      ? computeSeasonSummary(historyQuery.data.entries).captainHitRate
      : null
    const analyticsReady = analyticsQuery.isSuccess
    const hitTracking = analyticsReady ? analyticsQuery.data.hitTracking : []
    const chipRoi = analyticsReady ? analyticsQuery.data.chipRoi : []
    // Pitfall 4: zero-hits vacuously returns 1.0 (rewarding clean transfer play)
    const hitBreakEvenRate = !analyticsReady
      ? null
      : hitTracking.length === 0
        ? 1.0
        : hitTracking.filter(h => h.brokeEven === true).length / hitTracking.length
    // D-06: chip ROI component renders as — when chipRoi is empty (no chips played)
    const chipROIPositiveRate = !analyticsReady
      ? null
      : chipRoi.length === 0
        ? null  // No chips played — display as —; grade formula excludes this per D-06
        : chipRoi.filter(c => c.delta > 0).length / chipRoi.length
    const chipCount = reviewQuery.isSuccess
      ? reviewQuery.data.gwData.filter(g => g.chipPlayed !== null).length
      : 0
    return { captainEVRate, hitBreakEvenRate, chipROIPositiveRate, chipCount }
  }, [
    historyQuery.isSuccess, historyQuery.data,
    analyticsQuery.isSuccess, analyticsQuery.data,
    reviewQuery.isSuccess, reviewQuery.data,
  ])

  // ---------------------------------------------------------------------------
  // Step 4: Loading and error branches — placed AFTER all hooks and memos.
  // ---------------------------------------------------------------------------
  const isLoading = reviewQuery.isLoading || analyticsQuery.isLoading || historyQuery.isLoading
  // historyQuery error is non-fatal — captain rate shows — but other data still renders.
  const isError = reviewQuery.isError || analyticsQuery.isError

  if (isLoading) {
    return (
      <section className="mt-6 space-y-6" aria-label="Season review">
        <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 animate-pulse">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-32 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-20 mb-1" />
                <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 h-24 animate-pulse" />
        <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-4 h-72 animate-pulse" />
      </section>
    )
  }

  if (isError && !isLoading) {
    return (
      <section className="mt-6" aria-label="Season review">
        <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
          <p className="font-semibold text-red-700 dark:text-red-300 text-sm">Failed to load season data.</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">Refresh the page or try again later.</p>
        </div>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // Step 5: Empty-state guard (D-08 + REV-04). After hooks, memos, loading, error.
  // When teamId is null the three hooks are idle so isLoading=false, isError=false.
  // ---------------------------------------------------------------------------
  if (!teamId) {
    return (
      <section className="mt-6" aria-label="Season review">
        <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your FPL Team ID to see your Season Review
        </div>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // Step 6: Main render — reviewQuery.data is guaranteed truthy here.
  // ---------------------------------------------------------------------------
  const reviewData = reviewQuery.data!
  const transferNet = formatTransferNet(reviewData.transferNetPoints)

  return (
    <section className="mt-6 space-y-6" aria-label="Season review">
      {/* REV-01 Summary Card */}
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
        <h2 className="text-lg font-semibold mb-3">Season Summary</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Overall Rank</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {reviewData.finalRank.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Total Points</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {reviewData.totalPoints}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Captain Hit Rate</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {componentScores.captainEVRate === null
                ? <span className="text-zinc-400 dark:text-zinc-500">—</span>
                : (componentScores.captainEVRate * 100).toFixed(1) + '%'
              }
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Transfer Net</dt>
            <dd className={`text-base font-semibold tabular-nums ${transferNet.cls}`}>
              {transferNet.text}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Best GW</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {'GW' + reviewData.bestGw.gw + ': ' + reviewData.bestGw.points + 'pts'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Worst GW</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {'GW' + reviewData.worstGw.gw + ': ' + reviewData.worstGw.points + 'pts'}
            </dd>
          </div>
        </dl>
      </div>

      {/* REV-02 Grade Card */}
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
        <h2 className="text-lg font-semibold mb-3">Decision Quality</h2>
        <div className="flex items-center gap-3 mb-3">
          {grade === null
            ? (
              <span className="text-zinc-400 dark:text-zinc-500" aria-label="Decision quality grade: pending">—</span>
            )
            : (
              <>
                <span
                  className={'text-lg font-semibold rounded px-3 py-1 ' + GRADE_CLS[grade]}
                  aria-label={'Decision quality grade: ' + grade}
                >
                  {grade}
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{GRADE_LABEL[grade]}</span>
              </>
            )
          }
        </div>
        {/* Component-score breakdown (ROADMAP Phase 124 Success Criterion 2) */}
        <dl className="grid grid-cols-3 gap-3 mb-3" data-testid="grade-component-scores">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Captain EV rate</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {componentScores.captainEVRate === null
                ? <span className="text-zinc-400 dark:text-zinc-500">—</span>
                : (componentScores.captainEVRate * 100).toFixed(1) + '%'
              }
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Hit break-even rate</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {componentScores.hitBreakEvenRate === null
                ? <span className="text-zinc-400 dark:text-zinc-500">—</span>
                : (componentScores.hitBreakEvenRate * 100).toFixed(1) + '%'
              }
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Chip ROI positive rate</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {componentScores.chipROIPositiveRate === null
                ? <span className="text-zinc-400 dark:text-zinc-500">—</span>
                : (componentScores.chipROIPositiveRate * 100).toFixed(1) + '%'
              }
            </dd>
          </div>
        </dl>
        {/* Methodology note — hard requirement per STATE.md v1.24 decision */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Grade based on: captain EV rate (40%) + hit break-even rate (35%) + chip ROI positive rate (25%).
          Thresholds: A ≥ 75%, B ≥ 50%, C ≥ 25%, D &lt; 25%. Chip ROI excluded when no chips played.
          v1 thresholds — subject to calibration.
        </p>
      </div>

      {/* REV-03 Points Chart */}
      <div
        className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative"
        data-testid="season-points-chart"
      >
        <h2 className="text-lg font-semibold mb-2">Season Points</h2>
        {/* Legend row */}
        <div className="flex gap-4 text-xs text-zinc-600 dark:text-zinc-400 mb-2">
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 12, height: 2, background: 'currentColor' }} />
            Your score
          </span>
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 12, height: 2, background: 'rgba(161,161,170,0.7)' }} />
            Avg manager
          </span>
          <span className="flex items-center gap-1">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            Chip GW
          </span>
        </div>
        <ResponsiveContainer width="100%" height={288}>
          <ComposedChart data={reviewData.gwData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
            <XAxis
              dataKey="gw"
              tickFormatter={(v: number) => `GW${v}`}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 'auto']}
              width={40}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={SeasonChartTooltip} />
            <Line
              type="monotone"
              dataKey="points"
              stroke="currentColor"
              strokeWidth={2}
              dot={<ChipDot />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="avgManagerScore"
              stroke="rgba(161,161,170,0.7)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
