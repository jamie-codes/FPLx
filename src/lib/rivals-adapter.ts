// Phase 58 (ML-01, ML-08): Zod schemas for the FPL endpoints consumed by useRivals.
// Source: .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Code Examples
//         .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Common Pitfalls Pitfall 3
// Mirrors src/lib/squad-adapter.ts schema+parse-helper pattern.
import { z } from 'zod'
import { SquadPickSchema } from '@/lib/squad-adapter'

/**
 * `leagues-classic/{leagueId}/standings/` response shape.
 * Pitfall 3: the result list is nested at `standings.standings.results`.
 * `entry` is the manager's team ID (used to fetch picks/history).
 */
export const LeagueStandingsEntrySchema = z.object({
  id:           z.number().int(),
  entry:        z.number().int(),    // FPL team/manager ID
  entry_name:   z.string(),
  player_name:  z.string(),
  rank:         z.number().int(),
})

export const LeagueStandingsResponseSchema = z.object({
  standings: z.object({
    results:  z.array(LeagueStandingsEntrySchema),
    has_next: z.boolean().optional(),
    page:     z.number().int().optional(),
  }),
})

/**
 * `entry/{entryId}/event/{gw}/picks/` response shape (rival picks).
 * Same picks array as our own squad endpoint — re-uses SquadPickSchema.
 */
export const RivalPicksResponseSchema = z.object({
  active_chip: z.string().nullable().optional(),
  picks:       z.array(SquadPickSchema),
})

/**
 * `entry/{entryId}/history/` response shape — only `chips` is consumed.
 * `current` and `past` arrays are present in the live API but ignored here.
 */
export const ChipHistoryEntrySchema = z.object({
  name:  z.string(),       // 'bboost' | '3xc' | 'freehit' | 'wildcard'
  time:  z.string(),
  event: z.number().int(),
})

export const RivalHistoryResponseSchema = z.object({
  chips: z.array(ChipHistoryEntrySchema).optional(),
})

export type LeagueStandingsEntry  = z.infer<typeof LeagueStandingsEntrySchema>
export type LeagueStandingsResponse = z.infer<typeof LeagueStandingsResponseSchema>
export type RivalPicksResponse    = z.infer<typeof RivalPicksResponseSchema>
export type ChipHistoryEntryRaw   = z.infer<typeof ChipHistoryEntrySchema>
export type RivalHistoryResponse  = z.infer<typeof RivalHistoryResponseSchema>

export function parseLeagueStandings(data: unknown) {
  return LeagueStandingsResponseSchema.safeParse(data)
}
export function parseRivalPicks(data: unknown) {
  return RivalPicksResponseSchema.safeParse(data)
}
export function parseRivalHistory(data: unknown) {
  return RivalHistoryResponseSchema.safeParse(data)
}

/**
 * Canonical chip ordering used to derive `chipsRemaining`. Source: useChipHistory.ts.
 * Mirror exactly so chip-display order is consistent across the app.
 */
export const CHIP_NAMES = ['bboost', '3xc', 'freehit', 'wildcard'] as const
export type ChipName = typeof CHIP_NAMES[number]
