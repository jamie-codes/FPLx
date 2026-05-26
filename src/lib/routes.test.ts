import { describe, it, expect } from 'vitest'
import type { ScoredPlayer } from '@/lib/types'
import { computeRouteFlags } from './routes'

// Minimal stub — only the fields computeRouteFlags reads
function mkPlayer(overrides: Partial<ScoredPlayer>): ScoredPlayer {
  return {
    id: 1,
    team: 1,
    penalties_order: null,
    direct_freekicks_order: null,
    corners_and_indirect_freekicks_order: null,
    xg_per90: null,
    xa_per90: null,
    ...overrides,
  } as unknown as ScoredPlayer
}

describe('computeRouteFlags', () => {
  it('returns empty map for empty input', () => {
    expect(computeRouteFlags([]).size).toBe(0)
  })

  // ── Set-piece routes ────────────────────────────────────────────────────────

  it('pk: true when penalties_order === 1', () => {
    const p = mkPlayer({ id: 1, penalties_order: 1 })
    expect(computeRouteFlags([p]).get(1)!.pk).toBe(true)
  })

  it('pk: false when penalties_order is 2', () => {
    const p = mkPlayer({ id: 1, penalties_order: 2 })
    expect(computeRouteFlags([p]).get(1)!.pk).toBe(false)
  })

  it('pk: false when penalties_order is null', () => {
    const p = mkPlayer({ id: 1, penalties_order: null })
    expect(computeRouteFlags([p]).get(1)!.pk).toBe(false)
  })

  it('fk: true when direct_freekicks_order === 1', () => {
    const p = mkPlayer({ id: 1, direct_freekicks_order: 1 })
    expect(computeRouteFlags([p]).get(1)!.fk).toBe(true)
  })

  it('fk: false when direct_freekicks_order === 2', () => {
    const p = mkPlayer({ id: 1, direct_freekicks_order: 2 })
    expect(computeRouteFlags([p]).get(1)!.fk).toBe(false)
  })

  it('ck: true when corners_and_indirect_freekicks_order === 1', () => {
    const p = mkPlayer({ id: 1, corners_and_indirect_freekicks_order: 1 })
    expect(computeRouteFlags([p]).get(1)!.ck).toBe(true)
  })

  it('ck: false when corners_and_indirect_freekicks_order === 2', () => {
    const p = mkPlayer({ id: 1, corners_and_indirect_freekicks_order: 2 })
    expect(computeRouteFlags([p]).get(1)!.ck).toBe(false)
  })

  // ── xG route ────────────────────────────────────────────────────────────────

  it('xg: true when player xg_per90 is above team median', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xg_per90: 0.6 }),
      mkPlayer({ id: 2, team: 1, xg_per90: 0.2 }),
    ]
    expect(computeRouteFlags(players).get(1)!.xg).toBe(true)
    expect(computeRouteFlags(players).get(2)!.xg).toBe(false)
  })

  it('xg: true when player xg_per90 equals team median (>= not >)', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xg_per90: 0.4 }),
      mkPlayer({ id: 2, team: 1, xg_per90: 0.4 }),
    ]
    // median is 0.4; both are at the median → both true
    expect(computeRouteFlags(players).get(1)!.xg).toBe(true)
    expect(computeRouteFlags(players).get(2)!.xg).toBe(true)
  })

  it('xg: false when player xg_per90 is null', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xg_per90: null }),
      mkPlayer({ id: 2, team: 1, xg_per90: 0.5 }),
    ]
    expect(computeRouteFlags(players).get(1)!.xg).toBe(false)
  })

  it('xg: false for everyone when all team members have xg_per90 null', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xg_per90: null }),
      mkPlayer({ id: 2, team: 1, xg_per90: null }),
    ]
    expect(computeRouteFlags(players).get(1)!.xg).toBe(false)
    expect(computeRouteFlags(players).get(2)!.xg).toBe(false)
  })

  it('single non-null player on a team gets xg: true (they are at the median)', () => {
    const p = mkPlayer({ id: 1, team: 1, xg_per90: 0.3 })
    expect(computeRouteFlags([p]).get(1)!.xg).toBe(true)
  })

  it('two teams are computed independently — one team median does not affect the other', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xg_per90: 0.8 }), // team 1 median = 0.8
      mkPlayer({ id: 2, team: 2, xg_per90: 0.1 }), // team 2 median = 0.1
    ]
    // each player is the only one on their team → both at median → both true
    const map = computeRouteFlags(players)
    expect(map.get(1)!.xg).toBe(true)
    expect(map.get(2)!.xg).toBe(true)
  })

  // ── xA route (mirrors xG) ───────────────────────────────────────────────────

  it('xa: true when player xa_per90 is above team median', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xa_per90: 0.5 }),
      mkPlayer({ id: 2, team: 1, xa_per90: 0.1 }),
    ]
    expect(computeRouteFlags(players).get(1)!.xa).toBe(true)
    expect(computeRouteFlags(players).get(2)!.xa).toBe(false)
  })

  it('xa: true when player xa_per90 equals team median (>= not >)', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xa_per90: 0.3 }),
      mkPlayer({ id: 2, team: 1, xa_per90: 0.3 }),
    ]
    // median is 0.3; both are at the median → both true
    expect(computeRouteFlags(players).get(1)!.xa).toBe(true)
    expect(computeRouteFlags(players).get(2)!.xa).toBe(true)
  })

  it('xa: false when player xa_per90 is null', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xa_per90: null }),
      mkPlayer({ id: 2, team: 1, xa_per90: 0.4 }),
    ]
    expect(computeRouteFlags(players).get(1)!.xa).toBe(false)
  })

  it('xa: false for everyone when all team members have xa_per90 null', () => {
    const players = [
      mkPlayer({ id: 1, team: 1, xa_per90: null }),
      mkPlayer({ id: 2, team: 1, xa_per90: null }),
    ]
    expect(computeRouteFlags(players).get(1)!.xa).toBe(false)
    expect(computeRouteFlags(players).get(2)!.xa).toBe(false)
  })

  // ── median helper edge case ──────────────────────────────────────────────────

  it('uses average-of-two-middle for even-length teams (standard median)', () => {
    // team median of [0.2, 0.4, 0.6, 0.8] = (0.4 + 0.6) / 2 = 0.5
    const players = [
      mkPlayer({ id: 1, team: 1, xg_per90: 0.2 }),
      mkPlayer({ id: 2, team: 1, xg_per90: 0.4 }),
      mkPlayer({ id: 3, team: 1, xg_per90: 0.6 }),
      mkPlayer({ id: 4, team: 1, xg_per90: 0.8 }),
    ]
    const map = computeRouteFlags(players)
    // below median (0.5)
    expect(map.get(1)!.xg).toBe(false)
    expect(map.get(2)!.xg).toBe(false)
    // at or above median
    expect(map.get(3)!.xg).toBe(true)
    expect(map.get(4)!.xg).toBe(true)
  })
})
