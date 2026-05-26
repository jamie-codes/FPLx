import type { ScoredPlayer } from '@/lib/types'

export interface RouteFlags {
  pk: boolean
  fk: boolean
  ck: boolean
  xg: boolean
  xa: boolean
}

// Append val to the array stored at map[key], creating the array if absent.
function append(map: Map<number, number[]>, key: number, val: number) {
  const arr = map.get(key)
  if (arr) arr.push(val)
  else map.set(key, [val])
}

// Standard statistical median (average of two middle values for even-length arrays).
// Returns null for an empty array.
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function computeRouteFlags(players: ScoredPlayer[]): Map<number, RouteFlags> {
  const teamXg = new Map<number, number[]>()
  const teamXa = new Map<number, number[]>()
  for (const p of players) {
    if (p.xg_per90 !== null) append(teamXg, p.team, p.xg_per90)
    if (p.xa_per90 !== null) append(teamXa, p.team, p.xa_per90)
  }

  const result = new Map<number, RouteFlags>()
  for (const p of players) {
    const medXg = median(teamXg.get(p.team) ?? [])
    const medXa = median(teamXa.get(p.team) ?? [])
    result.set(p.id, {
      pk: p.penalties_order === 1,
      fk: p.direct_freekicks_order === 1,
      ck: p.corners_and_indirect_freekicks_order === 1,
      xg: p.xg_per90 !== null && medXg !== null && p.xg_per90 >= medXg,
      xa: p.xa_per90 !== null && medXa !== null && p.xa_per90 >= medXa,
    })
  }
  return result
}
