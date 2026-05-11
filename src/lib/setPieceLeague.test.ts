// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { aggregateSetPieceLeague, computeCompositeScore, formatScore } from './setPieceLeague'
import type { SetPieceTeam, SetPieceChanges } from './types'

function makeTeam(
  shortName: string,
  cornerScore: number | null,
  fkScore: number | null,
  takerName = 'Test Taker',
) {
  return {
    team_id: shortName.charCodeAt(0),
    team_short_name: shortName,
    penalty_taker: { id: 1, name: 'Penalty Taker', changed: false },
    fk_taker: { id: 2, name: takerName, changed: false, fk_danger_score: fkScore, sp_sample_n: fkScore !== null ? 10 : null },
    corner_taker: { id: 3, name: takerName, changed: false, corner_danger_score: cornerScore, sp_sample_n: cornerScore !== null ? 12 : null },
  } as SetPieceTeam
}

describe('setPieceLeague — Phase 95 SPQ-04', () => {
  // computeCompositeScore cases

  it('computeCompositeScore: both scores present — returns mean', () => {
    expect(computeCompositeScore(0.084, 0.102)).toBeCloseTo(0.093, 5)
  })

  it('computeCompositeScore: corner only (fk null) — returns corner score', () => {
    expect(computeCompositeScore(0.084, null)).toBe(0.084)
  })

  it('computeCompositeScore: fk only (corner null) — returns fk score', () => {
    expect(computeCompositeScore(null, 0.102)).toBe(0.102)
  })

  it('computeCompositeScore: both null — returns null (insufficient gate)', () => {
    expect(computeCompositeScore(null, null)).toBe(null)
  })

  // aggregateSetPieceLeague cases

  it('aggregateSetPieceLeague: sorts descending by composite score', () => {
    const changes: SetPieceChanges = {
      teams: [makeTeam('ARS', 0.060, 0.080), makeTeam('CHE', 0.090, 0.100)],
      change_count: 0,
      has_changes: false,
    }
    const { ranked } = aggregateSetPieceLeague(changes)
    expect(ranked[0].team_short_name).toBe('CHE')
    expect(ranked[1].team_short_name).toBe('ARS')
  })

  it('aggregateSetPieceLeague: tie-breaker is alphabetical by team_short_name', () => {
    const changes: SetPieceChanges = {
      teams: [makeTeam('MCI', 0.084, 0.096), makeTeam('ARS', 0.084, 0.096)],
      change_count: 0,
      has_changes: false,
    }
    const { ranked } = aggregateSetPieceLeague(changes)
    expect(ranked[0].team_short_name).toBe('ARS')
    expect(ranked[1].team_short_name).toBe('MCI')
  })

  it('aggregateSetPieceLeague: both-null team goes to insufficient not ranked', () => {
    const changes: SetPieceChanges = {
      teams: [makeTeam('SOU', null, null)],
      change_count: 0,
      has_changes: false,
    }
    const { ranked, insufficient } = aggregateSetPieceLeague(changes)
    expect(ranked.length).toBe(0)
    expect(insufficient.length).toBe(1)
    expect(insufficient[0].team_short_name).toBe('SOU')
  })

  it('aggregateSetPieceLeague: empty input returns empty ranked and insufficient', () => {
    const changes: SetPieceChanges = {
      teams: [],
      change_count: 0,
      has_changes: false,
    }
    const { ranked, insufficient } = aggregateSetPieceLeague(changes)
    expect(ranked.length).toBe(0)
    expect(insufficient.length).toBe(0)
  })
})
