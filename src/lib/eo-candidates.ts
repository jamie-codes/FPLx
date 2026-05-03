// Phase 57 (EO-01..EO-03): computeEOCandidates — pure ranker for the captain panel.
// Sources of truth:
//   - .planning/phases/057-effective-ownership-mode/057-CONTEXT.md §decisions D-02, D-03, D-07
//   - .planning/phases/057-effective-ownership-mode/057-RESEARCH.md §Code Examples
// Eligibility rule mirrors src/lib/captaincy-engine.ts lines 70–78 plus an extra status === 'a' gate.
import type { MergedPlayer } from '@/lib/types'

export type EOMode = 'max_xpts' | 'protect_rank' | 'chase_rank' | 'differential_aggressive'

export function computeEOCandidates(
  players: MergedPlayer[],
  mode: EOMode,
  topN = 5,
): MergedPlayer[] {
  const eligible = players.filter(
    p =>
      p.status === 'a' &&
      p.element_type !== 1 &&
      p.xPts_1gw != null &&
      p.xPts_1gw > 0,
  )

  if (mode === 'max_xpts') {
    return eligible
      .slice()
      .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
      .slice(0, topN)
  }

  if (mode === 'protect_rank') {
    return eligible
      .slice()
      .sort(
        (a, b) =>
          parseFloat(b.selected_by_percent) -
          parseFloat(a.selected_by_percent),
      )
      .slice(0, topN)
  }

  if (mode === 'chase_rank') {
    return eligible
      .filter(p => p.xPts_90th_1gw != null)
      .slice()
      .sort((a, b) => (b.xPts_90th_1gw ?? 0) - (a.xPts_90th_1gw ?? 0))
      .slice(0, topN)
  }

  // differential_aggressive — Pitfall 2: median over the FULL eligible pool.
  const xptsValues = eligible
    .map(p => p.xPts_1gw ?? 0)
    .slice()
    .sort((a, b) => a - b)
  const mid = Math.floor(xptsValues.length / 2)
  const median =
    xptsValues.length === 0
      ? 0
      : xptsValues.length % 2 !== 0
        ? xptsValues[mid]
        : (xptsValues[mid - 1] + xptsValues[mid]) / 2
  return eligible
    .filter(p => (p.xPts_1gw ?? 0) >= median)
    .slice()
    .sort(
      (a, b) =>
        parseFloat(a.selected_by_percent) -
        parseFloat(b.selected_by_percent),
    )
    .slice(0, topN)
}
