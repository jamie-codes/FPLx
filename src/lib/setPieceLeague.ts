// Phase 95 SPQ-04: set-piece delivery league table aggregation.
// Sources of truth:
//   - .planning/phases/95-set-piece-delivery-league-table/95-CONTEXT.md §D-01..D-06
//   - .planning/phases/95-set-piece-delivery-league-table/95-UI-SPEC.md §aggregateSetPieceLeague
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
  corner: number | null | undefined,
  fk: number | null | undefined,
): number | null {
  const c = corner ?? null
  const f = fk ?? null
  if (c !== null && f !== null) return (c + f) / 2
  if (c !== null) return c
  if (f !== null) return f
  return null
}

/** D-04: raw EB score → per-100-deliveries string, 1 dp. Null/undefined → '—'. */
export function formatScore(raw: number | null | undefined): string {
  if (raw === null || raw === undefined) return '—'
  return (raw * 100).toFixed(1)
}

/** SPQ-04: aggregates SetPieceChanges into ranked + insufficient rows (D-01..D-06). */
export function aggregateSetPieceLeague(changes: SetPieceChanges): LeagueTable {
  const ranked: LeagueRow[] = []
  const insufficient: LeagueRow[] = []

  for (const team of changes.teams) {
    const corner = team.corner_taker.corner_danger_score ?? null
    const fk = team.fk_taker.fk_danger_score ?? null
    const composite = computeCompositeScore(corner, fk)
    const cornerSample = team.corner_taker.sp_sample_n ?? 0
    const fkSample =
      team.fk_taker.id !== null &&
      team.fk_taker.id === team.corner_taker.id
        ? 0  // same player — sp_sample_n already counted via corner_taker
        : (team.fk_taker.sp_sample_n ?? 0)
    const sample_n = cornerSample + fkSample
    const primary_taker_name = team.corner_taker.name || '—'

    const row: LeagueRow = {
      team_id: team.team_id,
      team_short_name: team.team_short_name,
      composite,
      corner_score: corner,
      fk_score: fk,
      sample_n,
      primary_taker_name,
    }

    if (composite !== null) {
      ranked.push(row)
    } else {
      insufficient.push(row)
    }
  }

  // D-06: sort ranked descending by composite; alphabetical tie-breaker
  ranked.sort((a, b) => {
    const diff = (b.composite as number) - (a.composite as number)
    if (diff !== 0) return diff
    return a.team_short_name.localeCompare(b.team_short_name)
  })

  // Sort insufficient alphabetically
  insufficient.sort((a, b) => a.team_short_name.localeCompare(b.team_short_name))

  return { ranked, insufficient }
}
