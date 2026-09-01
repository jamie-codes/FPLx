// BGW-02 (2026-09-01): shared blank-gameweek detection.
//
// LineupTab and OptimiserPanel each decided "has a fixture" with
// `xPts_1gw !== 0`. That is a projection, not a fixture: a squad filler with
// no minutes all season projects zero points while his club plays as normal.
// Two such players turned a completely ordinary gameweek into "only 13 of
// your 15 players have a fixture this gameweek".
//
// A blank gameweek is a property of the FIXTURE LIST, so these read the
// fixtures directly.
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

/** The gameweek everyone is being judged against: the earliest event id still
 * present in anyone's fixture list. Null when there is no fixture data — which
 * means "unknown", never "blank". */
export function nextGameweekId(players: MergedPlayer[]): number | null {
  let earliest: number | null = null
  for (const p of players) {
    for (const f of p.fixtures ?? []) {
      if (earliest === null || f.event_id < earliest) earliest = f.event_id
    }
  }
  return earliest
}

/** How many of `picks` have a fixture in the next gameweek.
 *
 * Players absent from `playerMap` are not counted (no data to judge). When no
 * fixture data exists at all, every found player counts — absence of data is
 * not evidence of a blank, matching the original `undefined !== 0` intent.
 * A double gameweek still counts once: this is "does he play", not "how often".
 */
export function countPlayersWithFixture(
  picks: SquadPick[],
  playerMap: Map<number, MergedPlayer>,
): number {
  const gw = nextGameweekId([...playerMap.values()])
  let count = 0
  for (const pick of picks) {
    const p = playerMap.get(pick.element)
    if (!p) continue
    if (gw === null) { count++; continue }
    if ((p.fixtures ?? []).some((f) => f.event_id === gw)) count++
  }
  return count
}
