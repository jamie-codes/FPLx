import type { MergedPlayer } from '@/lib/types'

/**
 * Phase 32 TGT-02 / D-08, D-09 — per-player share of team xG+xA.
 *
 * Two-pass aggregation: pass 1 sums (expected_goals + expected_assists) per
 * team_id, pass 2 computes each player's share. Players whose team has a zero
 * total are OMITTED from the returned map (caller renders em-dash for missing
 * entries per UI-SPEC).
 *
 * Source field convention (D-09): FPL StatsBomb season totals from bootstrap
 * (`expected_goals`, `expected_assists`) — same source as Phase 29 regression
 * signal. Not Understat (which has ~43 unmatched players that would understate
 * team totals).
 *
 * @param players MergedPlayer[] — full pipeline output. Caller is responsible
 *                for any status filtering before passing in.
 * @returns Map<playerId, share> where share is a 0..1 ratio.
 */
export function computeXgiInvolvement(players: MergedPlayer[]): Map<number, number> {
  // Pass 1: sum xGI per team
  const teamTotals = new Map<number, number>()
  for (const p of players) {
    const xgi = (p.expected_goals ?? 0) + (p.expected_assists ?? 0)
    teamTotals.set(p.team, (teamTotals.get(p.team) ?? 0) + xgi)
  }

  // Pass 2: per-player share (skip teams with zero total)
  const result = new Map<number, number>()
  for (const p of players) {
    const total = teamTotals.get(p.team) ?? 0
    if (total > 0) {
      const xgi = (p.expected_goals ?? 0) + (p.expected_assists ?? 0)
      result.set(p.id, xgi / total)
    }
  }
  return result
}
