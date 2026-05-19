'use client'
// Phase 125 WIN-01: SummerWindowTab — transfer news feed with classification filter pills.
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-01..D-09
//   .planning/phases/125-summer-window-tracker/125-UI-SPEC.md §WIN-01

import React, { useState } from 'react'
import { useTransferNews } from '@/lib/hooks/useTransferNews'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { TransferClass } from '@/lib/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

const PILLS = [
  { value: 'all' as const,                label: 'All'       },
  { value: 'confirmed_signing' as const,  label: 'Confirmed' },
  { value: 'rumour' as const,             label: 'Rumour'    },
  { value: 'injury_return' as const,      label: 'Injury'    },
  { value: 'rotation_signal' as const,    label: 'Rotation'  },
] satisfies ReadonlyArray<{ value: TransferClass | 'all'; label: string }>

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

// ─── Component ───────────────────────────────────────────────────────────────

export function SummerWindowTab(): React.JSX.Element {
  const { data, isLoading, isError } = useTransferNews()
  const [activeFilter, setActiveFilter] = useState<TransferClass | 'all'>('all')

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
        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Failed to load transfer news.</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Refresh the page or try again later.</p>
      </div>
    )
  }

  const feed = data

  // Stale banner logic
  const isStale = Date.now() - new Date(feed.scraped_at).getTime() > STALE_THRESHOLD_MS

  // Filter + sort articles (never mutate feed.articles — Pitfall 4)
  const filtered =
    activeFilter === 'all'
      ? [...feed.articles]
      : feed.articles.filter(a => a.classification === activeFilter)

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
        role="group"
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
      </div>

      {/* Article list or empty state */}
      {sortedArticles.length === 0 ? (
        <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No {PILL_LABEL[activeFilter]} articles found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedArticles.map((article, idx) => (
            <article
              key={`${article.url}-${idx}`}
              className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3"
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
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {formatRelativeTime(article.published ?? article.scraped_at)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
