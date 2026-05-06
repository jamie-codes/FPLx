// Phase 62 (MC-04): computeMCLabels — pure ranker for MC captain label cascade.
// Sources of truth:
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-CONTEXT.md §decisions D-16, D-17
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-RESEARCH.md §Pattern 2
// Greedy priority cascade: Best P(haul) > Highest ceiling > Lowest floor.
// One label per player (Set<number> tracks labelled IDs); at most 3 labels total.
import type { MergedPlayer } from '@/lib/types'

export type MCDimension = 'haul' | 'ceiling' | 'floor'

export interface MCLabel {
  playerId: number
  dimension: MCDimension
  label: string   // 'Best P(haul)' | 'Highest ceiling' | 'Lowest floor'
  value: string   // '41%' | '14.2 pts' | '4.8 pts'
}

export function computeMCLabels(candidates: MergedPlayer[]): MCLabel[] {
  // Guard (D-17): MC labels and TC callout require haul_prob — when no candidate
  // has it, return [] so the panel renders byte-identical to pre-Phase 62 output.
  const hasMC = candidates.some(c => c.haul_prob !== undefined)
  if (!hasMC) return []

  const labelled = new Set<number>()
  const result: MCLabel[] = []

  // Dimension 1 (highest priority): Best P(haul) — highest haul_prob across all candidates.
  const haulWinner = candidates
    .filter(c => c.haul_prob !== undefined)
    .reduce<MergedPlayer | null>(
      (best, c) => (c.haul_prob ?? -Infinity) > (best?.haul_prob ?? -Infinity) ? c : best,
      null,
    )
  if (haulWinner) {
    labelled.add(haulWinner.id)
    result.push({
      playerId: haulWinner.id,
      dimension: 'haul',
      label: 'Best P(haul)',
      value: `${Math.round((haulWinner.haul_prob ?? 0) * 100)}%`,
    })
  }

  // Dimension 2: Highest ceiling — highest p90_pts among UNLABELLED candidates.
  const ceilingWinner = candidates
    .filter(c => c.p90_pts !== undefined && !labelled.has(c.id))
    .reduce<MergedPlayer | null>(
      (best, c) => (c.p90_pts ?? -Infinity) > (best?.p90_pts ?? -Infinity) ? c : best,
      null,
    )
  if (ceilingWinner) {
    labelled.add(ceilingWinner.id)
    result.push({
      playerId: ceilingWinner.id,
      dimension: 'ceiling',
      label: 'Highest ceiling',
      value: `${(ceilingWinner.p90_pts ?? 0).toFixed(1)} pts`,
    })
  }

  // Dimension 3: Lowest floor — highest p10_pts (most reliable minimum, per D-16) among UNLABELLED.
  const floorWinner = candidates
    .filter(c => c.p10_pts !== undefined && !labelled.has(c.id))
    .reduce<MergedPlayer | null>(
      (best, c) => (c.p10_pts ?? -Infinity) > (best?.p10_pts ?? -Infinity) ? c : best,
      null,
    )
  if (floorWinner) {
    labelled.add(floorWinner.id)
    result.push({
      playerId: floorWinner.id,
      dimension: 'floor',
      label: 'Lowest floor',
      value: `${(floorWinner.p10_pts ?? 0).toFixed(1)} pts`,
    })
  }

  return result
}
