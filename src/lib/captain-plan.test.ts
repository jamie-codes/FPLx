import { describe, it, expect } from 'vitest'
import { bestCaptainPerGw } from './captain-plan'
import type { MergedPlayer, PlanStep } from './types'

function mkP(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 0, web_name: 'P', team_short_name: 'ARS', gw_xpts: [], fixtures: [],
    ...over,
  } as unknown as MergedPlayer
}
function mkStep(gw: number, positionsAfter: Record<number, number>): PlanStep {
  return { gw, positionsAfter, transfersIn: [], transfersOut: [], chip: null } as unknown as PlanStep
}

describe('bestCaptainPerGw', () => {
  it('picks the highest-gw_xpts STARTER for each step (not bench, not by xPts_1gw)', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'Starter8', gw_xpts: [8] })],
      [2, mkP({ id: 2, web_name: 'Starter5', gw_xpts: [5] })],
      [3, mkP({ id: 3, web_name: 'Bench10', gw_xpts: [10] })], // higher, but benched
    ])
    const steps = [mkStep(1, { 1: 1, 2: 2, 3: 12 })] // p1 & p2 start (pos 1,2); p3 benched (pos 12)
    const r = bestCaptainPerGw(steps, players)
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Starter8')
    expect(r[0].xpts).toBe(8)
    expect(r[0].gw).toBe(1)
  })

  it('indexes gw_xpts by step position across the horizon', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'A', gw_xpts: [8, 3] })],
      [2, mkP({ id: 2, web_name: 'B', gw_xpts: [5, 9] })],
    ])
    const steps = [mkStep(1, { 1: 1, 2: 2 }), mkStep(2, { 1: 1, 2: 2 })]
    const r = bestCaptainPerGw(steps, players)
    expect(r.map((e) => e.name)).toEqual(['A', 'B']) // GW1: A(8>5); GW2: B(9>3)
  })

  it('formats the opponent from the step-GW fixture', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'A', gw_xpts: [8], fixtures: [{ event_id: 1, opponent_team: 'MUN', is_home: true } as never] })],
    ])
    const r = bestCaptainPerGw([mkStep(1, { 1: 1 })], players)
    expect(r[0].opponent).toBe('vs MUN (H)')
  })

  it('returns [] for empty steps', () => {
    expect(bestCaptainPerGw([], new Map())).toEqual([])
  })

  it('treats a missing gw_xpts[i] as 0', () => {
    const players = new Map<number, MergedPlayer>([
      [1, mkP({ id: 1, web_name: 'A', gw_xpts: [] })], // no entry for index 0
      [2, mkP({ id: 2, web_name: 'B', gw_xpts: [2] })],
    ])
    const r = bestCaptainPerGw([mkStep(1, { 1: 1, 2: 2 })], players)
    expect(r[0].name).toBe('B') // A scores 0, B scores 2
  })
})
