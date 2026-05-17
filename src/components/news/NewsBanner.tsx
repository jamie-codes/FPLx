// Phase 88 SCRAPER-01: NewsBanner — inline severity-coloured news text.
// Mirrors FragilityNote (Phase 64 SENS-02) — no filled pill, no border, no background.
// Sources of truth:
//   - .planning/phases/88-fpl-news-flags-ui/88-CONTEXT.md §D-07, D-08
//   - .planning/phases/88-fpl-news-flags-ui/88-UI-SPEC.md §NewsBanner
'use client'

import { useNewsFlagEnabled } from '@/lib/hooks/useAccuracy'
import { computeNewsSeverity, type NewsSeverity } from '@/lib/newsSeverity'

interface NewsBannerProps {
  news: string
  news_added?: string
  chance_of_playing_next_round?: number | null
}

const SEVERITY_CLASS: Record<NewsSeverity, string> = {
  red:   'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  zinc:  'text-zinc-500 dark:text-zinc-400',
  none:  '',
}

const SEVERITY_ICON: Record<NewsSeverity, string> = {
  red:   '⚠',
  amber: '⚠',
  zinc:  'ℹ',
  none:  '',
}

// NEWS-01 (Phase 115, D-01/D-02/D-03): suppress stale zinc badges (14-day gate)
const isStale = (newsAdded?: string): boolean =>
  newsAdded ? Date.now() - new Date(newsAdded).getTime() > 14 * 24 * 60 * 60 * 1000 : false

export function NewsBanner({ news, news_added, chance_of_playing_next_round }: NewsBannerProps) {
  const enabled = useNewsFlagEnabled()
  if (!enabled || !news || news.trim().length === 0) return null
  const severity = computeNewsSeverity(chance_of_playing_next_round, news)
  if (severity === 'zinc' && isStale(news_added)) return null
  if (severity === 'none') return null
  return (
    <div className={`text-xs ${SEVERITY_CLASS[severity]}`} data-testid="news-banner">
      <span aria-hidden="true">{SEVERITY_ICON[severity]} </span>
      {news}
    </div>
  )
}
