// Phase 125 WIN-02: shared utility — builds element_id → tooltip-text map from confirmed_signing articles.
// Used by GemTable (expanded-row badge) and TransferPanel (OpportunityCostTable buy-cell badge).
import type { TransferNewsArticle } from './types'

export function buildConfirmedSigningMap(
  articles: TransferNewsArticle[]
): Map<number, string> {
  const map = new Map<number, string>()
  const sorted = [...articles]
    .filter(a => a.classification === 'confirmed_signing' && a.element_id !== null)
    .sort((a, b) =>
      new Date(b.published ?? b.scraped_at).getTime() -
      new Date(a.published ?? a.scraped_at).getTime()
    )
  for (const article of sorted) {
    if (article.element_id !== null && !map.has(article.element_id)) {
      const sourceLabel = article.source === 'skysports' ? 'Sky Sports' : 'BBC'
      map.set(article.element_id, `${article.title} · ${sourceLabel}`)
    }
  }
  return map
}
