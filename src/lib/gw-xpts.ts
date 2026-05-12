// Phase 101 (GWT-01): computeGwXpts — TypeScript port of Python _xpts_per_gw.
// Pure function, no 'use client', no React, no side effects.
// Importable in @vitest-environment node tests.
// Source: pipeline/merge.py lines 122-147 (_cs_prob), 187-272 (_compute_xpts_fixture),
//         339-390 (_xpts_per_gw).
import type { MergedPlayer } from './types'

// FPL scoring constants — must match pipeline/merge.py exactly.
const GOAL_PTS: Record<number, number>   = { 1: 6, 2: 6, 3: 5, 4: 4 }
const ASSIST_PTS = 3
const CS_PTS: Record<number, number>     = { 1: 6, 2: 6, 3: 1, 4: 0 }
const BONUS_RATE: Record<number, number> = { 1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70 }

/** CS probability for a single fixture.
 * NOTE: xmins is the player-level aggregate (probability-weighted across horizon).
 * Used as a per-fixture proxy — FixtureEntry does not carry per-fixture xmins.
 * For DGW players this may overstate CS probability on the second fixture.
 * [VERIFIED: pipeline/merge.py _cs_prob() lines 123-147 — per-fixture mins arg]
 * High defensiveDifficulty = strong attacker = LOW CS probability. */
function csProb(defensiveDifficulty: number, xmins: number): number {
  const raw = Math.max(0.10, Math.min(0.65, 0.40 - defensiveDifficulty * 0.30))
  const minsFactor = Math.min(1.0, xmins / 60.0)
  return raw * minsFactor
}

/** xPts for a single fixture.
 *  [VERIFIED: pipeline/merge.py _compute_xpts_fixture(), lines 187-272]
 *  NOTE: lam_g / lam_a use xmins/90 directly — start_prob is already embedded in xmins.
 *  appearance_pts uses raw start_prob (it is per START, not per minute). */
function fixtureXpts(
  xg: number,
  xa: number,
  start_prob: number,
  xmins: number,
  element_type: number,
  defensiveDifficulty: number,
): number {
  if (xmins <= 0 || start_prob <= 0) return 0
  const scale = xmins / 90
  const goalPts   = xg * scale * (GOAL_PTS[element_type] ?? 4)
  const assistPts = xa * scale * ASSIST_PTS
  const csPts     = csProb(defensiveDifficulty, xmins) * (CS_PTS[element_type] ?? 0)
  const bonusPts  = (BONUS_RATE[element_type] ?? 0.5) * scale
  const appPts    = start_prob * 2   // appearance points: per START, NOT per minute
  return goalPts + assistPts + csPts + bonusPts + appPts
}

/** Compute expected xPts for a specific target GW.
 *  DGW: sums xPts across ALL fixtures matching event_id. BGW: returns 0.
 *  [VERIFIED: pipeline/merge.py _xpts_per_gw() lines 339-390] */
export function computeGwXpts(player: MergedPlayer, targetGw: number): number {
  if (player.start_prob <= 0 || player.xmins <= 0) return 0
  const fixtures = player.fixtures.filter(f => f.event_id === targetGw)
  if (fixtures.length === 0) return 0
  return fixtures.reduce((sum, f) =>
    sum + fixtureXpts(
      player.xg_per90 ?? 0,
      player.xa_per90 ?? 0,
      player.start_prob,
      player.xmins,
      player.element_type,
      f.defensive_difficulty ?? 0.5,
    ),
    0,
  )
}
