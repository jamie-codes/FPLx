import { z } from 'zod'

export const FPLElementSchema = z.object({
  id:                                    z.number().int(),
  code:                                  z.number().int(),
  web_name:                              z.string(),
  team:                                  z.number().int(),
  element_type:                          z.number().int(),
  now_cost:                              z.number().int(),
  selected_by_percent:                   z.string(),
  form:                                  z.string(),
  status:                                z.string(),
  minutes:                               z.number().int(),
  starts:                                z.number().int(),
  defensive_contribution:                z.number().int().nullable(),
  defensive_contribution_per_90:         z.number().nullable(),
  clearances_blocks_interceptions:       z.number().int().nullable(),
  direct_freekicks_order:                z.number().int().nullable(),
  penalties_order:                       z.number().int().nullable(),
  corners_and_indirect_freekicks_order:  z.number().int().nullable(),
  news:                                  z.string(),
})

export type FPLElementRaw = z.infer<typeof FPLElementSchema>

export const FPLTeamSchema = z.object({
  id:         z.number().int(),
  name:       z.string(),
  short_name: z.string(),
  code:       z.number().int(),
})

export const FPLEventSchema = z.object({
  id:            z.number().int(),
  is_current:    z.boolean(),
  is_next:       z.boolean(),
  finished:      z.boolean(),
  deadline_time: z.string(),  // ISO 8601 — added Phase 58 D-05 for rival captain deadline gate
  data_checked:  z.boolean(),  // Phase 98 D-06: gate for settled GW detection (finished && data_checked)
})

export const FPLBootstrapSchema = z.object({
  elements: z.array(FPLElementSchema),
  teams:    z.array(FPLTeamSchema),
  events:   z.array(FPLEventSchema),
})

export type FPLBootstrap = z.infer<typeof FPLBootstrapSchema>

/**
 * Parse and validate FPL bootstrap-static response.
 * Returns { success: true, data } or { success: false, error }.
 * Caller decides whether to throw or serve stale cache on failure (per D-06).
 */
export function parseFPLBootstrap(raw: unknown) {
  return FPLBootstrapSchema.safeParse(raw)
}
