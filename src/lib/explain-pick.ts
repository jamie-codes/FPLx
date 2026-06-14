// PICK-02: Deterministic pick explanation engine.
// Pure function — no side effects, no ranking changes. Annotation only.
// All thresholds below are HEURISTIC presentation cutoffs that describe
// why the model rated a player. They do NOT affect ranking.
import type { MergedPlayer } from '@/lib/types'

export interface PickExplanation {
  reasons: string[]
  risks: string[]
}

// ── Reason thresholds (heuristic, for display only) ──────────────────────
const XG_PER90_THRESHOLD = 0.45
const XA_PER90_THRESHOLD = 0.30
const FIXTURE_EASY_MEAN_THRESHOLD = 0.40   // mean difficulty_score of next ≤3 fixtures
const START_PROB_NAILED_THRESHOLD = 0.90
const BONUS_EV_THRESHOLD = 0.80
const DEFCON_THRESHOLD = 0.50
const HAUL_PROB_REASON_THRESHOLD = 0.30

// ── Risk thresholds (heuristic, for display only) ────────────────────────
const FIXTURE_TOUGH_MEAN_THRESHOLD = 0.66  // mean difficulty_score of next ≤3 fixtures
const MINS_60_RISK_THRESHOLD = 0.60
const BLANK_PROB_THRESHOLD = 0.45
const MINUTES_SAMPLE_THRESHOLD = 270
const MAX_REASONS = 4
const MAX_RISKS = 3

// Maps FPL status codes to human-readable availability labels.
const STATUS_LABEL: Partial<Record<string, string>> = {
  d: 'Doubtful',
  i: 'Injured',
  s: 'Suspended',
  u: 'Unavailable',
  n: 'Not available',
}

/** Mean difficulty_score of the next ≤3 fixtures (distinct event IDs). */
function meanNextFixtureDifficulty(p: MergedPlayer): number | null {
  const fixtures = p.fixtures ?? []
  if (fixtures.length === 0) return null
  // Take the first ≤3 distinct event_ids
  const seen = new Set<number>()
  const scores: number[] = []
  for (const fx of fixtures) {
    if (seen.size >= 3) break
    if (!seen.has(fx.event_id)) {
      seen.add(fx.event_id)
      scores.push(fx.difficulty_score)
    }
  }
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export function explainPick(p: MergedPlayer): PickExplanation {
  const reasons: string[] = []
  const risks: string[] = []
  const fixtureMean = meanNextFixtureDifficulty(p)

  // ── REASONS (salience order) ────────────────────────────────────────────

  // 1. Strong goal threat
  if ((p.xg_per90 ?? 0) >= XG_PER90_THRESHOLD) {
    reasons.push(`Strong goal threat (xG ${(p.xg_per90 as number).toFixed(2)}/90)`)
  }

  // 2. Creator
  if ((p.xa_per90 ?? 0) >= XA_PER90_THRESHOLD) {
    reasons.push(`Creator (xA ${(p.xa_per90 as number).toFixed(2)}/90)`)
  }

  // 3. Favourable fixtures
  if (fixtureMean !== null && fixtureMean <= FIXTURE_EASY_MEAN_THRESHOLD) {
    reasons.push('Favourable fixtures')
  }

  // 4. Nailed starter
  if (p.mins_risk === 'nailed' || (p.start_prob ?? 0) >= START_PROB_NAILED_THRESHOLD) {
    reasons.push('Nailed starter')
  }

  // 5. Penalty / set-piece taker
  if ((p.penalties_order ?? 0) === 1) {
    reasons.push('On penalties')
  } else if ((p.direct_freekicks_order ?? 0) === 1 || (p.corners_and_indirect_freekicks_order ?? 0) === 1) {
    reasons.push('Set-piece taker')
  }

  // 6. Bonus magnet
  const bonusEv = p.bonus_ev ?? 0
  if (bonusEv >= BONUS_EV_THRESHOLD) {
    reasons.push(`Bonus magnet (${bonusEv.toFixed(1)} EV)`)
  }

  // 7. DefCon points likely
  const defcon = p.xPts_components_1gw?.defcon ?? 0
  if (defcon >= DEFCON_THRESHOLD) {
    reasons.push('DefCon points likely')
  }

  // 8. Genuine differential
  if (p.differential_flag === 'diff') {
    reasons.push(`Genuine differential (${p.selected_by_percent}% owned)`)
  }

  // 9. High ceiling
  const haulProb = p.haul_prob ?? 0
  if (haulProb >= HAUL_PROB_REASON_THRESHOLD) {
    reasons.push(`High ceiling (haul ${(haulProb * 100) | 0}%)`)
  }

  // ── RISKS (salience order) ──────────────────────────────────────────────

  // 1. Availability status
  const statusLabel = STATUS_LABEL[p.status]
  if (statusLabel) {
    const newsText = p.news?.trim() ? `: ${p.news.trim()}` : ''
    risks.push(`${statusLabel}${newsText}`)
  }

  // 2. Rotation risk
  if (p.mins_risk === 'rotation_risk' || p.mins_risk === 'cameo' || p.rotation_risk === true) {
    risks.push('Rotation risk')
  }

  // 3. Tough fixtures
  if (fixtureMean !== null && fixtureMean >= FIXTURE_TOUGH_MEAN_THRESHOLD) {
    risks.push('Tough fixtures')
  }

  // 4. May not complete 60 mins
  if (p.mins_60_prob !== undefined && p.mins_60_prob !== null && p.mins_60_prob < MINS_60_RISK_THRESHOLD) {
    risks.push('May not complete 60 mins')
  }

  // 5. High blank risk
  const blankProb = p.blank_prob ?? 0
  if (blankProb >= BLANK_PROB_THRESHOLD) {
    risks.push(`High blank risk (${(blankProb * 100) | 0}%)`)
  }

  // 6. Template trap
  if (p.differential_flag === 'trap') {
    risks.push(`Template trap (${p.selected_by_percent}% owned, low projection)`)
  }

  // 7. Limited minutes sample
  if (p.minutes !== undefined && p.minutes < MINUTES_SAMPLE_THRESHOLD) {
    risks.push('Limited minutes sample')
  }

  // ── Fallback ────────────────────────────────────────────────────────────
  if (reasons.length === 0) {
    reasons.push('Ranked on overall xPts')
  }

  return {
    reasons: reasons.slice(0, MAX_REASONS),
    risks: risks.slice(0, MAX_RISKS),
  }
}
