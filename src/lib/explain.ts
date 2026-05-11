import type { ScoredPlayer } from '@/lib/types'
import type { LifecycleLabel } from '@/lib/lifecycle-label'
import { computeFragility } from '@/lib/sensitivity'
import { computePositionAverages } from '@/lib/recommend'

// Threshold constants (exported for test visibility, matching recommend.ts pattern)
export const FORM_POSITIVE_THRESHOLD = 5.0
export const FORM_NEGATIVE_THRESHOLD = 3.0
export const START_PROB_HIGH = 0.85
export const START_PROB_LOW = 0.65
export const XG_HIGH = 0.30
export const XG_LOW = 0.05
export const XA_HIGH = 0.15
export const DIFFERENTIAL_THRESHOLD = 10.0
export const EASY_FIXTURE_MIN = 2
export const HARD_FIXTURE_MIN = 3

export function computeExplanations(player: ScoredPlayer): string[] {
  const reasons: string[] = []

  // Fixtures: count easy/hard from difficulty_tier
  const easyCount = player.fixtures.filter(f => f.difficulty_tier === 'easy').length
  const hardCount = player.fixtures.filter(f => f.difficulty_tier === 'hard').length
  if (easyCount >= EASY_FIXTURE_MIN) {
    reasons.push(`Strong fixture run \u2014 ${easyCount} easy games next 5 GWs`)
  } else if (hardCount >= HARD_FIXTURE_MIN) {
    reasons.push(`Difficult fixtures \u2014 ${hardCount} hard games next 5 GWs`)
  }

  // Form
  if (player.form_pts_per90 >= FORM_POSITIVE_THRESHOLD) {
    reasons.push(`In form \u2014 ${player.form_pts_per90.toFixed(1)} pts/90 last 5 GWs`)
  } else if (player.form_pts_per90 < FORM_NEGATIVE_THRESHOLD) {
    reasons.push(`Poor form \u2014 ${player.form_pts_per90.toFixed(1)} pts/90 last 5 GWs`)
  }

  // Projected points (always show)
  reasons.push(`Projected ${(player.xPts_1gw ?? 0).toFixed(1)} pts next GW`)

  // Start probability
  const startPct = Math.round(player.start_prob * 100)
  if (player.start_prob >= START_PROB_HIGH) {
    reasons.push(`High start probability (${startPct}%)`)
  } else if (player.start_prob < START_PROB_LOW) {
    reasons.push(`Low start probability (${startPct}%)`)
  }

  // xG (null-safe; low xG only for MID=3 and FWD=4 per Research open Q2)
  if (player.xg_per90 !== null && player.xg_per90 >= XG_HIGH) {
    reasons.push(`High xG \u2014 ${player.xg_per90.toFixed(2)}/90`)
  } else if (
    player.xg_per90 !== null &&
    (player.element_type === 3 || player.element_type === 4) &&
    player.xg_per90 < XG_LOW
  ) {
    reasons.push(`Low xG \u2014 ${player.xg_per90.toFixed(2)}/90`)
  }

  // xA (null-safe)
  if (player.xa_per90 !== null && player.xa_per90 >= XA_HIGH) {
    reasons.push(`Creative \u2014 ${player.xa_per90.toFixed(2)} xA/90`)
  }

  // Set piece roles
  if (player.penalties_order === 1) reasons.push('Primary penalty taker')
  if (player.direct_freekicks_order === 1) reasons.push('Direct free-kick taker')
  if (player.corners_and_indirect_freekicks_order === 1) reasons.push('Corner/set piece taker')

  // Differential (parseFloat per Pitfall 2 -- selected_by_percent is a string)
  const owned = parseFloat(player.selected_by_percent)
  if (!isNaN(owned) && owned < DIFFERENTIAL_THRESHOLD) {
    reasons.push(`Differential \u2014 ${owned.toFixed(1)}% owned`)
  }

  return reasons
}

// ---------------------------------------------------------------------------
// Phase 65 (WHY-01): computeRejection — adaptive "why not?" rejection engine.
//
// Sources of truth:
//   - .planning/phases/065-rejection-explainer/065-CONTEXT.md §decisions D-04 .. D-07
//   - .planning/phases/065-rejection-explainer/065-UI-SPEC.md §Copywriting Contract
//   - .planning/phases/065-rejection-explainer/065-RESEARCH.md §Pattern 1 + Open Q1 (medium AND hard fixtures count)
// ---------------------------------------------------------------------------

export const REJECTION_START_PROB_THRESHOLD = 0.70
export const REJECTION_OWNERSHIP_THRESHOLD = 20.0
// Phase 94 D-01: form-signal rejection threshold (matches FORM_NEGATIVE_THRESHOLD value but kept as a separate named constant per CONTEXT.md "separate-but-equal" intent).
export const REJECTION_FORM_THRESHOLD = 3.0
// Phase 94 D-02: price-trend rejection sentinel — cost_change_event < 0 means falling this GW.
export const REJECTION_PRICE_FALLING = 0

const POSITION_CODES: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

export interface RejectionResult {
  /** Empty array => positive framing ("No rejection signals — ranked #X..."). Non-empty => caller renders "Why not recommended:" header + <ul>. */
  reasons: string[]
  /** 1-based rank within position by xPts_1gw descending. */
  xPtsRank: number
}

/**
 * Compute the natural-language "why not?" rejection signals for a single player.
 *
 * Adaptive framing (D-04):
 *   - Strong player (gem_score >= positionAverage AND no fragility AND start_prob >= 0.70)
 *     => returns { reasons: [], xPtsRank } so caller renders "No rejection signals" copy.
 *   - Otherwise => returns rejection reasons in D-07 order:
 *     rank, rotation risk, fixture difficulty, fragility (delegated), ownership context.
 *
 * @param player     The target ScoredPlayer to explain.
 * @param allPlayers Full ScoredPlayer population (used for position rank + averages).
 */
export function computeRejection(
  player: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  lifecycleLabels: Map<number, LifecycleLabel>,  // Phase 94 D-05: 3rd required param; pass new Map() when squad context unavailable
): RejectionResult {
  // Step 1 (D-05): rank within position by xPts_1gw descending.
  const samePosition = allPlayers
    .filter(p => p.element_type === player.element_type)
    .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
  const rawIndex = samePosition.findIndex(p => p.id === player.id)
  const xPtsRank = rawIndex === -1 ? samePosition.length + 1 : rawIndex + 1

  // Step 2 (D-04): adaptive framing threshold check.
  const positionAverages = computePositionAverages(allPlayers)
  const posAvg = positionAverages.get(player.element_type) ?? 0.5
  const { reasons: fragilityReasons } = computeFragility(player, false) // Pitfall 4: isTransfer=false

  const isStrong =
    player.gem_score >= posAvg &&
    fragilityReasons.length === 0 &&
    player.start_prob >= REJECTION_START_PROB_THRESHOLD

  if (isStrong) {
    // Positive framing — caller renders "No rejection signals" line using xPtsRank.
    return { reasons: [], xPtsRank }
  }

  // Step 3 (D-07): rejection reasons in fixed order: rank, start_prob, fixture, fragility, ownership.
  const reasons: string[] = []
  const posCode = POSITION_CODES[player.element_type] ?? '??'

  // 3a. Rank label (always first when not strong).
  reasons.push(`Ranked #${xPtsRank} at ${posCode} by xPts`)

  // 3b. Rotation risk.
  if (player.start_prob < REJECTION_START_PROB_THRESHOLD) {
    const startPct = Math.round(player.start_prob * 100)
    reasons.push(`Rotation risk — start probability ${startPct}%`)
  }

  // 3c. Form signal (Phase 94 D-01: after start_prob, before fixture).
  if (player.form_pts_per90 < REJECTION_FORM_THRESHOLD) {
    reasons.push(`Poor form — ${player.form_pts_per90.toFixed(1)} pts/90 last 5 GWs`)
  }

  // 3d. Fixture difficulty — hard fixtures only. Medium fixtures are handled by computeFragility
  //     in step 3e ('harder fixture' reason), so restricting to hard here prevents double-reporting
  //     when difficulty_tier === 'medium' (WR-03).
  if (
    player.fixtures.length > 0 &&
    player.fixtures[0].difficulty_tier === 'hard'
  ) {
    reasons.push(`Difficult fixture (FDR hard)`)
  }

  // 3e. Price trend (Phase 94 D-02: after fixture, before fragility).
  if (player.cost_change_event < REJECTION_PRICE_FALLING) {
    const tenths = player.cost_change_event  // e.g. -1 -> "-0.1m"
    reasons.push(`Price falling this GW (${(tenths / 10).toFixed(1)}m)`)
  }

  // 3f. Fragility flags (delegated — Don't Hand-Roll). Each fragility reason becomes
  //     a "Fragile: no longer recommended if: <reason>" line.
  for (const r of fragilityReasons) {
    reasons.push(`Fragile: no longer recommended if: ${r}`)
  }

  // 3g. Lifecycle label (Phase 94 D-04: after fragility, before ownership).
  const lifecycle = lifecycleLabels.get(player.id)
  if (lifecycle === 'sell') {
    reasons.push(`Lifecycle: Sell — significantly below position average`)
  } else if (lifecycle === 'sell_soon') {
    reasons.push(`Lifecycle: Sell soon — approaching sell threshold`)
  }

  // 3h. Ownership context — ALWAYS last (parseFloat per Pitfall 2).
  const ownedRaw = parseFloat(player.selected_by_percent)
  const owned = !isNaN(ownedRaw) ? Math.round(ownedRaw) : 0
  reasons.push(`Owned by ${owned}% of managers`)

  return { reasons, xPtsRank }
}

/**
 * Phase 94 WHY-01-B (SC-4): head-to-head comparison via COMPOSITION.
 *
 * Composes computeRejection(x) and computeRejection(y) and returns the rejection
 * reason strings that Y has but X does not. Interpreted by callers as
 * "X beats Y on these predicates" or equivalently "Y was penalised for these
 * reasons that X was not."
 *
 * SC-4 mandate (ROADMAP §Phase 94): "the head-to-head explainer composes
 * computeRejection(playerA) and computeRejection(playerB) outputs rather than
 * duplicating predicate evaluation." This implementation MUST NOT duplicate any
 * predicate logic from computeRejection — it strictly composes and diffs.
 *
 * Sources of truth:
 *   - .planning/ROADMAP.md §Phase 94 SC-4
 *   - .planning/phases/94-rejection-explainer-enhancements/94-CONTEXT.md §decisions D-11 D-12
 *   - .planning/phases/94-rejection-explainer-enhancements/94-UI-SPEC.md §Copywriting Contract
 *
 * @param x  The "winning" player (the one whose row is expanded / the comparator's reference)
 * @param y  The comparison player
 * @param allPlayers  Population for xPts ranking inside computeRejection
 * @param lifecycleLabels  Optional — pass empty Map when no squad context (D-05)
 * @returns Y's rejection reasons that X does not share. Empty array when reason sets are identical (D-11 zero-predicate case).
 */
export function computeHeadToHead(
  x: ScoredPlayer,
  y: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  lifecycleLabels?: Map<number, LifecycleLabel>,
): string[] {
  const labels = lifecycleLabels ?? new Map<number, LifecycleLabel>()
  const xResult = computeRejection(x, allPlayers, labels)
  const yResult = computeRejection(y, allPlayers, labels)
  return yResult.reasons.filter(r => !xResult.reasons.includes(r))
}
