import { describe, it, expect } from 'vitest'
import { compareTransfers } from './compare-transfers'
import type { MergedPlayer } from './types'

// Minimal MergedPlayer — only the fields compareTransfers + explainPick read.
function mk(over: Partial<MergedPlayer> = {}): MergedPlayer {
  return {
    id: 1, web_name: 'X', team_short_name: 'ARS', element_type: 3,
    now_cost: 80, selected_by_percent: '10.0', status: 'a', news: '',
    mins_risk: 'nailed', rotation_risk: false, penalties_order: null,
    xPts_1gw: 5, xPts_5gw: 20, haul_prob: 0.2, fixtures: [],
    xg_per90: 0.3, xa_per90: 0.2, blank_prob: 0.1,
    ...over,
  } as unknown as MergedPlayer
}

describe('compareTransfers', () => {
  it('adds a ceiling reason when x has higher haul_prob', () => {
    const r = compareTransfers(mk({ web_name: 'Marmoush', haul_prob: 0.28 }), mk({ web_name: 'Gordon', haul_prob: 0.19 }))
    expect(r.reasons).toContain('Higher ceiling: haul 28% vs 19%')
  })

  it('adds a horizon reason only when the edge grows over 5 GW', () => {
    const r = compareTransfers(
      mk({ xPts_1gw: 6, xPts_5gw: 25 }),   // Δ1 = +1.1, Δ5 = +3.2 vs y below
      mk({ xPts_1gw: 4.9, xPts_5gw: 21.8, haul_prob: 0.2 }),
    )
    expect(r.reasons.some(s => s.startsWith('xPts gap grows'))).toBe(true)
  })

  it('adds a penalty reason when x is on pens and y is not', () => {
    const r = compareTransfers(mk({ penalties_order: 1 }), mk({ web_name: 'Gordon', penalties_order: null }))
    expect(r.reasons).toContain('On penalties — Gordon isn’t')
  })

  it('adds a differential reason when x is >=10pp lower owned', () => {
    const r = compareTransfers(mk({ selected_by_percent: '3.0' }), mk({ web_name: 'Gordon', selected_by_percent: '18.0' }))
    expect(r.reasons.some(s => s.startsWith('More differential'))).toBe(true)
  })

  it('composes the risk line from explainPick + safer-floor note', () => {
    const r = compareTransfers(mk({ mins_risk: 'rotation_risk' }), mk({ web_name: 'Gordon' }))
    expect(r.risk).toBe('Rotation risk — Gordon is the safer floor pick')
  })

  it('yields no reasons for two near-identical players', () => {
    const r = compareTransfers(mk({ haul_prob: 0.2 }), mk({ haul_prob: 0.2 }))
    expect(r.reasons).toEqual([])
  })
})
