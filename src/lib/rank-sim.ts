// Phase 62 (MC-03): Rank simulator math — 5-GW XI cumulative trajectory + beat-the-average heuristic.
//
// Sources of truth:
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-CONTEXT.md §decisions D-06, D-07, D-08, D-09
//   - .planning/phases/062-mc-rank-simulator-captain-integration/062-RESEARCH.md §Pattern 3
//
// Independence assumption: per-player scores are treated as independent random variables.
// σ_XI = √(Σ σ_player²); captain's σ is doubled (D-09); cumulative band ± √N × σ_XI.
// BGW players have xPts_1gw=0, p10_pts=0, p90_pts=0 — they contribute 0 naturally (D-08).
import type { MergedPlayer } from '@/lib/types'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * A single data point on the cumulative 5-GW trajectory chart.
 * Origin: { gw: 'Start', mean: 0, p10: 0, p90: 0 }
 * Points GW+1..GW+5: cumulative mean and ±√N×σ_XI confidence band.
 */
export interface ChartPoint {
  gw: string        // 'Start' | 'GW+1' | 'GW+2' | 'GW+3' | 'GW+4' | 'GW+5'
  mean: number      // cumulative mean score
  p10: number       // cumulative 10th-percentile floor
  p90: number       // cumulative 90th-percentile ceiling
  altMean?: number  // cumulative mean for the alt XI (set by RankSimTab when defined)
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** GW horizon for the trajectory chart (D-06). */
const HORIZON = 5

/**
 * Scaling factor to convert the p10–p90 interval to σ.
 * For a normal distribution, the two-tailed 90% interval covers 2 × 1.28σ ≈ 2.56σ.
 * σ_player = (p90_pts - p10_pts) / SIGMA_SCALE  (D-07).
 */
const SIGMA_SCALE = 2.56

// ──────────────────────────────────────────────────────────────────────────────
// Core math
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the per-GW mean (`gwMean`) and per-GW standard deviation (`gwSigma`)
 * for a starting XI.
 *
 * - Captain's mean and σ are both doubled (D-09).
 * - BGW players have xPts=0, p10=0, p90=0 — they contribute 0 naturally (D-08).
 *
 * Exported so RankSimTab can also compute beat-the-average probabilities.
 */
export function computeXIPerGwStats(
  pickIds: readonly number[],
  captainId: number,
  playerMap: ReadonlyMap<number, MergedPlayer>,
): { gwMean: number; gwSigma: number } {
  let mean = 0
  let varSum = 0

  for (const pid of pickIds) {
    const player = playerMap.get(pid)
    if (!player) continue

    const xp = player.xPts_1gw ?? 0
    const sigmaPlayer = ((player.p90_pts ?? 0) - (player.p10_pts ?? 0)) / SIGMA_SCALE

    const isCap = pid === captainId
    const meanContribution = isCap ? xp * 2 : xp
    const sigmaContribution = isCap ? sigmaPlayer * 2 : sigmaPlayer

    mean += meanContribution
    varSum += sigmaContribution * sigmaContribution
  }

  return { gwMean: mean, gwSigma: Math.sqrt(varSum) }
}

/**
 * Compute 6 ChartPoints (Start + GW+1 through GW+5) for the cumulative trajectory.
 *
 * D-06: cumulative score on Y-axis, GW+N labels on X-axis.
 * D-07: GW+N → mean = N × gwMean; band = mean ± √N × gwSigma.
 * D-09: captain's mean and σ doubled; BGW players contribute 0.
 *
 * @param pickIds   11 starting XI element IDs (position <= 11 in squad picks).
 * @param captainId The element ID of the captain; pass -1 when no captain is set.
 * @param playerMap Map from element ID → MergedPlayer (must include MC fields p10_pts, p90_pts).
 */
export function computeXITrajectory(
  pickIds: readonly number[],
  captainId: number,
  playerMap: ReadonlyMap<number, MergedPlayer>,
): ChartPoint[] {
  const { gwMean, gwSigma } = computeXIPerGwStats(pickIds, captainId, playerMap)

  // Origin always at (0, 0, 0).
  const points: ChartPoint[] = [{ gw: 'Start', mean: 0, p10: 0, p90: 0 }]

  for (let n = 1; n <= HORIZON; n++) {
    const cumMean = n * gwMean
    const halfBand = Math.sqrt(n) * gwSigma  // √N scaling (D-07)
    points.push({
      gw: `GW+${n}`,
      mean: cumMean,
      p10: cumMean - halfBand,
      p90: cumMean + halfBand,
    })
  }

  return points
}

// ──────────────────────────────────────────────────────────────────────────────
// Normal CDF approximation (Abramowitz & Stegun 7.1.26)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Error function approximation (A&S 7.1.26, max error 1.5e-7).
 * Used to implement the standard normal CDF without a math library.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  const y = 1 - poly * Math.exp(-ax * ax)
  return sign * y
}

/**
 * Standard normal CDF: Φ(z) = P(X ≤ z) for X ~ N(0,1).
 */
function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/**
 * Beat-the-average probability (D-03).
 *
 * Returns P(cumulative XI score > threshold) under N(cumMean, cumSigma²).
 *
 * Usage: P(rank gain) = computeBeatTheAverageProb(cumMean, cumSigma, gwAverage × gwsAhead)
 *        P(rank drop) = 1 - P(rank gain)
 *
 * Short-circuits when cumSigma ≤ 0 (degenerate distribution — all-BGW squad or
 * identical p10/p90 for every player). T-62-10 mitigation.
 *
 * @param cumMean    Cumulative mean (mean_N = N × gwMean)
 * @param cumSigma   Cumulative standard deviation (√N × σ_XI)
 * @param threshold  The score to compare against (e.g. gwAverage × N)
 */
export function computeBeatTheAverageProb(
  cumMean: number,
  cumSigma: number,
  threshold: number,
): number {
  if (cumSigma <= 0) {
    return cumMean > threshold ? 1 : cumMean < threshold ? 0 : 0.5
  }
  // P(X > threshold) = 1 - Φ((threshold - mean) / σ) = Φ((mean - threshold) / σ)
  const z = (cumMean - threshold) / cumSigma
  return normCdf(z)
}
