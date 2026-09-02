// CHIP-02 (2026-09-02): chip signals judged against the LOADED squad.
// chip_advisor.py computes them from the pipeline's simulated squad, so a
// bench of zero-minute fillers was being recommended for a Bench Boost.
import { describe, it, expect } from 'vitest'
import { computeSquadChipSignals, BB_PLAY, TC_PLAY } from '@/lib/squad-chip-advice'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

function pl(id: number, xp: number, opts: { ceiling?: number; gws?: number[]; status?: string } = {}): MergedPlayer {
  return {
    id, web_name: `P${id}`, element_type: 3, team: id, now_cost: 50,
    status: opts.status ?? 'a', xPts_1gw: xp, xPts_90th_1gw: opts.ceiling,
    fixtures: (opts.gws ?? [7]).map(event_id => ({
      opponent_team: 'OPP', is_home: true, event_id,
      difficulty_score: 0.5, difficulty_tier: 'medium' as const,
      attacking_difficulty: 0.5, defensive_difficulty: 0.5,
    })),
  } as unknown as MergedPlayer
}

/** 11 starters then 4 bench, mirroring FPL pick positions. */
const squadPicks = (ids: number[]): SquadPick[] => ids.map((element, i) => ({
  element, position: i + 1, multiplier: 1, is_captain: false, is_vice_captain: false,
}))

describe('computeSquadChipSignals', () => {
  it('holds the bench boost when the real bench barely plays', () => {
    // The reported squad: bench fillers on ~0 xPts.
    const players = [...Array(11)].map((_, i) => pl(i + 1, 5))
      .concat([pl(12, 0), pl(13, 0.4), pl(14, 0), pl(15, 0.2)])
    const s = computeSquadChipSignals(squadPicks(players.map(p => p.id)), players)!
    expect(s.benchXPts).toBeLessThan(BB_PLAY)
    expect(s.benchBoost).toBe('hold')
  })

  it('plays it when the real bench is strong', () => {
    const players = [...Array(11)].map((_, i) => pl(i + 1, 5))
      .concat([pl(12, 4), pl(13, 4), pl(14, 4), pl(15, 4)])
    const s = computeSquadChipSignals(squadPicks(players.map(p => p.id)), players)!
    expect(s.benchXPts).toBe(16)
    expect(s.benchBoost).toBe('play')
  })

  it('names a triple-captain candidate from the squad only', () => {
    const players = [pl(1, 8, { ceiling: 12 }), ...[...Array(14)].map((_, i) => pl(i + 2, 2))]
    const s = computeSquadChipSignals(squadPicks(players.map(p => p.id)), players)!
    expect(s.captainName).toBe('P1')
    expect(s.captainCeiling).toBeGreaterThanOrEqual(TC_PLAY)
    expect(s.tripleCaptain).toBe('play')
  })

  it('ignores unavailable players and those without a fixture as captains', () => {
    const players = [
      pl(1, 9, { ceiling: 20, status: 'i' }),      // injured
      pl(2, 9, { ceiling: 19, gws: [9] }),         // blanks this GW
      pl(3, 5, { ceiling: 8 }),                    // the real best option
      ...[...Array(12)].map((_, i) => pl(i + 4, 1)),
    ]
    const s = computeSquadChipSignals(squadPicks(players.map(p => p.id)), players)!
    expect(s.captainName).toBe('P3')
  })

  it('counts how many of the 15 blank', () => {
    const players = [pl(1, 5, { gws: [9] }), pl(2, 5, { gws: [9] }),
                     ...[...Array(13)].map((_, i) => pl(i + 3, 5))]
    const s = computeSquadChipSignals(squadPicks(players.map(p => p.id)), players)!
    expect(s.blanks).toBe(2)
  })

  it('returns null when there is nothing to judge', () => {
    expect(computeSquadChipSignals([], [pl(1, 5)])).toBeNull()
    expect(computeSquadChipSignals(squadPicks([1]), [])).toBeNull()
  })
})
