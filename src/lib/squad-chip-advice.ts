// CHIP-02 (2026-09-02): re-judge chip signals against the LOADED squad.
//
// pipeline/chip_advisor.py computes its signals from the decision ledger —
// ledger['bench'], model_xi, captain_shadow — which describe the pipeline's own
// simulated squad. Rendered without qualification that reads as advice about
// the manager's team: a bench of two zero-minute fillers was being recommended
// for a Bench Boost, and the captain named was one the manager did not own.
//
// The fixture-shape parts of that advice (how many teams double or blank) are
// genuinely global and are left alone. Only the squad-dependent signals are
// recomputed here, against the same thresholds chip_advisor.py uses so the two
// cannot drift apart silently.
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'

// Mirrors pipeline/chip_advisor.py — keep in step with it.
export const BB_PLAY = 14.0
export const BB_CONSIDER = 11.0
export const TC_PLAY = 9.0
export const TC_CONSIDER = 7.5

export type ChipSignal = 'play' | 'consider' | 'hold' | 'informational'

export interface SquadChipSignals {
  /** Bench xPts for the players who would actually be boosted. */
  benchXPts: number
  benchBoost: ChipSignal
  /** Ceiling of the best captain IN the squad, and who that is. */
  captainCeiling: number
  captainName: string | null
  tripleCaptain: ChipSignal
  /** How many of the 15 have no fixture in the gameweek. */
  blanks: number
}

function signalFor(value: number, play: number, consider: number): ChipSignal {
  if (value >= play) return 'play'
  if (value >= consider) return 'consider'
  return 'hold'
}

/** Gameweek everyone is judged against: the earliest event still fixtured. */
function nextGw(players: MergedPlayer[]): number | null {
  let earliest: number | null = null
  for (const p of players) {
    for (const f of p.fixtures ?? []) {
      if (earliest === null || f.event_id < earliest) earliest = f.event_id
    }
  }
  return earliest
}

/**
 * Squad-dependent chip signals for the manager's actual 15.
 *
 * Returns null when there is nothing to judge (no squad or no player data), so
 * callers can fall back to the pipeline advice rather than inventing one.
 */
export function computeSquadChipSignals(
  picks: SquadPick[],
  players: MergedPlayer[],
): SquadChipSignals | null {
  if (picks.length === 0 || players.length === 0) return null
  const byId = new Map(players.map(p => [p.id, p]))
  const owned = picks
    .map(pick => ({ pick, player: byId.get(pick.element) }))
    .filter((r): r is { pick: SquadPick; player: MergedPlayer } => !!r.player)
  if (owned.length === 0) return null

  const gw = nextGw(players)
  const hasFixture = (p: MergedPlayer) =>
    gw === null || (p.fixtures ?? []).some(f => f.event_id === gw)

  const benchXPts = owned
    .filter(r => r.pick.position >= 12)
    .reduce((sum, r) => sum + (r.player.xPts_1gw ?? 0), 0)

  const captainable = owned
    .map(r => r.player)
    .filter(p => p.status === 'a' && hasFixture(p))
  let captainName: string | null = null
  let captainCeiling = 0
  for (const p of captainable) {
    const ceiling = p.xPts_90th_1gw ?? p.xPts_1gw ?? 0
    if (ceiling > captainCeiling) {
      captainCeiling = ceiling
      captainName = p.web_name
    }
  }

  return {
    benchXPts,
    benchBoost: signalFor(benchXPts, BB_PLAY, BB_CONSIDER),
    captainCeiling,
    captainName,
    tripleCaptain: signalFor(captainCeiling, TC_PLAY, TC_CONSIDER),
    blanks: owned.filter(r => !hasFixture(r.player)).length,
  }
}
