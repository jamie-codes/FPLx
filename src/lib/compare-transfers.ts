// Redesign §4: comparative "why X over Y" reasons for the Transfers explainer.
// Pure — given the preferred target x and runner-up y, returns the strongest 2-3
// comparative reasons plus a risk line (x's top risk + y as the safer floor).
import type { MergedPlayer } from './types'
import { explainPick } from './explain-pick'

export interface TransferComparison {
  reasons: string[]
  risk: string | null
}

export function compareTransfers(x: MergedPlayer, y: MergedPlayer): TransferComparison {
  const reasons: string[] = []

  // Ceiling — needs MC haul_prob on both (absent off-season → skip).
  if (x.haul_prob != null && y.haul_prob != null && x.haul_prob > y.haul_prob) {
    reasons.push(`Higher ceiling: haul ${Math.round(x.haul_prob * 100)}% vs ${Math.round(y.haul_prob * 100)}%`)
  }

  // Horizon — the edge grows over the 5-GW window.
  const d1 = (x.xPts_1gw ?? 0) - (y.xPts_1gw ?? 0)
  const d5 = (x.xPts_5gw ?? 0) - (y.xPts_5gw ?? 0)
  if (d5 > d1 && d5 > 0) {
    reasons.push(`xPts gap grows: +${d1.toFixed(1)} (1GW) → +${d5.toFixed(1)} (5GW)`)
  }

  // Penalty edge.
  if (x.penalties_order === 1 && y.penalties_order !== 1) {
    reasons.push(`On penalties — ${y.web_name} isn’t`)
  }

  // Differential — x meaningfully lower-owned.
  const xOwn = parseFloat(x.selected_by_percent)
  const yOwn = parseFloat(y.selected_by_percent)
  if (Number.isFinite(xOwn) && Number.isFinite(yOwn) && yOwn - xOwn >= 10) {
    reasons.push(`More differential (${xOwn.toFixed(1)}% vs ${yOwn.toFixed(1)}% owned)`)
  }

  const topRisk = explainPick(x).risks[0]
  const risk = topRisk ? `${topRisk} — ${y.web_name} is the safer floor pick` : null

  return { reasons: reasons.slice(0, 3), risk }
}
