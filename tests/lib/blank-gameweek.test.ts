// BGW-02 (2026-09-01): "Blank gameweek warning: only 13 of your 15 players
// have a fixture this gameweek" fired in a completely normal gameweek where
// every club played.
//
// Cause: both LineupTab and OptimiserPanel treated `xPts_1gw === 0` as "no
// fixture". Zero projected points means the model expects the player not to
// PLAY — a squad-filler with no minutes all season projects 0 while his club
// plays as normal. Conflating the two turned two bench enablers into a fake
// blank gameweek. A blank is about the FIXTURE LIST, so that is what this
// checks.
import { describe, it, expect } from 'vitest'
import { countPlayersWithFixture, nextGameweekId } from '@/lib/blank-gameweek'
import type { MergedPlayer } from '@/lib/types'

function player(id: number, eventIds: number[], xPts?: number): MergedPlayer {
  return {
    id,
    web_name: `P${id}`,
    xPts_1gw: xPts,
    fixtures: eventIds.map((event_id) => ({
      opponent_team: 'OPP', is_home: true, event_id,
      difficulty_score: 0.5, difficulty_tier: 'medium',
      attacking_difficulty: 0.5, defensive_difficulty: 0.5,
    })),
  } as unknown as MergedPlayer
}

const picks = (ids: number[]) => ids.map((element, i) => ({
  element, position: i + 1, multiplier: 1, is_captain: false, is_vice_captain: false,
}))

describe('nextGameweekId', () => {
  it('is the earliest event id anyone still has a fixture for', () => {
    expect(nextGameweekId([player(1, [5, 6]), player(2, [4, 5])])).toBe(4)
  })

  it('is null with no fixture data at all', () => {
    expect(nextGameweekId([])).toBeNull()
    expect(nextGameweekId([player(1, [])])).toBeNull()
  })
})

describe('countPlayersWithFixture', () => {
  it('counts a zero-projection player who still has a fixture', () => {
    // The reported bug: two squad fillers project 0 points but their clubs play.
    const players = [
      player(1, [3], 5.0),
      player(2, [3], 0),        // no expected minutes — still has a fixture
      player(3, [3], 0),
    ]
    const map = new Map(players.map((p) => [p.id, p]))
    expect(countPlayersWithFixture(picks([1, 2, 3]), map)).toBe(3)
  })

  it('excludes a player whose club genuinely blanks', () => {
    const players = [
      player(1, [3], 5.0),
      player(2, [4], 4.0),      // nothing in GW3 — a real blank
    ]
    const map = new Map(players.map((p) => [p.id, p]))
    expect(countPlayersWithFixture(picks([1, 2]), map)).toBe(1)
  })

  it('counts a double gameweek player once', () => {
    const players = [player(1, [3, 3], 9.0)]
    const map = new Map(players.map((p) => [p.id, p]))
    expect(countPlayersWithFixture(picks([1]), map)).toBe(1)
  })

  it('excludes players missing from the player map', () => {
    expect(countPlayersWithFixture(picks([99]), new Map())).toBe(0)
  })

  it('counts everyone when no fixture data exists rather than crying blank', () => {
    // No pipeline fixture data is "unknown", not "blank" — the old code's
    // `undefined !== 0` intent, preserved.
    const players = [player(1, []), player(2, [])]
    const map = new Map(players.map((p) => [p.id, p]))
    expect(countPlayersWithFixture(picks([1, 2]), map)).toBe(2)
  })
})
