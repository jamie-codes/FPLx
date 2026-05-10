// Phase 88 SCRAPER-01: shared component type contracts for src/components/news/.
// NewsSeverity re-export defers to src/lib/newsSeverity (created in Wave 1).
export type { NewsSeverity } from '@/lib/newsSeverity'

export interface NewsBannerProps {
  news: string
  news_added?: string
  chance_of_playing_next_round?: number | null
}

export interface NewsBadgeProps {
  news: string
}
