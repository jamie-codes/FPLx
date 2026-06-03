'use client'
// Phase 125 WIN-01: SummerWindowTab — transfer news feed with classification filter pills.
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-01..D-09
//   .planning/phases/125-summer-window-tracker/125-UI-SPEC.md §WIN-01

import React, { useState } from 'react'
import { useTransferNews } from '@/lib/hooks/useTransferNews'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { TransferClass, SourceTier } from '@/lib/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

// Module-level helper — avoids calling Date.now() directly in render (react-hooks/purity)
const isFeedStale = (scrapedAt: string): boolean =>
  Date.now() - new Date(scrapedAt).getTime() > STALE_THRESHOLD_MS

// Phase 131 SPEC-02: 21-day article confidence decay (D-05/D-07)
const STALE_ARTICLE_THRESHOLD_DAYS = 21
const STALE_ARTICLE_THRESHOLD_MS = STALE_ARTICLE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000

// Module-level helper — mirrors isFeedStale; uses published ?? scraped_at (D-07)
const isArticleStale = (published: string | null, scrapedAt: string): boolean => {
  const ts = new Date(published ?? scrapedAt).getTime()
  return Date.now() - ts > STALE_ARTICLE_THRESHOLD_MS
}

const PILLS = [
  { value: 'all' as const,                label: 'All'       },
  { value: 'confirmed_signing' as const,  label: 'Confirmed' },
  { value: 'rumour' as const,             label: 'Rumour'    },
  { value: 'injury_return' as const,      label: 'Injury'    },
  { value: 'rotation_signal' as const,    label: 'Rotation'  },
] satisfies ReadonlyArray<{ value: TransferClass | 'all'; label: string }>

// Phase 131 SPEC-03: Tier filter pills (D-12/D-13)
type SourceTierFilter = SourceTier | 'all'

const TIER_PILLS = [
  { value: 'all' as const,           label: 'All'         },
  { value: 'Official' as const,      label: 'Official'    },
  { value: 'Reliable' as const,      label: 'Reliable'    },
  { value: 'Speculative' as const,   label: 'Speculative' },
] satisfies ReadonlyArray<{ value: SourceTierFilter; label: string }>

const PILL_LABEL: Record<TransferClass | 'all', string> = {
  all:               'All',
  confirmed_signing: 'Confirmed',
  rumour:            'Rumour',
  injury_return:     'Injury',
  rotation_signal:   'Rotation',
  general:           'General',
}

const SOURCE_LABEL: Record<'skysports' | 'bbc', string> = {
  skysports: '[SKY]',
  bbc:       '[BBC]',
}

const SOURCE_CLS: Record<'skysports' | 'bbc', string> = {
  skysports: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  bbc:       'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// Phase 131 SPEC-01: Tier badge dicts (D-09/D-10)
const TIER_LABEL: Record<SourceTier, string> = {
  Official:    'Official',
  Reliable:    'Reliable',
  Speculative: 'Speculative',
}

const TIER_CLS: Record<SourceTier, string> = {
  Official:    'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  Reliable:    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Speculative: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SummerWindowTab(): React.JSX.Element {
  const { data, isLoading, isError, isNotAvailable } = useTransferNews()
  const [activeFilter, setActiveFilter] = useState<TransferClass | 'all'>('all')
  const [activeTierFilter, setActiveTierFilter] = useState<SourceTierFilter>('all')

  // Loading state: skeleton
  if (isLoading && !data) {
    return (
      <section className="mt-6 space-y-4" aria-label="Summer window transfer news">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 animate-pulse">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-20" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  // Error state (or missing data after loading)
  if (isError || !data) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
          {isNotAvailable ? 'Transfer news feed is not yet active.' : 'Failed to load transfer news.'}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {isNotAvailable
            ? 'The pipeline will populate this feed on its next scheduled run.'
            : 'Refresh the page or try again later.'}
        </p>
      </div>
    )
  }

  const feed = data

  // Stale banner logic
  const isStale = isFeedStale(feed.scraped_at)

  // Filter + sort articles (never mutate feed.articles — Pitfall 4)
  // Stage 1: classification filter
  const afterClassification =
    activeFilter === 'all'
      ? [...feed.articles]
      : feed.articles.filter(a => a.classification === activeFilter)

  // Stage 2: tier filter (D-11 AND logic — both filters apply simultaneously)
  const filtered =
    activeTierFilter === 'all'
      ? afterClassification
      : afterClassification.filter(a => a.source_tier === activeTierFilter)

  const sortedArticles = [...filtered].sort((a, b) => {
    const ta = new Date(a.published ?? a.scraped_at).getTime()
    const tb = new Date(b.published ?? b.scraped_at).getTime()
    return tb - ta
  })

  return (
    <section className="mt-6 space-y-4" aria-label="Summer window transfer news">
      {/* Stale banner (D-04) */}
      {isStale && (
        <div className="flex items-center gap-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <span aria-hidden="true">⚠</span>
          Feed last updated {formatRelativeTime(feed.scraped_at)} — may not reflect latest news.
        </div>
      )}

      {/* Filter pill row (D-05..D-08) */}
      <div
        role="tablist"
        aria-label="Filter transfer news by type"
        className="flex flex-wrap gap-2"
      >
        {PILLS.map((pill) => {
          const active = pill.value === activeFilter
          const cls = active
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          return (
            <button
              key={pill.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFilter(pill.value)}
              className={`min-h-[44px] sm:min-h-0 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${cls}`}
            >
              {pill.label}
            </button>
          )
        })}

        {/* Divider between classification and tier pill groups (D-12) */}
        <span aria-hidden="true" className="self-stretch border-l border-zinc-300 dark:border-zinc-600 mx-1" />

        {/* Phase 131 SPEC-03: Tier filter pills — same button shape as classification pills */}
        {TIER_PILLS.map((pill) => {
          const active = pill.value === activeTierFilter
          const cls = active
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          return (
            <button
              key={`tier-${pill.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTierFilter(pill.value)}
              className={`min-h-[44px] sm:min-h-0 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${cls}`}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      {/* Article list or empty state */}
      {sortedArticles.length === 0 ? (
        <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No {PILL_LABEL[activeFilter]} articles found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedArticles.map((article, idx) => {
            const stale = isArticleStale(article.published, article.scraped_at)
            return (
              <article
                key={`${article.url}-${idx}`}
                className={`rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3${stale ? ' opacity-40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-zinc-900 dark:text-zinc-100 hover:underline leading-snug"
                  >
                    {article.title}
                  </a>
                  <span className={`shrink-0 inline-block text-xs font-semibold rounded px-2 py-0.5 ${SOURCE_CLS[article.source]}`}>
                    {SOURCE_LABEL[article.source]}
                  </span>
                  {article.source_tier && (
                    <span className={`shrink-0 inline-block text-xs font-semibold rounded px-2 py-0.5 ${TIER_CLS[article.source_tier]}`}>
                      {TIER_LABEL[article.source_tier]}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRelativeTime(article.published ?? article.scraped_at)}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
