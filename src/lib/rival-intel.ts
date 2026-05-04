// Phase 58 (ML-03..ML-07): rival-intel pure functions — differential intelligence engine.
//
// Sources of truth:
//   - .planning/phases/058-mini-league-rival-tracker/058-CONTEXT.md §decisions D-07, D-08, D-10
//   - .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Pattern 2, §Code Examples
//
// No 'use client' directive — this module is pure TypeScript and importable from
// both server and client contexts (mirrors src/lib/eo-candidates.ts and src/lib/suggest-transfers.ts).
//
// Position median semantics replicate pipeline/merge.py _compute_differential_flag:
// exclude xPts_1gw === undefined and xPts_1gw === 0 (only "active" players contribute).
import type { MergedPlayer, PositionCode, TransferSuggestion } from './types'

/**
 * ML-03: Players owned by both user and rival. Returns FPL element IDs in user-set
 * iteration order. Set intersection — O(n).
 */
export function computeShared(userIds: Set<number>, rivalIds: Set<number>): number[] {
  return [...userIds].filter(id => rivalIds.has(id))
}

/**
 * ML-04: Players the user owns that the rival does not (user differential upside).
 * Set difference user − rival, in user-set iteration order. O(n).
 */
export function computeUserAdvantage(userIds: Set<number>, rivalIds: Set<number>): number[] {
  return [...userIds].filter(id => !rivalIds.has(id))
}

/**
 * Per-position xPts_1gw median across the active player pool. Mirrors the Python
 * _compute_differential_flag in pipeline/merge.py (Phase 30): exclude undefined
 * and 0-valued xPts_1gw (BGW or pre-pipeline rows). Returns 0 for positions with
 * no eligible players.
 */
export function computePositionMedians(players: MergedPlayer[]): Map<PositionCode, number> {
  const byPos = new Map<PositionCode, number[]>([[1, []], [2, []], [3, []], [4, []]])
  for (const p of players) {
    const x = p.xPts_1gw
    if (x === undefined || x <= 0) continue
    byPos.get(p.element_type)?.push(x)
  }
  const out = new Map<PositionCode, number>()
  for (const [pos, vals] of byPos) {
    if (vals.length === 0) { out.set(pos, 0); continue }
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
    out.set(pos, median)
  }
  return out
}

/**
 * ML-05 (D-08): Rival-owned, non-user-owned players whose xPts_1gw is STRICTLY
 * greater than their position's median. Returns full MergedPlayer objects so the
 * detail panel can render web_name + xPts directly.
 */
export function computeRivalThreats(
  rivalIds: Set<number>,
  userIds: Set<number>,
  playerById: Map<number, MergedPlayer>,
  posMedians: Map<PositionCode, number>,
): MergedPlayer[] {
  const out: MergedPlayer[] = []
  for (const id of rivalIds) {
    if (userIds.has(id)) continue
    const p = playerById.get(id)
    if (!p) continue
    const x = p.xPts_1gw
    if (x === undefined) continue
    const median = posMedians.get(p.element_type) ?? 0
    if (x > median) out.push(p)
  }
  return out
}

/**
 * ML-06 (D-10): Filter `suggestTransfers()` output to entries where AT LEAST ONE buy
 * is (a) not in rivalIds and (b) has xPts_1gw above its position median.
 *
 * For 'single' suggestions: include when buy.id ∉ rivalIds AND buy.xPts_1gw > posMedian.
 * For 'combo' suggestions: include when ANY of the two transfer legs satisfies the
 * same condition (per test contract: a combo is a "blocking" candidate as long as
 * one of its legs blocks a rival).
 */
export function computeBlockingMoves(
  suggestions: TransferSuggestion[],
  rivalIds: Set<number>,
  posMedians: Map<PositionCode, number>,
): TransferSuggestion[] {
  const qualifies = (buy: MergedPlayer): boolean => {
    if (rivalIds.has(buy.id)) return false
    const x = buy.xPts_1gw
    if (x === undefined) return false
    const median = posMedians.get(buy.element_type) ?? 0
    return x > median
  }
  return suggestions.filter(s => {
    if (s.kind === 'single') return qualifies(s.buy)
    return s.transfers.some(t => qualifies(t.buy))
  })
}

/**
 * ML-07: Captain edge in xPts_90th_1gw — userCaptain − rivalCaptain.
 * Returns null when either side is missing the player object or the xPts_90th_1gw field
 * (e.g. rival captain is null pre-deadline; user has no squad loaded).
 * Caller is responsible for sign-prefixing and rounding to 1 decimal place.
 */
export function computeCaptainEdge(
  userCaptain: MergedPlayer | null,
  rivalCaptain: MergedPlayer | null,
): number | null {
  const u = userCaptain?.xPts_90th_1gw
  const r = rivalCaptain?.xPts_90th_1gw
  if (u === undefined || u === null) return null
  if (r === undefined || r === null) return null
  return u - r
}
