// UIX-02 Task 1: the only real logic on Home — pure, React-free, unit-tested.
// Everything else on Home is composition of existing engines (spec anti-goal:
// no new computation; these helpers only map/format engine outputs).
import { LABEL_EXPLANATIONS, type LifecycleLabel } from '@/lib/lifecycle-label'
import { SELL_THRESHOLD as VERDICT_SELL_THRESHOLD, type Verdict } from '@/lib/recommend'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { MergedPlayer } from '@/lib/types'
import type { ChipIntent } from '@/components/ui/Chip'

export interface PlayerBadge {
  text: string
  intent: ChipIntent
  /** Hover explanation — WHY this badge (rendered as the Chip's title). */
  title: string
}

// Risk subset per spec: sell, sell_soon, minutes_trap, fixture_trap.
// Other lifecycle labels (hold / buy_next_week / hold_one_more) are not risk
// signals — those rows fall through to the verdict badge.
// Hover titles come from the shared LABEL_EXPLANATIONS map (threshold-
// interpolated) so this strip and LifecycleLabelBadge explain identically.
const RISK_BADGE: Partial<Record<LifecycleLabel, PlayerBadge>> = {
  sell:         { text: 'SELL',      intent: 'negative', title: LABEL_EXPLANATIONS.sell },
  sell_soon:    { text: 'SELL SOON', intent: 'warning',  title: LABEL_EXPLANATIONS.sell_soon },
  minutes_trap: { text: 'MINS TRAP', intent: 'warning',  title: LABEL_EXPLANATIONS.minutes_trap },
  fixture_trap: { text: 'FIX TRAP',  intent: 'warning',  title: LABEL_EXPLANATIONS.fixture_trap },
}

/** Spec chip-precedence rule: ONE Chip per squad row — risk label wins over
 * verdict. Every row here is a player the manager already OWNS, so an
 * above-average verdict reads HOLD (positive), never BUY (season-start fix). */
export function badgeFor(
  verdict: Verdict | undefined,
  label: LifecycleLabel | undefined,
): PlayerBadge {
  if (label !== undefined) {
    const risk = RISK_BADGE[label]
    if (risk) return risk
  }
  if (verdict === 'sell') {
    return { text: 'SELL', intent: 'negative',
             title: `Sell: gem score more than ${Math.round((1 - VERDICT_SELL_THRESHOLD) * 100)}% below the position average — consider transferring out.` }
  }
  if (verdict === 'buy') {
    return { text: 'HOLD', intent: 'positive',
             title: 'Hold: gem score above the position average — a keeper.' }
  }
  return { text: 'HOLD', intent: 'neutral', title: LABEL_EXPLANATIONS.hold }
}

/** Count of risk-subset labels across the squad (drives the "N players flagged
 * → Decision" chip). */
export function riskCount(labels: Map<number, LifecycleLabel>): number {
  let n = 0
  for (const l of labels.values()) if (RISK_BADGE[l]) n++
  return n
}

/** £ formatting: entry_history.bank is tenths of £1m (e.g. 5 → £0.5m). */
export function formatBank(bankTenths: number): string {
  return `£${(bankTenths / 10).toFixed(1)}m`
}

export interface TransferHeadline {
  sellName: string
  buyName: string
  gain: number          // xPtsGain of the row (gross, matches OCS table column)
  costLabel: string     // cost + break-even support line (OCSRow fields only)
}

/** Top OCS suggestion: first row with actual transfer legs (row 0 is always
 * Roll — same extraction as DecisionSummaryTab's prose payload). */
export function transferHeadline(rows: OCSRow[]): TransferHeadline | null {
  const row = rows.find((r) => r.transfers && r.transfers.length > 0)
  const leg = row?.transfers?.[0]
  if (!row || !leg) return null
  const breakEven =
    row.cost > 0 && row.breakEvenGws !== null
      ? ` · breaks even in ${row.breakEvenGws} GW${row.breakEvenGws === 1 ? '' : 's'}`
      : ''
  return {
    sellName: leg.sell.web_name,
    buyName: leg.buy.web_name,
    gain: row.xPtsGain,
    costLabel: row.cost === 0 ? 'Free transfer' : `-${row.cost} pt hit${breakEven}`,
  }
}

/** Projected XI points: sum of starters' xPts_1gw + captain's once more
 * (captain doubles per FPL rules — mirrors LineupTab's Total xPts). */
export function xiProjectedPts(
  starterIds: number[],
  captainId: number,
  players: MergedPlayer[],
): number {
  const byId = new Map(players.map((p) => [p.id, p]))
  const sum = starterIds.reduce((acc, id) => acc + (byId.get(id)?.xPts_1gw ?? 0), 0)
  return sum + (byId.get(captainId)?.xPts_1gw ?? 0)
}
