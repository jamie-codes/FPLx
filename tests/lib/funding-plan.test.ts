// FUND-01 (2026-09-02): planning a funded rebuild — "who do I sell and which
// bench slots do I downgrade to fodder, within the transfers I've rolled?"
import { describe, it, expect } from 'vitest'
import { computeFundingPlan } from '@/lib/funding-plan'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

function p(
  id: number, pos: 1 | 2 | 3 | 4, cost: number, team: number,
  opts: { xg?: number; xmins?: number; gws?: number[] } = {},
): MergedPlayer {
  return {
    id, web_name: `P${id}`, element_type: pos, now_cost: cost, team, status: 'a',
    xmins: opts.xmins ?? 85, start_prob: 0.95,
    xg_per90: opts.xg ?? 0.3, xa_per90: 0.1,
    fixtures: (opts.gws ?? [7, 8, 9]).map((event_id) => ({
      opponent_team: 'OPP', is_home: true, event_id,
      difficulty_score: 0.5, difficulty_tier: 'medium' as const,
      attacking_difficulty: 0.5, defensive_difficulty: 0.5,
    })),
  } as unknown as MergedPlayer
}

const picks = (ids: number[]): SquadPick[] => ids.map((element, i) => ({
  element, position: i + 1, multiplier: 1, is_captain: false, is_vice_captain: false,
}))

/** Squad of 4 + a market containing cheap playing replacements. */
function scenario() {
  const squad = [
    p(1, 3, 100, 1, { xg: 1.0 }),     // good mid
    p(2, 3, 90, 5, { xg: 0.9 }),      // Everton-ish mid to force-sell
    p(3, 2, 70, 2, { xg: 0.2 }),      // bench def, downgradeable
    p(4, 4, 60, 3, { xg: 0.2 }),      // bench fwd, downgradeable
  ]
  const market = [
    p(50, 3, 45, 9, { xg: 0.1 }),     // cheap mid who plays
    p(51, 2, 40, 10, { xg: 0.05 }),   // cheap def who plays
    p(52, 4, 42, 11, { xg: 0.05 }),   // cheap fwd who plays
    p(53, 2, 38, 12, { xg: 0.0, xmins: 0 }),  // cheaper but NEVER plays
  ]
  return { squad, players: [...squad, ...market] }
}

describe('computeFundingPlan', () => {
  it('frees cash by downgrading, and reports the projection given up', () => {
    const { squad, players } = scenario()
    const plan = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 5,
      freeTransfers: 2, startGw: 7, horizon: 3,
      downgradeCandidateIds: [3, 4],
    })
    expect(plan.moves.length).toBeGreaterThan(0)
    expect(plan.cashFreed).toBeGreaterThan(0)
    expect(plan.budgetAfter).toBe(5 + plan.cashFreed)
    expect(plan.xPtsCost).toBeGreaterThanOrEqual(0)
  })

  it('never downgrades to a player who does not play', () => {
    const { squad, players } = scenario()
    const plan = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 4, startGw: 7, horizon: 3,
      downgradeCandidateIds: [3, 4],
    })
    // id 53 is cheapest of all but has xmins 0 — picking it breaks autosubs.
    expect(plan.moves.map(m => m.buy.id)).not.toContain(53)
  })

  it('takes forced sales first even when they are poor value', () => {
    const { squad, players } = scenario()
    const plan = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 1, startGw: 7, horizon: 3,
      forceSellIds: [2],                 // the club being exited
      downgradeCandidateIds: [3, 4],
    })
    expect(plan.moves[0].sell.id).toBe(2)
    expect(plan.moves[0].forced).toBe(true)
  })

  it('respects the transfer budget and costs hits beyond it', () => {
    const { squad, players } = scenario()
    const plan = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 1, startGw: 7, horizon: 3,
      forceSellIds: [2], downgradeCandidateIds: [3, 4], maxMoves: 3,
    })
    expect(plan.transfersUsed).toBe(3)
    expect(plan.hits).toBe(2)             // 3 moves, 1 free
    expect(plan.pointsCost).toBe(8)
  })

  it('defaults the plan size to the transfers actually banked', () => {
    const { squad, players } = scenario()
    const plan = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 1, startGw: 7, horizon: 3,
      downgradeCandidateIds: [3, 4],
    })
    expect(plan.transfersUsed).toBeLessThanOrEqual(1)
    expect(plan.hits).toBe(0)
  })

  it('ranks the better cash-per-point downgrade first', () => {
    const { squad, players } = scenario()
    const plan = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 2, startGw: 7, horizon: 3,
      downgradeCandidateIds: [3, 4],
    })
    if (plan.moves.length >= 2) {
      expect(plan.moves[0].efficiency).toBeGreaterThanOrEqual(plan.moves[1].efficiency)
    }
  })

  it('uses selling prices when supplied rather than list price', () => {
    const { squad, players } = scenario()
    const base = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 1, startGw: 7, horizon: 3, downgradeCandidateIds: [3],
    })
    const withSell = computeFundingPlan({
      picks: picks(squad.map(s => s.id)), players, bank: 0,
      freeTransfers: 1, startGw: 7, horizon: 3, downgradeCandidateIds: [3],
      sellPrices: new Map([[3, 65]]),     // sold at a loss vs the 70 list price
    })
    expect(withSell.cashFreed).toBe(base.cashFreed - 5)
  })

  it('will not hand two sales the same replacement', () => {
    const squad = [p(1, 2, 70, 1), p(2, 2, 70, 2)]
    const market = [p(50, 2, 40, 9), p(51, 2, 41, 10)]
    const plan = computeFundingPlan({
      picks: picks([1, 2]), players: [...squad, ...market], bank: 0,
      freeTransfers: 2, startGw: 7, horizon: 3, downgradeCandidateIds: [1, 2],
    })
    const buyIds = plan.moves.map(m => m.buy.id)
    expect(new Set(buyIds).size).toBe(buyIds.length)
  })
})
