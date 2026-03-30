import { z } from 'zod'

export const SquadPickSchema = z.object({
  element:          z.number().int(),
  position:         z.number().int(),
  multiplier:       z.number().int(),
  is_captain:       z.boolean(),
  is_vice_captain:  z.boolean(),
})

export const EntryHistorySchema = z.object({
  event:                  z.number().int(),
  bank:                   z.number(),           // tenths of £1m (e.g. 15 = £1.5m)
  event_transfers:        z.number().int(),
  event_transfers_cost:   z.number().int(),
  value:                  z.number(),           // tenths of £1m
})

export const SquadPicksResponseSchema = z.object({
  active_chip:    z.string().nullable(),
  picks:          z.array(SquadPickSchema),
  entry_history:  EntryHistorySchema,
})

export type SquadPicksResponse = z.infer<typeof SquadPicksResponseSchema>
export type SquadPick = z.infer<typeof SquadPickSchema>
export type EntryHistory = z.infer<typeof EntryHistorySchema>

/**
 * Parse and validate the FPL entry/{id}/event/{gw}/picks/ response.
 * Returns { success: true, data } or { success: false, error }.
 * Follows the same pattern as parseFPLBootstrap in fpl-adapter.ts.
 */
export function parseSquadResponse(data: unknown) {
  return SquadPicksResponseSchema.safeParse(data)
}

/**
 * MyTeamPickSchema extends SquadPickSchema with selling_price.
 * selling_price is only available from the authenticated /api/my-team/ endpoint.
 * Unit: tenths of £1m (same as now_cost, bank, value).
 */
export const MyTeamPickSchema = SquadPickSchema.extend({
  selling_price: z.number().int(),  // exact sell price in tenths of £1m
})

/**
 * MyTeamResponseSchema validates the full /api/my-team/ response.
 * Separate from SquadPicksResponseSchema — the my-team endpoint requires auth
 * and includes selling_price; the public picks endpoint does not.
 */
export const MyTeamResponseSchema = z.object({
  picks: z.array(MyTeamPickSchema),
  entry_history: EntryHistorySchema,
})

export type MyTeamPick = z.infer<typeof MyTeamPickSchema>
export type MyTeamResponse = z.infer<typeof MyTeamResponseSchema>

/**
 * Parse and validate the FPL /api/my-team/ authenticated response.
 * Returns { success: true, data } or { success: false, error }.
 * Follows the same pattern as parseSquadResponse.
 */
export function parseMyTeamResponse(data: unknown) {
  return MyTeamResponseSchema.safeParse(data)
}
