import type { PositionCode } from '@/lib/types'

// DefConPlayer shape — canonical definition lives here until Plan 01 adds it to types.ts.
// When types.ts gains DefConPlayer, update this import to: import type { DefConPlayer, PositionCode } from '@/lib/types'
export interface DefConPlayer {
  id: number
  web_name: string
  element_type: PositionCode       // 2=DEF, 3=MID, 4=FWD
  team: number
  team_short_name: string
  threshold: number                // 10 for DEF, 12 for MID/FWD
  hit_rate: number                 // 0.0-1.0
  hits: number
  games_played: number
  avg_per90: number
  distance_to_threshold: number    // threshold - avg_per90 (negative = above threshold)
  fixture_correlation: {
    insufficient_data: boolean
    easy_hit_rate?: number
    hard_hit_rate?: number
    easy_n?: number
    hard_n?: number
  }
}

// Per-position DefCon thresholds: DEF needs 10, MID/FWD need 12
export const DEFCON_THRESHOLD: Record<number, number> = {
  2: 10,  // DEF
  3: 12,  // MID
  4: 12,  // FWD
}

// Splits players into DEF (element_type=2) and MID/FWD (element_type=3 or 4) groups
export function splitByPosition(players: DefConPlayer[]): {
  def: DefConPlayer[]
  midFwd: DefConPlayer[]
} {
  return {
    def: players.filter(p => p.element_type === 2),
    midFwd: players.filter(p => p.element_type === 3 || p.element_type === 4),
  }
}

// Formats a 0.0-1.0 hit rate as a percentage string, e.g. 0.516 -> "51.6%"
export function formatHitRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

// Returns the player's DefCon status relative to their threshold
export function getDefConStatus(player: DefConPlayer): 'above' | 'at' | 'below' {
  if (player.distance_to_threshold < 0) return 'above'
  if (player.distance_to_threshold === 0) return 'at'
  return 'below'
}

// Formats a fixture correlation result for display
export function formatCorrelation(fc: DefConPlayer['fixture_correlation']): {
  label?: string
  easy?: string
  hard?: string
} {
  if (fc.insufficient_data) {
    return { label: `Insufficient data (${fc.easy_n ?? 0} easy, ${fc.hard_n ?? 0} hard games)` }
  }
  return {
    easy: `${((fc.easy_hit_rate ?? 0) * 100).toFixed(1)}%`,
    hard: `${((fc.hard_hit_rate ?? 0) * 100).toFixed(1)}%`,
  }
}
