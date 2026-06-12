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
  sentimentClass?: string        // e.g. 'text-positive'
  delta?: string                 // Phase 99 PGW-03: optional sub-label rendered below value
  testid?: string                // Phase 99 PGW-03: optional data-testid forwarded to root div
}

function StatCard({ label, value, sentimentClass, delta, testid }: StatCardProps) {
  const valueClass = sentimentClass ?? 'text-ink'
  return (
    <div
      className="rounded border border-line bg-surface-1 p-3"
      data-testid={testid}
    >
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className={`text-xl font-semibold ${valueClass}`}>{value}</p>
      {delta && (
        <p className={`text-xs mt-0.5 ${sentimentClass ?? 'text-ink-muted'}`}>
          {delta}
        </p>
      )}
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
          ? 'bg-ink text-surface-1'
          : 'text-ink-muted hover:text-ink'
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
        <h2 className="text-base font-semibold text-ink">GW Review</h2>
        <div className="rounded border border-line p-6 text-center text-sm text-ink-muted">
          Load your squad to see GW reviews.
        </div>
      </section>
    )
  }

  // ───── No settled GWs branch (D-12 — global, not per-GW) ─────
  if (settledGws.length === 0 || queryGw === null) {
    return (
      <section className="mt-6 space-y-3" data-testid="gw-review-tab">
        <h2 className="text-base font-semibold text-ink">GW Review</h2>
        <div className="rounded border border-line p-6 text-center text-sm text-ink-muted">
          GW review will appear once scores finalise.
        </div>
      </section>
    )
  }

  // ───── Pill toggle is rendered for all data-bearing branches below ─────
  const header = (
    <header className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink">GW Review</h2>
      <GwPillToggle gws={settledGws} activeGw={queryGw} onSelect={setSelectedGw} />
    </header>
  )

  // ───── Loading branch ─────
  if (isLoading) {
    return (
      <section className="mt-6 space-y-3" data-testid="gw-review-tab">
        {header}
        <div className="rounded border border-line p-4 text-sm text-ink-muted">
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
      ? 'rounded border border-line p-6 text-center text-sm text-ink-muted'
      : 'rounded border border-negative/40 bg-negative-soft p-4 text-sm text-negative'
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
    ? 'text-positive'
    : 'text-warning'

  const scoreBeatsAverage = review.your_score > review.average_score
  const scoreClass = scoreBeatsAverage
    ? 'text-positive'
    : 'text-ink'

  // Phase 99 PGW-03: benchmark card delta + sentiment
  // FIX-05 (Phase 110): flip sign — dream team beats user → positive diff → amber
  const benchmarkDiff = review.benchmark_score - review.your_score
  let benchmarkDeltaLabel: string
  let benchmarkSentimentClass: string
  if (benchmarkDiff > 0) {
    benchmarkDeltaLabel = `+${benchmarkDiff} vs you`
    benchmarkSentimentClass = 'text-warning'
  } else if (benchmarkDiff === 0) {
    benchmarkDeltaLabel = 'on par'
    benchmarkSentimentClass = 'text-positive'
  } else {
    benchmarkDeltaLabel = `−${Math.abs(benchmarkDiff)} vs you` // U+2212 minus sign (NOT hyphen-minus)
    benchmarkSentimentClass = 'text-positive'
  }

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
        <StatCard
              label={review.benchmark_label}
              value={String(review.benchmark_score)}
              sentimentClass={benchmarkSentimentClass}
              delta={review.benchmark_label === 'FPL average' ? undefined : benchmarkDeltaLabel}
              testid="gw-review-benchmark-card"
            />
      </div>

      <div className="rounded border border-line px-3 py-2 flex items-baseline gap-2">
        <span className="text-xs text-ink-muted">Top scorer</span>
        <span className="text-sm font-semibold text-ink">
          {review.top_scorer_name} - {review.top_scorer_pts}pts
        </span>
      </div>

      <div className="rounded border border-line px-3 py-2 flex flex-wrap items-baseline gap-2">
        <span className="text-xs text-ink-muted">Captain</span>
        <span className="text-sm font-semibold text-ink">
          {review.captain_name}
        </span>
        {captainDelta != null && !deltaIsOptimal && (
          <span className="text-xs text-ink-muted ml-2">
            Optimal: {review.optimal_captain_name}
          </span>
        )}
      </div>

      <div className="rounded border border-line px-3 py-2 flex items-baseline gap-2">
        <span className="text-xs text-ink-muted">Best bench</span>
        <span className="text-sm font-semibold text-ink">
          {review.best_bench_player_name} — {review.best_bench_player_pts}pts
        </span>
      </div>

      {review.missed_players.length > 0 && (
        <div
          className="rounded border border-line px-3 py-2 flex items-baseline gap-2"
          data-testid="gw-review-missed-row"
        >
          <span className="text-xs text-ink-muted">Missed</span>
          <span className="text-sm font-semibold text-ink">
            {review.missed_players.map((p) => `${p.name} (${p.pts})`).join(', ')}
          </span>
        </div>
      )}
    </section>
  )
}
