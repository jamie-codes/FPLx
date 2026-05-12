// Phase 96 BACK-01: captain regret computation + localStorage ring-buffer helpers.
// Pure module — no React, no fetch. Mirrors src/lib/setPieceLeague.ts conventions.
//
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-06 (formula)
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-11 (empty state semantics)
//   ROADMAP cross-cutting constraints (localStorage key `decisionHistory:teamId:{id}`, 38-GW ring buffer)
import type { RegretEntry, DecisionHistory } from './types'

/**
 * Maximum number of GW entries retained in the localStorage ring buffer.
 * Set to 38 = full Premier League season (ROADMAP cross-cutting constraint).
 */
export const RING_BUFFER_SIZE = 38

/**
 * D-06: signed captain regret in captain points (player points × 2).
 *
 *   regret = ceiling_pts × 2 − user_capt_pts × 2
 *
 * - `regret > 0` → model was better (user lost points by overriding).
 * - `regret < 0` → user beat the model.
 * - `regret === 0` → tied.
 * - `regret === null` → at least one side is unavailable (SC-5).
 */
export function computeRegret(
  ceilingPts: number | null,
  userCaptPts: number | null,
): number | null {
  if (ceilingPts === null || userCaptPts === null) return null
  // WR-01: round to 1dp to eliminate binary float representation noise
  // (e.g. 8.2*2 - 6.0*2 = 4.399999999999999 without rounding).
  return Math.round((ceilingPts * 2 - userCaptPts * 2) * 10) / 10
}

/** Aggregate season totals derived from a RegretEntry list. Null regret entries are skipped. */
export interface SeasonSummary {
  totalRegret: number
  gwsWithData: number
  modelBetter: number
  userWon: number
  tied: number
  // Phase 100 HIST-01: D-02 captain hit rate. A "hit" is a GW where regret <= 0
  // (user captain met or beat the model ceiling). captainHits = userWon + tied.
  // captainHitRate is null when gwsWithData === 0 (no GWs with both sides available).
  captainHitRate: number | null
  captainHits: number
}

/** Reduce RegretEntry array to season-level summary stats (D-07 + Phase 100 HIST-01 D-02). */
export function computeSeasonSummary(entries: RegretEntry[]): SeasonSummary {
  let totalRegret = 0
  let gwsWithData = 0
  let modelBetter = 0
  let userWon = 0
  let tied = 0
  for (const e of entries) {
    if (e.regret === null) continue
    totalRegret += e.regret
    gwsWithData += 1
    if (e.regret > 0) modelBetter += 1
    else if (e.regret < 0) userWon += 1
    else tied += 1
  }
  // Phase 100 HIST-01 (D-02): hits = userWon + tied (regret <= 0 GWs).
  // Null when gwsWithData === 0 — no data available for HIST-01 display.
  const captainHits = userWon + tied
  const captainHitRate = gwsWithData > 0 ? captainHits / gwsWithData : null
  return { totalRegret, gwsWithData, modelBetter, userWon, tied, captainHitRate, captainHits }
}

// ---------------------------------------------------------------------------
// localStorage ring buffer (ROADMAP cross-cutting constraint)
// Key format: `decisionHistory:teamId:{id}` — keyed by team ID so swapping
// teams in the UI does not corrupt the user's own cache.
// ---------------------------------------------------------------------------

/** Strict ring-buffer key format — must match the ROADMAP cross-cutting constraint. */
export function ringBufferKey(teamId: string): string {
  return `decisionHistory:teamId:${teamId}`
}

/**
 * SSR-safe localStorage read. Returns null on any failure (private mode, quota,
 * malformed JSON, server-render). Mirrors src/lib/manual-plan.ts loadManualPlan.
 */
export function loadCachedHistory(teamId: string): DecisionHistory | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ringBufferKey(teamId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<DecisionHistory>
    if (typeof candidate.teamId !== 'number') return null
    if (!Array.isArray(candidate.entries)) return null
    if (typeof candidate.gwsWithData !== 'number') return null
    return candidate as DecisionHistory
  } catch {
    return null
  }
}

/**
 * SSR-safe localStorage write. Trims entries to the last RING_BUFFER_SIZE
 * before persisting. Silently ignores storage errors (matches manual-plan.ts).
 */
export function persistHistory(teamId: string, history: DecisionHistory): void {
  if (typeof window === 'undefined') return
  try {
    const trimmedEntries = history.entries.slice(-RING_BUFFER_SIZE)
    const trimmed: DecisionHistory = {
      teamId: history.teamId,
      // CR-02: recount gwsWithData from the trimmed entries, not from the API
      // response. If the ring buffer sliced entries off the front, the original
      // gwsWithData count is stale and any direct consumer of data.gwsWithData
      // would see the wrong value.
      gwsWithData: trimmedEntries.filter((e) => e.regret !== null).length,
      entries: trimmedEntries,
    }
    window.localStorage.setItem(ringBufferKey(teamId), JSON.stringify(trimmed))
  } catch {
    // Silently ignore storage errors (private mode, quota exceeded)
  }
}
