import type { ScoredPlayer } from '@/lib/types'

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
  if (owned < DIFFERENTIAL_THRESHOLD) {
    reasons.push(`Differential \u2014 ${owned.toFixed(1)}% owned`)
  }

  return reasons
}
