// Phase 88 SCRAPER-01: pure severity classifier.
// Sources of truth:
//   - .planning/phases/88-fpl-news-flags-ui/88-CONTEXT.md §D-09
//   - .planning/phases/88-fpl-news-flags-ui/88-UI-SPEC.md §Severity color contract

export type NewsSeverity = 'red' | 'amber' | 'zinc' | 'none'

/**
 * Classifies news severity from chance_of_playing_next_round + news text.
 *
 * Thresholds (D-09):
 *   chance == null && news empty   → 'none'
 *   chance === 100 && news empty   → 'none'
 *   chance === 100 && news non-empty → 'zinc'
 *   chance == null && news non-empty → 'zinc'
 *   chance === 75                  → 'amber'
 *   chance <= 50                   → 'red'
 */
export function computeNewsSeverity(
  chance_of_playing_next_round?: number | null,
  news?: string,
): NewsSeverity {
  const hasNews = Boolean(news && news.trim().length > 0)
  if (!hasNews && (chance_of_playing_next_round == null || chance_of_playing_next_round === 100)) {
    return 'none'
  }
  if (chance_of_playing_next_round == null || chance_of_playing_next_round === 100) {
    return 'zinc'
  }
  if (chance_of_playing_next_round === 75) return 'amber'
  return 'red'   // <= 50 (and any other unexpected value treated as flagged)
}
