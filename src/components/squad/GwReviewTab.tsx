'use client'

import { useState } from 'react'
import { useGwReview } from '@/lib/hooks/useGwReview'
import type { GwReview } from '@/lib/types'

interface GwReviewTabProps {
  teamId: string                 // submittedId from page.tsx; '' when no squad loaded
  settledGws: number[]           // last 3 settled GW numbers (asc order); [] when none yet
}

// ─── StatCard sub-component (UI-SPEC contract) ──────────────────────────────

interface StatCardProps {
  label: string
  value: string                  // pre-formatted (with prefix +/- if applicable)
  sentimentClass?: string        // e.g. 'text-green-600 dark:text-green-400'
}

function StatCard({ label, value, sentimentClass }: StatCardProps) {
  const valueClass = sentimentClass ?? 'text-zinc-900 dark:text-zinc-100'
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

// ─── GwPillToggle sub-component ─────────────────────────────────────────────

interface GwPillToggleProps {
  gws: number[]
  activeGw: number
  onSelect: (gw: number) => void
}

function GwPillToggle({ gws, activeGw, onSelect }: GwPillToggleProps) {
  return (
    <div role="group" aria-label="Gameweek" className="flex gap-1">
      {gws.map((gw) => {
        const active = gw === activeGw
        const cls = active
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
        return (
          <button
            key={gw}
            type="button"
            onClick={() => onSelect(gw)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-semibold min-h-[44px] cursor-pointer transition-colors ${cls}`}
          >
            {`GW${gw}`}
          </button>
        )
      })}
    </div>
  )
}

// ─── GwReviewTab main export ────────────────────────────────────────────────

export function GwReviewTab({ teamId, settledGws }: GwReviewTabProps) {
  const submittedId = teamId.trim() === '' ? null : teamId.trim()

  // Hooks must be called unconditionally — selectedGw initialised even when no
  // settled GWs (will fall through to the no-settled-gws branch before render).
  const defaultGw =
    settledGws.length > 0 ? settledGws[settledGws.length - 1] : null
  const [selectedGw, setSelectedGw] = useState<number | null>(defaultGw)

  const queryGw = selectedGw ?? defaultGw
  const { data, isLoading, isError, error } = useGwReview(submittedId, queryGw)

  // ───── No-squad branch (D-11) ─────
  if (submittedId === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="gw-review-tab">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">GW Review</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Load your squad to see GW reviews.
        </div>
      </section>
    )
  }

  // ───── No settled GWs branch (D-12 — global, not per-GW) ─────
  if (settledGws.length === 0 || queryGw === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="gw-review-tab">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">GW Review</h2>
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          GW review will appear once scores finalise.
        </div>
      </section>
    )
  }

  // ───── Pill toggle is rendered for all data-bearing branches below ─────
  const header = (
    <header className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">GW Review</h2>
      <GwPillToggle gws={settledGws} activeGw={queryGw} onSelect={setSelectedGw} />
    </header>
  )

  // ───── Loading branch ─────
  if (isLoading) {
    return (
      <section className="mt-6 space-y-3" data-testid="gw-review-tab">
        {header}
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading GW review...
        </div>
      </section>
    )
  }

  // ───── Error branches (D-12, D-13) ─────
  if (isError || !data) {
    const status = (error as (Error & { status?: number }) | null)?.status
    let copy = 'Unable to load GW review. Please try again.'
    if (status === 503) {
      copy = 'GW review will appear once scores finalise.'
    } else if (status === 404 || status === 502) {
      copy = 'Review data unavailable - check back after the next pipeline run.'
    }
    const isUnsettled = status === 503
    const errorBoxCls = isUnsettled
      ? 'rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400'
      : 'rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300'
    return (
      <section className="mt-6 space-y-3" data-testid="gw-review-tab">
        {header}
        <div className={errorBoxCls}>{copy}</div>
      </section>
    )
  }

  // ───── Data-rendered branch (PGW-01 happy path) ─────
  const review: GwReview = data
  const captainDelta = review.captain_delta ?? null
  const deltaIsOptimal = captainDelta === 0
  const deltaLabel = deltaIsOptimal ? 'Optimal captain - no delta' : 'Captain delta'
  const deltaValue = captainDelta == null
    ? '—'
    : deltaIsOptimal
      ? '0'
      : `+${captainDelta}pts missed`
  const deltaClass = deltaIsOptimal
    ? 'text-green-600 dark:text-green-400'
    : 'text-amber-700 dark:text-amber-300'

  const scoreBeatsAverage = review.your_score > review.average_score
  const scoreClass = scoreBeatsAverage
    ? 'text-green-600 dark:text-green-400'
    : 'text-zinc-700 dark:text-zinc-300'

  return (
    <section className="mt-6 space-y-3" data-testid="gw-review-tab">
      {header}

      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        data-testid="gw-review-stat-grid"
      >
        <StatCard label="GW Score" value={String(review.your_score)} sentimentClass={scoreClass} />
        <StatCard label="Bench pts left" value={String(review.bench_pts_left)} />
        <StatCard label={deltaLabel} value={deltaValue} sentimentClass={deltaClass} />
        <StatCard label="FPL average" value={String(review.average_score)} />
      </div>

      <div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Top scorer</span>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {review.top_scorer_name} - {review.top_scorer_pts}pts
        </span>
      </div>

      <div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex flex-wrap items-baseline gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Captain</span>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {review.captain_name}
        </span>
        {captainDelta != null && !deltaIsOptimal && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
            Optimal: {review.optimal_captain_name}
          </span>
        )}
      </div>
    </section>
  )
}
