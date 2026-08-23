import type { ScoredPlayer } from '@/lib/types'
import type { ClubForm } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'
import { computePositionAverages, BENCH_ENABLER_MAX_COST } from '@/lib/recommend'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Seven-label lifecycle label for a squad player.
 *
 * Priority order (highest first):
 * 1. minutes_trap   — expensive player with rotation/cameo minutes risk
 * 2. fixture_trap   — TRAP flag player with worsening fixtures
 * 3. buy_next_week  — hold-band player with immediate fixture improvement (swing_1gw)
 * 4. hold_one_more  — hold-band player with broader 3 GW improvement (swing_3gw)
 * 5. sell_soon      — warning band (within 5-15% below position average)
 * 6. sell           — hard sell threshold crossed (>15% below position average)
 * 7. hold           — default fallback
 */
export type LifecycleLabel =
  | 'minutes_trap'
  | 'fixture_trap'
  | 'buy_next_week'
  | 'hold_one_more'
  | 'sell_soon'
  | 'sell'
  | 'hold'

// ---------------------------------------------------------------------------
// Threshold constants (exported for test visibility — matches recommend.ts convention)
// ---------------------------------------------------------------------------

/**
 * Hard Sell line — gem_score < posAvg * SELL_THRESHOLD triggers 'sell'.
 * Replaces recommend.ts 0.90 for this engine (wider hysteresis per ROADMAP §Phase 49).
 */
export const SELL_THRESHOLD = 0.85

/**
 * Warning band entry — gem_score < posAvg * SELL_SOON_THRESHOLD && >= posAvg * SELL_THRESHOLD
 * triggers 'sell_soon'.
 */
export const SELL_SOON_THRESHOLD = 0.90

/**
 * Fixture swing threshold — Phase 47 D-01 confirmed (0.20 delta).
 * Used for Buy Next Week (swing_1gw) and Hold One More (swing_3gw) positive triggers,
 * and for Fixture Trap (swing_3gw negative) detection.
 */
export const SWING_THRESHOLD = 0.20

/**
 * Minutes Trap minimum cost gate — £7.0m (70 in tenths).
 * Prevents misfiring on cheap budget rotators (ROADMAP §Phase 49 notes).
 */
export const MINUTES_TRAP_MIN_COST = 70

/**
 * Minutes Trap start probability ceiling — below this threshold (< 0.65) the player
 * is not reliably starting. Cross-references MinsRiskBadge and explain.ts START_PROB_LOW.
 */
export const MINUTES_TRAP_START_PROB = 0.65

// ---------------------------------------------------------------------------
// Shared label explanations (single source of truth for hover tooltips)
//
// Interpolated from the threshold constants above so a retune can never leave
// the UI quoting numbers the engine no longer uses. Consumed by
// LifecycleLabelBadge (Transfers/Cockpit) and home-logic badgeFor (Home strip).
// ---------------------------------------------------------------------------

const pctBelow = (threshold: number) => Math.round((1 - threshold) * 100)

export const LABEL_EXPLANATIONS: Record<LifecycleLabel, string> = {
  buy_next_week: 'Buy Next Week: hold-band gem score but immediate fixture improvement incoming.',
  hold_one_more: 'Hold One More: fixtures improving over 3 GWs — gem score may recover.',
  sell_soon: `Sell Soon: gem score ${pctBelow(SELL_SOON_THRESHOLD)}–${pctBelow(SELL_THRESHOLD)}% below the position average — consider timing your exit.`,
  minutes_trap: `Minutes Trap: £${(MINUTES_TRAP_MIN_COST / 10).toFixed(1)}m+ player with rotation risk — start probability under ${Math.round(MINUTES_TRAP_START_PROB * 100)}%.`,
  fixture_trap: 'Fixture Trap: high-ownership player with below-average returns and fixtures worsening over the next 3 GWs.',
  hold: 'Hold: gem score within the normal band for this position — no action needed.',
  sell: `Sell: gem score more than ${pctBelow(SELL_THRESHOLD)}% below the position average — transfer out candidate.`,
}

// ---------------------------------------------------------------------------
// Core function: computeLifecycleLabel
// ---------------------------------------------------------------------------

/**
 * Compute a single lifecycle label for a squad player.
 *
 * The label is determined by a priority-ordered cascade of conditions.
 * When multiple conditions apply, exactly one label is returned (highest priority).
 *
 * @param player   - ScoredPlayer (has gem_score + all MergedPlayer fields)
 * @param posAvg   - position average gem_score for player.element_type
 *                   (from computePositionAverages — pass pre-computed value for testability)
 * @param clubForm - ClubForm for player's team (null when team not found or BGW)
 *                   All swing comparisons use `?? 0` so null means "no swing signal" (neutral).
 * @returns        Exactly one LifecycleLabel
 */
export function computeLifecycleLabel(
  player: ScoredPlayer,
  posAvg: number,
  clubForm: ClubForm | null,
): LifecycleLabel {
  const gem = player.gem_score

  // ----- Priority 1: Minutes Trap -----
  // Expensive player whose minutes risk makes ownership questionable.
  // Price gate (>= £7.0m) prevents misfiring on cheap rotators.
  if (
    player.now_cost >= MINUTES_TRAP_MIN_COST &&
    (player.mins_risk === 'rotation_risk' || player.mins_risk === 'cameo') &&
    player.start_prob < MINUTES_TRAP_START_PROB
  ) {
    return 'minutes_trap'
  }

  // ----- Priority 2: Fixture Trap -----
  // Widely-owned player (TRAP flag) facing worsening fixtures — sell pressure.
  // Both conditions required: TRAP flag alone is already shown in GemTable;
  // the swing condition is what makes this a lifecycle timing signal.
  if (
    player.differential_flag === 'trap' &&
    clubForm !== null &&
    (clubForm.swing_3gw ?? 0) <= -SWING_THRESHOLD
  ) {
    return 'fixture_trap'
  }

  // ----- Priority 3: Buy Next Week -----
  // Player is in the Hold band (not yet a Buy) AND fixtures are improving immediately.
  // Lower bound: gem >= posAvg * SELL_SOON_THRESHOLD ensures the player is not in the
  // Sell Soon / Sell band — those are resolved by later cascade entries anyway, but
  // the explicit lower bound is defensive and self-documenting.
  if (
    gem >= posAvg * SELL_SOON_THRESHOLD &&
    gem <= posAvg &&
    clubForm !== null &&
    (clubForm.swing_1gw ?? 0) >= SWING_THRESHOLD &&
    player.regression_signal !== 'sell'
  ) {
    return 'buy_next_week'
  }

  // ----- Priority 4: Hold One More -----
  // Same hold band as Buy Next Week, but only broader 3 GW swing — not immediate GW1 swing.
  // Fires when swing_1gw condition is not met (otherwise Buy Next Week would have fired).
  if (
    gem >= posAvg * SELL_SOON_THRESHOLD &&
    gem <= posAvg &&
    clubForm !== null &&
    (clubForm.swing_3gw ?? 0) >= SWING_THRESHOLD &&
    player.regression_signal !== 'sell'
  ) {
    return 'hold_one_more'
  }

  // ----- Priority 5: Sell Soon -----
  // Warning band — approaching Sell but threshold not yet crossed.
  // Range: posAvg * SELL_THRESHOLD (0.85) <= gem < posAvg * SELL_SOON_THRESHOLD (0.90).
  if (gem < posAvg * SELL_SOON_THRESHOLD && gem >= posAvg * SELL_THRESHOLD) {
    return 'sell_soon'
  }

  // ----- Priority 6: Sell -----
  // Hard threshold crossed — gem_score is materially below position average.
  if (gem < posAvg * SELL_THRESHOLD) {
    return 'sell'
  }

  // ----- Priority 7: Hold (default) -----
  // No special timing signal — within acceptable gem_score band.
  return 'hold'
}

// ---------------------------------------------------------------------------
// Wrapper function: computeLifecycleLabels
// ---------------------------------------------------------------------------

/**
 * Compute lifecycle labels for all 15 squad players (XI + bench).
 *
 * Mirrors computeVerdicts() in structure: same playerById + positionAverages
 * pattern, bench included (season-start fix: bench was previously unrated).
 * The computeVerdicts function and Verdict type are preserved in recommend.ts
 * for Phase 51 (Decision Summary).
 *
 * @param squadPicks  - SquadPick[] (15 players; bench are position >= 12)
 * @param allPlayers  - ScoredPlayer[] (full population for position averages)
 * @param clubFormMap - Map<teamId, ClubForm> pre-built by the caller (TransferPanel)
 * @returns           Map<playerId, LifecycleLabel> for all squad picks
 */
export function computeLifecycleLabels(
  squadPicks: SquadPick[],
  allPlayers: ScoredPlayer[],
  clubFormMap: Map<number, ClubForm>,
): Map<number, LifecycleLabel> {
  const labels = new Map<number, LifecycleLabel>()
  if (squadPicks.length === 0) return labels

  const playerById = new Map<number, ScoredPlayer>(allPlayers.map(p => [p.id, p]))
  const positionAverages = computePositionAverages(allPlayers)

  for (const pick of squadPicks) {
    // Bench (positions 12-15) rated too — matching computeVerdicts convention
    const player = playerById.get(pick.element)
    if (!player) continue

    // Cheap bench enablers are a Hold by definition (see BENCH_ENABLER_MAX_COST):
    // their gem scores sit far below position averages by design, so the sell
    // bands would flag standard fodder permanently.
    if (pick.position >= 12 && player.now_cost <= BENCH_ENABLER_MAX_COST) {
      labels.set(pick.element, 'hold')
      continue
    }

    const posAvg = positionAverages.get(player.element_type) ?? 0.5
    const clubForm = clubFormMap.get(player.team) ?? null
    labels.set(pick.element, computeLifecycleLabel(player, posAvg, clubForm))
  }

  return labels
}
