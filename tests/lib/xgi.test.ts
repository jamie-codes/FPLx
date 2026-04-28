import { describe, it, expect } from 'vitest'
import { computeXgiInvolvement } from '@/lib/xgi'
import type { MergedPlayer } from '@/lib/types'

function makePlayer(p: { id: number; team: number; xg?: number; xa?: number }): MergedPlayer {
  return {
    id: p.id,
    team: p.team,
    expected_goals: p.xg ?? 0,
    expected_assists: p.xa ?? 0,
  } as unknown as MergedPlayer
}

describe('computeXgiInvolvement', () => {
  it('computes per-player share within a single team (0.4 and 0.6 for 4 and 6)', () => {
    const players = [
      makePlayer({ id: 1, team: 10, xg: 3, xa: 1 }), // 4
      makePlayer({ id: 2, team: 10, xg: 4, xa: 2 }), // 6
    ]
    const result = computeXgiInvolvement(players)
    expect(result.get(1)).toBeCloseTo(0.4, 5)
    expect(result.get(2)).toBeCloseTo(0.6, 5)
  })

  it('omits players from teams whose total xGI is zero (zero-division guard)', () => {
    const players = [
      makePlayer({ id: 1, team: 10, xg: 0, xa: 0 }),
      makePlayer({ id: 2, team: 10, xg: 0, xa: 0 }),
    ]
    const result = computeXgiInvolvement(players)
    expect(result.has(1)).toBe(false)
    expect(result.has(2)).toBe(false)
    expect(result.size).toBe(0)
  })

  it('returns share of 1.0 for a single-player team', () => {
    const result = computeXgiInvolvement([makePlayer({ id: 7, team: 5, xg: 2, xa: 3 })])
    expect(result.get(7)).toBeCloseTo(1.0, 5)
  })

  it('isolates each player\'s share to their own team total (multi-team)', () => {
    const players = [
      makePlayer({ id: 1, team: 10, xg: 5, xa: 5 }), // team 10 total = 10, share = 1.0
      makePlayer({ id: 2, team: 20, xg: 1, xa: 1 }), // team 20 total = 4, share = 0.5
      makePlayer({ id: 3, team: 20, xg: 2, xa: 0 }), // team 20 total = 4, share = 0.5
    ]
    const result = computeXgiInvolvement(players)
    expect(result.get(1)).toBeCloseTo(1.0, 5)
    expect(result.get(2)).toBeCloseTo(0.5, 5)
    expect(result.get(3)).toBeCloseTo(0.5, 5)
  })

  it('treats zero expected_goals/expected_assists as 0 contribution (no throw)', () => {
    const players = [
      makePlayer({ id: 1, team: 10, xg: 0, xa: 0 }),
      makePlayer({ id: 2, team: 10, xg: 8, xa: 2 }), // team total = 10
    ]
    const result = computeXgiInvolvement(players)
    expect(result.get(1)).toBeCloseTo(0, 5)
    expect(result.get(2)).toBeCloseTo(1.0, 5)
  })
})
