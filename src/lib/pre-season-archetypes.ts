// PSB-01: Three-archetype pre-season squad builder.
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { PreSeasonPlayer, PreSeasonSquad } from './types'
import { buildPreSeasonSquad } from './pre-season-squad'

export type ArchetypeLabel = 'Premium Spine' | 'Balanced' | 'Value'

export interface ArchetypeSquad {
  label: ArchetypeLabel
  squad: PreSeasonSquad | null
  /** Top-3 starters by total_points descending — empty when squad is null */
  topCaptains: Pick<PreSeasonPlayer, 'id' | 'web_name' | 'element_type' | 'total_points'>[]
}

/**
 * buildPreSeasonArchetypes: returns three squad archetypes for GW1 planning.
 *
 * Archetypes:
 *   Premium Spine — anchors the 2 highest total_points players in the eligible pool.
 *   Balanced      — anchors the top total_points player at each position (GK, DEF, MID, FWD).
 *   Value         — no anchors; pure ppm-per-£ greedy (same as default buildPreSeasonSquad).
 *
 * All three respect the same 3-per-club cap and 100m budget.
 * Scoring for topCaptains uses total_points from last season (ppm proxy for quality).
 * When buildPreSeasonSquad returns null for an archetype, squad is null and topCaptains is [].
 */
export function buildPreSeasonArchetypes(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,
  budget = 1000,
): ArchetypeSquad[] {
  const eligible = players.filter(p => scoreMap.has(p.id))

  // --- Premium Spine: top-2 by total_points ---
  const byPoints = [...eligible].sort((a, b) => b.total_points - a.total_points)
  const premiumAnchorIds = byPoints.slice(0, 2).map(p => p.id)

  // --- Balanced: best total_points player per position ---
  const balancedAnchorIds: number[] = []
  for (const pos of [1, 2, 3, 4] as const) {
    const topForPos = eligible
      .filter(p => p.element_type === pos)
      .sort((a, b) => b.total_points - a.total_points)[0]
    if (topForPos) balancedAnchorIds.push(topForPos.id)
  }

  // --- Build all three squads ---
  const archetypeConfigs: Array<{ label: ArchetypeLabel; anchorIds: number[] }> = [
    { label: 'Premium Spine', anchorIds: premiumAnchorIds },
    { label: 'Balanced',      anchorIds: balancedAnchorIds },
    { label: 'Value',         anchorIds: [] },
  ]

  return archetypeConfigs.map(({ label, anchorIds }) => {
    const squad = buildPreSeasonSquad(players, scoreMap, budget, 3, anchorIds)
    const topCaptains = squad === null
      ? []
      : [...squad.starters]
          .sort((a, b) => b.total_points - a.total_points)
          .slice(0, 3)
          .map(p => ({
            id: p.id,
            web_name: p.web_name,
            element_type: p.element_type,
            total_points: p.total_points,
          }))
    return { label, squad, topCaptains }
  })
}
