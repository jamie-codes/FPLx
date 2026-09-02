// FT-02 (2026-09-02): suggestTransfers with ROLLED free transfers.
//
// The engine was typed `ftCount: 1 | 2` and enumerated at most two legs, so a
// manager who had banked transfers (FPL allows five) could not be shown a plan
// that used them. Exhaustive enumeration is impossible past two legs, so 3+ is
// assembled greedily from the best individually-positive legs.
import { describe, it, expect } from 'vitest'
import { suggestTransfers } from '@/lib/suggest-transfers'
import type { MergedPlayer, TransferSuggestion } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

function mk(id: number, pos: 1 | 2 | 3 | 4, cost: number, xp: number, team: number): MergedPlayer {
  return {
    id, web_name: `P${id}`, element_type: pos, now_cost: cost, team, status: 'a',
    xmins: 85, start_prob: 0.95, xg_per90: 0.3, xa_per90: 0.1,
    xPts_1gw: xp, xPts_3gw: xp * 3, xPts_5gw: xp * 5,
    fixtures: [{ opponent_team: 'OPP', is_home: true, event_id: 7,
                 difficulty_score: 0.5, difficulty_tier: 'medium' as const,
                 attacking_difficulty: 0.5, defensive_difficulty: 0.5 }],
  } as unknown as MergedPlayer
}

/** 15 weak owned players and a market of clearly better ones in each position. */
function scenario() {
  const owned: MergedPlayer[] = []
  const types: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  types.forEach((pos, i) => owned.push(mk(i + 1, pos, 50, 2.0, (i % 15) + 1)))
  const market: MergedPlayer[] = []
  let id = 100
  for (const pos of [1, 2, 3, 4] as const) {
    for (let i = 0; i < 6; i++) market.push(mk(id++, pos, 50, 6.0 + i, 16 + (id % 4)))
  }
  const picks: SquadPick[] = owned.map((p, i) => ({
    element: p.id, position: i + 1, multiplier: 1, is_captain: false, is_vice_captain: false,
  }))
  return { picks, players: [...owned, ...market] }
}

const multis = (s: TransferSuggestion[]) =>
  s.filter((x): x is Extract<TransferSuggestion, { kind: 'multi' }> => x.kind === 'multi')

describe('suggestTransfers with rolled free transfers', () => {
  it('produces 3+ leg suggestions when transfers are banked', () => {
    const { picks, players } = scenario()
    const out = suggestTransfers({ currentPicks: picks, players, horizon: 1, ftCount: 4, bank: 100 })
    const m = multis(out)
    expect(m.length).toBeGreaterThan(0)
    expect(Math.max(...m.map(x => x.transfers.length))).toBeGreaterThanOrEqual(3)
  })

  it('charges nothing when the legs fit inside the banked transfers', () => {
    const { picks, players } = scenario()
    const out = suggestTransfers({ currentPicks: picks, players, horizon: 1, ftCount: 5, bank: 100 })
    for (const m of multis(out)) {
      if (m.transfers.length <= 5) expect(m.cost).toBe(0)
    }
  })

  it('charges 4 points per leg beyond the free transfers', () => {
    const { picks, players } = scenario()
    const out = suggestTransfers({ currentPicks: picks, players, horizon: 1, ftCount: 1, bank: 100 })
    const three = multis(out).find(m => m.transfers.length === 3)
    expect(three).toBeDefined()
    expect(three!.cost).toBe(8)          // 3 legs, 1 free -> 2 hits
  })

  it('never sells or buys the same player twice within one plan', () => {
    const { picks, players } = scenario()
    const out = suggestTransfers({ currentPicks: picks, players, horizon: 1, ftCount: 5, bank: 100 })
    for (const m of multis(out)) {
      const sells = m.transfers.map(t => t.sell.id)
      const buys = m.transfers.map(t => t.buy.id)
      expect(new Set(sells).size).toBe(sells.length)
      expect(new Set(buys).size).toBe(buys.length)
    }
  })

  it('respects the budget across every leg', () => {
    const { picks, players } = scenario()
    // Bank 0 and every replacement costs the same as the outgoing player, so
    // each leg is exactly affordable; raising in-prices must break it.
    const dear = players.map(p => p.id >= 100 ? { ...p, now_cost: 200 } : p)
    const out = suggestTransfers({ currentPicks: picks, players: dear, horizon: 1, ftCount: 5, bank: 0 })
    expect(multis(out)).toHaveLength(0)
  })

  it('still returns the existing single and combo shapes', () => {
    const { picks, players } = scenario()
    const out = suggestTransfers({ currentPicks: picks, players, horizon: 1, ftCount: 2, bank: 100 })
    expect(out.some(s => s.kind === 'single')).toBe(true)
    expect(out.some(s => s.kind === 'combo')).toBe(true)
  })
})
