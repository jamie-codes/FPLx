// Phase 64 + 93 (SENS-01): computeFragility — pure tristate fragility detector.
// Sources of truth:
//   - .planning/phases/064-sensitivity-analysis/064-CONTEXT.md §decisions D-04 through D-12 (Phase 64 baseline)
//   - .planning/phases/93-sensitivity-analysis-enhancements/93-CONTEXT.md §decisions D-01 through D-13 (Phase 93 extension)
//
// 5 perturbations (each independently checks whether the recommendation reverses):
//   (a) start_prob -= 0.15           → reverses if (start_prob - 0.15) < 0.70
//   (b) mins_60_prob -= 0.10         → reverses if (mins_60_prob - 0.10) < 0.60 (skip when undefined)
//   (c) fixture difficulty +1 tier   → reverses on easy→medium and medium→hard (skip on hard, skip on BGW)
//   (d) cost += £0.5m                → reverses if (isTransfer && xPtsGain < 5.0); captain path skips
//   (e) news flips to "doubt"        → reverses if currentChance > 50 (already-doubtful skips; undefined skips)
//
// Tier mapping (D-06):
//   reversalCount === 0  → 'robust'
//   reversalCount === 1  → 'fragile'
//   reversalCount >= 2   → 'knife_edge'
//
// Public signature unchanged from Phase 64; only the return shape widens
// from `{ fragile: boolean, reasons }` to `{ tier: FragilityTier, reasons }`.

import type { MergedPlayer } from '@/lib/types'

// ---- Reason-string constants ---------------------------------------------
// Phase 64 (preserved unchanged):
export const FRAGILITY_START_PROB     = 'start_prob < 70%'
export const FRAGILITY_HARDER_FIXTURE = 'harder fixture'
// Phase 93 (new):
export const FRAGILITY_MINS60         = 'mins_60_prob < 60%'
export const FRAGILITY_NEWS_DOUBT     = 'news doubt'
// Hit-cost reason kept as a literal in Phase 64 vocabulary; exported for symmetry.
export const FRAGILITY_HIT            = 'taken as a hit (-4pt)'

// ---- Perturbation deltas (named constants — ROADMAP cross-cutting) -------
export const PERTURB_START_PROB = -0.15
export const PERTURB_MINS60     = -0.10
export const PERTURB_COST       = 5      // tenths of £m (0.5m). MergedPlayer.now_cost is in tenths.
export const PERTURB_NEWS_DOUBT = 50     // simulated chance_of_playing_next_round value

// ---- Internal thresholds --------------------------------------------------
const START_PROB_FLOOR        = 0.70    // Phase 64 D-07
const MINS60_FLOOR            = 0.60    // Phase 93 D-02
const COST_HIT_XPTS_THRESHOLD = 5.0     // Phase 93 D-04 (tightened from Phase 64's 4.0)
const NEWS_DOUBT_CEILING      = 50      // Phase 93 D-05 — at-or-below means already doubtful

// ---- Tier mapping --------------------------------------------------------
export type FragilityTier = 'robust' | 'fragile' | 'knife_edge'

export interface FragilityResult {
  tier: FragilityTier
  reasons: string[]
}

function tierFor(reversalCount: number): FragilityTier {
  if (reversalCount === 0) return 'robust'
  if (reversalCount === 1) return 'fragile'
  return 'knife_edge'
}

// ---- computeFragility ----------------------------------------------------
export function computeFragility(
  player: MergedPlayer,
  isTransfer: boolean,
  xPtsGain?: number,
): FragilityResult {
  const reasons: string[] = []

  // (a) start_prob perturbation — applies to both paths
  if (player.start_prob + PERTURB_START_PROB < START_PROB_FLOOR) {
    reasons.push(FRAGILITY_START_PROB)
  }

  // (b) mins_60_prob perturbation — skip when undefined (D-02)
  if (
    player.mins_60_prob !== undefined &&
    player.mins_60_prob + PERTURB_MINS60 < MINS60_FLOOR
  ) {
    reasons.push(FRAGILITY_MINS60)
  }

  // (c) fixture +1 tier perturbation — BGW guard, hard skip (D-03)
  // medium→hard triggers (Phase 64 baseline); hard→(none) skips
  if (
    player.fixtures.length > 0 &&
    player.fixtures[0].difficulty_tier === 'medium'
  ) {
    reasons.push(FRAGILITY_HARDER_FIXTURE)
  }

  // (d) cost += £0.5m perturbation — transfer-only (D-04, isTransfer guard)
  if (
    isTransfer &&
    xPtsGain !== undefined &&
    xPtsGain < COST_HIT_XPTS_THRESHOLD
  ) {
    reasons.push(FRAGILITY_HIT)
  }

  // (e) news flips to "doubt" perturbation — skip when already doubtful or undefined (D-05)
  // Only applies when chance_of_playing_next_round is explicitly set (not undefined).
  if (player.chance_of_playing_next_round !== undefined) {
    const currentChance = player.chance_of_playing_next_round ?? 100
    if (currentChance > NEWS_DOUBT_CEILING) {
      reasons.push(FRAGILITY_NEWS_DOUBT)
    }
  }

  return { tier: tierFor(reasons.length), reasons }
}
