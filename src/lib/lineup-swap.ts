// Phase 72 (LINEUP-01): pure-function swap helpers used by the LineupTab UI.
// Mirrors src/lib/optimise-lineup.ts pattern: no 'use client', no React, no side effects.
// isLegalSwap encodes the FPL position-compatibility + formation-legality rules from D-07.
// applySwap derives the new starters/bench/captain/vc/formation after a swap (Pitfalls 2, 3).
import type { MergedPlayer, OptimisedLineup } from './types'

// FPL position codes (matches MergedPlayer.element_type)
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4

export function isLegalSwap(
  lineup: OptimisedLineup,
  starterId: number,
  benchId: number,
  playerMap: Map<number, MergedPlayer>,
): boolean {
  const starter = playerMap.get(starterId)
  const benchP  = playerMap.get(benchId)
  if (!starter || !benchP) return false

  // GK rule (D-07): if either is GK, both must be GK.
  if (starter.element_type === GK || benchP.element_type === GK) {
    return starter.element_type === GK && benchP.element_type === GK
  }

  // Same-position outfield swap is always legal (no formation change).
  if (starter.element_type === benchP.element_type) return true

  // Cross-position outfield swap: simulate new starters, count outfield, validate FPL rules
  // (Pitfall 4 — must mirror src/lib/optimise-lineup.ts:91-97).
  const newStarters = lineup.starters.map(id => id === starterId ? benchId : id)
  let def = 0, mid = 0, fwd = 0
  for (const id of newStarters) {
    const et = playerMap.get(id)?.element_type
    if (et === DEF) def++
    else if (et === MID) mid++
    else if (et === FWD) fwd++
  }
  return def >= 3 && def <= 5 && mid >= 2 && mid <= 5 && fwd >= 1 && fwd <= 3
}

export function applySwap(
  lineup: OptimisedLineup,
  starterId: number,
  benchId: number,
  playerMap: Map<number, MergedPlayer>,
): OptimisedLineup {
  // Build new arrays — do NOT mutate inputs (Pitfall: callers expect referential change to
  // trigger React re-render; in-place mutation would not flip the reference).
  const newStarters = lineup.starters.map(id => id === starterId ? benchId : id)
  const benchIdx = lineup.bench.indexOf(benchId)
  // Guard: if benchId is not in bench (stale caller), return unchanged lineup.
  if (benchIdx === -1) return lineup
  const newBench = lineup.bench.map((id, i) => i === benchIdx ? starterId : id)

  // Recompute captain/VC against the NEW starters (Pitfall 2 — captain may have just been benched).
  // Fallback chain MUST equal src/lib/optimise-lineup.ts:57-58 verbatim.
  const captainKey = (p: MergedPlayer): number =>
    p.xPts_90th_1gw ?? p.xPts_1gw ?? 0
  const sorted = [...newStarters].sort(
    (a, b) => {
      const pa = playerMap.get(a)
      const pb = playerMap.get(b)
      return (pb ? captainKey(pb) : 0) - (pa ? captainKey(pa) : 0)
    },
  )

  // Recompute formation string from NEW starters (Pitfall 3).
  let def = 0, mid = 0, fwd = 0
  for (const id of newStarters) {
    const et = playerMap.get(id)?.element_type
    if (et === DEF) def++
    else if (et === MID) mid++
    else if (et === FWD) fwd++
  }

  return {
    starters: newStarters,
    bench: newBench,
    captainId: sorted[0],
    vcId: sorted[1],
    formation: `${def}-${mid}-${fwd}`,
  }
}
