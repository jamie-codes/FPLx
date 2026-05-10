import { useQuery } from '@tanstack/react-query'
import type { AccuracyBacktest } from '../types'

export function useAccuracy() {
  return useQuery<AccuracyBacktest>({
    queryKey: ['accuracy'],
    queryFn: async () => {
      const res = await fetch('/api/accuracy')
      if (!res.ok) throw new Error('Failed to fetch accuracy data')
      return res.json()
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — matches useInsights
  })
}

// Phase 88 SCRAPER-01: gate accessor — wraps useAccuracy, returns summary.news_flag_enabled.
// Default false (safe: no news chrome shown until pipeline confirms flag present).
// NOTE: gate ships true from pipeline (D-04), so in practice this returns true immediately.
// CRITICAL: AccuracySummary is nested under data.summary, NOT data directly.
export function useNewsFlagEnabled(): boolean {
  const { data } = useAccuracy()
  return data?.summary?.news_flag_enabled ?? false
}
