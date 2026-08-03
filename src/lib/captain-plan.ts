// Planner outlook: the best captain per gameweek along the generated plan. For
// each step, scores the STARTERS (positionsAfter 1-11) by their per-GW xPts
// (gw_xpts, indexed by step position) and picks the max.
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
      const xpts = p.gw_xpts?.[i] ?? 0
      if (best === null || xpts > best.xpts) best = { p, xpts }
    }
    if (best === null) return // no starter resolvable this GW → skip
    const p = best.p
    const fx = p.fixtures?.find((f) => f.event_id === step.gw)
    const opponent = fx ? `${fx.is_home ? 'vs' : 'at'} ${fx.opponent_team} (${fx.is_home ? 'H' : 'A'})` : ''
    out.push({ gw: step.gw, playerId: p.id, name: p.web_name, team: p.team_short_name, opponent, xpts: best.xpts })
  })
  return out
}
