// Phase 112 (TFR-02): capByPosition — pure post-filter for suggestTransfers output.
// Caps buy candidates at `limit` per element_type bucket (GK=1, DEF=2, MID=3, FWD=4).
// Pure function — no React, no side effects, testable in @vitest-environment node.
import type { TransferSuggestion } from './types'

export interface CappedSuggestions {
  suggestions: TransferSuggestion[]
  /** Maps element_type → total count BEFORE cap (for footnote rendering). */
  totalsByPosition: Map<number, number>
}

/**
 * Caps the suggestTransfers output at `limit` suggestions per element_type bucket.
 *
 * @param suggestions - TransferSuggestion[] from suggestTransfers(), pre-sorted by xPtsGain desc, cost asc.
 *                      Input order is preserved within each bucket (slice(0, limit) is the only truncation).
 * @param limit       - Maximum number of suggestions to keep per element_type bucket (e.g. 3).
 * @returns           - { suggestions: capped and re-sorted array, totalsByPosition: pre-cap counts per bucket }
 */
export function capByPosition(
  suggestions: TransferSuggestion[],
  limit: number,
): CappedSuggestions {
  // Step 1: Build a bucket map by element_type, preserving input order within each bucket.
  const byPosition = new Map<number, TransferSuggestion[]>()
  for (const sug of suggestions) {
    const pos =
      sug.kind === 'single'
        ? sug.buy.element_type
        : sug.transfers[0].buy.element_type
    const bucket = byPosition.get(pos)
    if (bucket === undefined) {
      byPosition.set(pos, [sug])
    } else {
      bucket.push(sug)
    }
  }

  // Step 2: Record totalsByPosition BEFORE slicing (for footnote rendering).
  const totalsByPosition = new Map<number, number>()
  for (const [pos, bucket] of byPosition) {
    totalsByPosition.set(pos, bucket.length)
  }

  // Step 3: Build capped array by concatenating slice(0, limit) for each bucket.
  const capped: TransferSuggestion[] = []
  for (const [, bucket] of byPosition) {
    for (const sug of bucket.slice(0, limit)) {
      capped.push(sug)
    }
  }

  // Step 4: Sort capped array by xPtsGain desc, tie-broken by cost asc.
  capped.sort((a, b) => {
    const gainDiff = b.xPtsGain - a.xPtsGain
    if (gainDiff !== 0) return gainDiff
    return a.cost - b.cost
  })

  // Step 5: Return.
  return { suggestions: capped, totalsByPosition }
}
