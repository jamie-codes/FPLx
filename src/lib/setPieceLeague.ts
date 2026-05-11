// Phase 95 SPQ-04: set-piece delivery league table aggregation.
// Sources of truth:
//   - .planning/phases/95-set-piece-delivery-league-table/95-CONTEXT.md §D-01..D-06
//   - .planning/phases/95-set-piece-delivery-league-table/95-UI-SPEC.md §aggregateSetPieceLeague
// Wave 0 stub — all functions throw; real implementation in 095-02-PLAN.md (Wave 1).
import type { SetPieceChanges } from './types'

export interface LeagueRow {
  team_id: number
  team_short_name: string
  composite: number | null
  corner_score: number | null
  fk_score: number | null
  sample_n: number
  primary_taker_name: string
}

export interface LeagueTable {
  ranked: LeagueRow[]
  insufficient: LeagueRow[]
}

/** D-01/D-02: composite = mean of available dimensions; null when both null. */
export function computeCompositeScore(
  _corner: number | null | undefined,
  _fk: number | null | undefined,
): number | null {
  throw new Error('not implemented')
}

/** D-04: raw EB score → per-100-deliveries string, 1 dp. Null/undefined → '—'. */
export function formatScore(_raw: number | null | undefined): string {
  throw new Error('not implemented')
}

/** SPQ-04: aggregates SetPieceChanges into ranked + insufficient rows (D-01..D-06). */
export function aggregateSetPieceLeague(_changes: SetPieceChanges): LeagueTable {
  throw new Error('not implemented')
}
