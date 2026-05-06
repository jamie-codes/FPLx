// Phase 75 HEAT-06 — LOOKAHEAD bump 16→32 + tier() named export
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeClubForm, tier } from '@/lib/club-form'

interface RawFixture {
  team_h: number
  team_a: number
  team_h_score: number | null
  team_a_score: number | null
  team_h_difficulty: number
  team_a_difficulty: number
  event: number | null
  finished: boolean
}

function makeFixture(opts: Partial<RawFixture> & { event: number; team_h: number; team_a: number }): RawFixture {
  return {
    team_h_score: null,
    team_a_score: null,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    finished: false,
    ...opts,
  }
}

describe('LOOKAHEAD = 32 (Phase 75 HEAT-06)', () => {
  it('caps upcoming_fixtures at 32 per team when >32 unfinished fixtures exist', () => {
    const bootstrap = {
      teams: [
        { id: 1, name: 'Arsenal', short_name: 'ARS' },
        { id: 2, name: 'Chelsea', short_name: 'CHE' },
      ],
    }
    // 40 unfinished fixtures, ARS vs CHE every event
    const fixtures = Array.from({ length: 40 }, (_, i) =>
      makeFixture({ team_h: 1, team_a: 2, event: i + 1 })
    )
    const result = computeClubForm(bootstrap, fixtures)
    const ars = result.find(t => t.team_id === 1)!
    const che = result.find(t => t.team_id === 2)!
    expect(ars.upcoming_fixtures.length).toBe(32)
    expect(che.upcoming_fixtures.length).toBe(32)
  })

  it('does not pad when fewer than 32 unfinished fixtures exist', () => {
    const bootstrap = {
      teams: [
        { id: 1, name: 'Arsenal', short_name: 'ARS' },
        { id: 2, name: 'Chelsea', short_name: 'CHE' },
      ],
    }
    const fixtures = Array.from({ length: 10 }, (_, i) =>
      makeFixture({ team_h: 1, team_a: 2, event: i + 1 })
    )
    const result = computeClubForm(bootstrap, fixtures)
    const ars = result.find(t => t.team_id === 1)!
    expect(ars.upcoming_fixtures.length).toBe(10)
  })
})

describe('tier() named export (Phase 75 HEAT-07 prep)', () => {
  it('returns "easy" when difficulty <= 0.4', () => {
    expect(tier(0)).toBe('easy')
    expect(tier(0.3)).toBe('easy')
    expect(tier(0.4)).toBe('easy')   // boundary inclusive
  })
  it('returns "hard" when difficulty >= 0.6', () => {
    expect(tier(0.6)).toBe('hard')   // boundary inclusive
    expect(tier(0.71)).toBe('hard')
    expect(tier(1)).toBe('hard')
  })
  it('returns "medium" when 0.4 < difficulty < 0.6', () => {
    expect(tier(0.41)).toBe('medium')
    expect(tier(0.5)).toBe('medium')
    expect(tier(0.59)).toBe('medium')
  })
})
