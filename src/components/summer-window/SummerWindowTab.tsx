'use client'

// Phase 125 WIN-01: Summer Window Tab — transfer news feed with filter pills.
//
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-01..D-09, D-17
//
// Filter pills: All | Confirmed | Rumour | Injury | Rotation
// D-05: 'general' articles have no dedicated pill — visible under "All" only.
// D-06: Single-select (radio style).
// D-07: Default active pill: All.
// D-04: Stale banner when feed.scraped_at > 24h old.

import { useState } from 'react'
import { useTransferNews } from '@/lib/hooks/useTransferNews'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { TransferClass } from '@/lib/types'

// D-05: Pills mapping to classification values (or 'all')
type FilterPill = 'all' | 'confirmed' | 'rumour' | 'injury' | 'rotation'

const PILLS: { id: FilterPill; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'rumour', label: 'Rumour' },
  { id: 'injury', label: 'Injury' },
  { id: 'rotation', label: 'Rotation' },
]

// D-08: Filter mapping from pill ID to TransferClass
const PILL_TO_CLASS: Record<Exclude<FilterPill, 'all'>, TransferClass> = {
  confirmed: 'confirmed_signing',
  rumour: 'rumour',
  injury: 'injury_return',
  rotation: 'rotation_signal',
}

const SOURCE_LABEL: Record<string, string> = {
  skysports: 'SKY',
  bbc: 'BBC',
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export function SummerWindowTab() {
  // D-07: Default active pill is "All"
  const [activeFilter, setActiveFilter] = useState<FilterPill>('all')
  const { data: feed, isLoading, isError } = useTransferNews()

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="summer-window-loading">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError || !feed) {
    return (
      <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300" data-testid="summer-window-error">
        Failed to load transfer news. Please try again later.
      </div>
    )
  }

  // D-04: Stale banner when scraped_at > 24h old
  const isStale = Date.now() - new Date(feed.scraped_at).getTime() > STALE_THRESHOLD_MS

  // Filter articles based on active pill
  const filteredArticles = activeFilter === 'all'
    ? feed.articles
    : feed.articles.filter(a => a.classification === PILL_TO_CLASS[activeFilter])

  return (
    <div className="space-y-4" data-testid="summer-window-tab">
      {/* D-04: Stale feed warning banner */}
      {isStale && (
        <div
          className="rounded border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-800 dark:text-yellow-200"
          data-testid="stale-feed-banner"
        >
          Feed last updated {formatRelativeTime(feed.scraped_at)} — may not reflect latest news.
        </div>
      )}

      {/* D-05/D-06: Single-select filter pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter articles" data-testid="filter-pills">
        {PILLS.map(pill => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setActiveFilter(pill.id)}
            className={`px-3 py-1 text-sm rounded-full font-medium transition-colors min-h-[36px] ${
              activeFilter === pill.id
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            aria-pressed={activeFilter === pill.id}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* D-09: Empty state when no articles match active filter */}
      {filteredArticles.length === 0 ? (
        <div
          className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400"
          data-testid="empty-state"
        >
          No {PILLS.find(p => p.id === activeFilter)?.label} articles found.
        </div>
      ) : (
        <div className="space-y-2" data-testid="article-list">
          {filteredArticles.map((article, index) => {
            // D-03: Use published date if available, fall back to scraped_at
            const dateStr = article.published ?? article.scraped_at
            const sourceLabel = SOURCE_LABEL[article.source] ?? article.source.toUpperCase()

            return (
              <div
                key={index}
                className="flex items-start gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0"
                data-testid="article-card"
              >
                {/* D-02: Article title links to original article */}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 leading-snug"
                >
                  {article.title}
                </a>
                <div className="flex flex-col items-end gap-0.5 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {/* D-03: Source badge */}
                  <span className="font-mono">[{sourceLabel}]</span>
                  {/* D-03: Relative date */}
                  <span>{formatRelativeTime(dateStr)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
