import type { ScoredPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

/**
 * A captaincy candidate with projected double points and classification.
 */
export interface CaptaincyCandidate {
  player: ScoredPlayer
  projected_captain_pts: number  // proj_pts_1gw * 2
  captain_type: 'safe' | 'upside'
}

/**
 * Compute position average gem_score across ALL players (not just squad picks).
 * Falls back to 0.5 if no players at a given position.
 */
function computePositionAverages(allPlayers: ScoredPlayer[]): Record<number, number> {
  const sums: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (const p of allPlayers) {
    sums[p.element_type] += p.gem_score
    counts[p.element_type]++
  }

  const avgs: Record<number, number> = {}
  for (const pos of [1, 2, 3, 4]) {
    avgs[pos] = counts[pos] > 0 ? sums[pos] / counts[pos] : 0.5
  }
  return avgs
}

/**
 * Compute top-N captaincy candidates from a squad.
 *
 * Rules:
 * - Only starting-XI picks (position 1-11) are considered
 * - Goalkeepers (element_type === 1) are excluded — captaining a GK is never optimal
 * - Players with proj_pts_1gw <= 0 or mins_risk === 'injured' are excluded
 * - projected_captain_pts = proj_pts_1gw * 2
 * - captain_type is 'safe' when mins_risk === 'nailed' AND gem_score >= position average
 * - captain_type is 'upside' for all other cases
 * - Results sorted by projected_captain_pts descending
 *
 * @param squadPicks - The manager's current squad picks
 * @param allPlayers - Full player pool (used for position average computation)
 * @param topN - Maximum candidates to return (default 5)
 */
export function computeCaptaincyCandidates(
  squadPicks: SquadPick[],
  allPlayers: ScoredPlayer[],
  topN = 5,
): CaptaincyCandidate[] {
  // Build fast lookup map: player id -> ScoredPlayer
  const playerMap = new Map<number, ScoredPlayer>()
  for (const p of allPlayers) {
    playerMap.set(p.id, p)
  }

  // Compute position averages from ALL players in the pool
  const positionAvgs = computePositionAverages(allPlayers)

  const candidates: CaptaincyCandidate[] = []

  for (const pick of squadPicks) {
    // Only starting-XI (positions 1-11)
    if (pick.position >= 12) continue

    const player = playerMap.get(pick.element)
    if (!player) continue

    // Exclude goalkeepers — captaining a GK is never optimal
    if (player.element_type === 1) continue

    // Exclude injured or zero-projection players
    if (player.proj_pts_1gw <= 0) continue
    if (player.mins_risk === 'injured') continue

    const projected_captain_pts = player.proj_pts_1gw * 2

    // Classify captain type
    const posAvg = positionAvgs[player.element_type] ?? 0.5
    const isSafe =
      player.mins_risk === 'nailed' && player.gem_score >= posAvg

    candidates.push({
      player,
      projected_captain_pts,
      captain_type: isSafe ? 'safe' : 'upside',
    })
  }

  // Sort by projected_captain_pts descending
  candidates.sort((a, b) => b.projected_captain_pts - a.projected_captain_pts)

  return candidates.slice(0, topN)
}
