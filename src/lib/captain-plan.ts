// Planner outlook: the best captain per gameweek along the generated plan. For
// each step, scores the STARTERS (positionsAfter 1-11) by their per-GW xPts
// (gw_xpts, aligned to the step's GW by the player's PLAYED gameweeks — see
// bestCaptainPerGw below) and picks the max.
import type { MergedPlayer, PlanStep } from './types'

export interface CaptainPlanEntry {
  gw: number
  playerId: number
  name: string
  team: string
  opponent: string
  xpts: number
}

export function bestCaptainPerGw(
  steps: PlanStep[],
  playerMap: Map<number, MergedPlayer>,
): CaptainPlanEntry[] {
  const out: CaptainPlanEntry[] = []
  steps.forEach((step, i) => {
    let best: { p: MergedPlayer; xpts: number } | null = null
    for (const [idStr, pos] of Object.entries(step.positionsAfter)) {
      if (pos < 1 || pos > 11) continue // starters only
      const p = playerMap.get(Number(idStr))
      if (!p) continue
      // gw_xpts[k] is the player's k-th PLAYED gameweek (k-th unique fixtures
      // event_id, sorted). Align by GW value, not plan-step position — a
      // player's own gw_xpts array shifts down for every GW they blank, so
      // indexing by step position desyncs during blank gameweeks.
      const playedGws = [...new Set((p.fixtures ?? []).map((f) => f.event_id))].sort((a, b) => a - b)
      let xpts: number
      if (playedGws.length === 0) {
        // No fixtures to align by value (e.g. data not wired up) — fall back
        // to position indexing. Harmless in practice: when fixtures is empty,
        // gw_xpts is empty too (both come from the same per-player fixture
        // grouping), so this resolves to 0 either way.
        xpts = p.gw_xpts?.[i] ?? 0
      } else {
        const k = playedGws.indexOf(step.gw)
        xpts = k >= 0 ? (p.gw_xpts?.[k] ?? 0) : 0 // k < 0 => player blanks this GW → 0 (ineligible)
      }
      if (best === null || xpts > best.xpts) best = { p, xpts }
    }
    if (best === null || best.xpts <= 0) return // no starter resolvable, or full-squad blank this GW → skip
    const p = best.p
    const fx = p.fixtures?.find((f) => f.event_id === step.gw)
    const opponent = fx ? `${fx.is_home ? 'vs' : 'at'} ${fx.opponent_team} (${fx.is_home ? 'H' : 'A'})` : ''
    out.push({ gw: step.gw, playerId: p.id, name: p.web_name, team: p.team_short_name, opponent, xpts: best.xpts })
  })
  return out
}
