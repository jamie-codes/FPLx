// Phase 88 SCRAPER-01: NewsBadge — returns the news text for title= attribute on Status badge.
// Used as: const newsTitle = NewsBadge({ news: row.original.news }) — caller passes to title=.
// Returns null when gate off (useNewsFlagEnabled false) or news is empty/whitespace.
'use client'
import { useNewsFlagEnabled } from '@/lib/hooks/useAccuracy'

interface NewsBadgeProps {
  news: string
}

export function NewsBadge({ news }: NewsBadgeProps): string | null {
  const enabled = useNewsFlagEnabled()
  if (!enabled) return null
  const trimmed = news?.trim() ?? ''
  if (!trimmed) return null
  return news
}
