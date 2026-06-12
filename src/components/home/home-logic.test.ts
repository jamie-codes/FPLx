// UIX-02 Task 1: pure home logic — chip precedence, risk count, bank format,
// transfer headline extraction, XI projected points.
import { describe, it, expect } from 'vitest'
import type { LifecycleLabel } from '@/lib/lifecycle-label'
import type { OCSRow } from '@/lib/opportunity-cost'
import type { MergedPlayer } from '@/lib/types'
import {
  badgeFor,
  riskCount,
  formatBank,
  transferHeadline,
  xiProjectedPts,
} from './home-logic'

// ---- badgeFor: spec chip-precedence rule (risk label wins over verdict) ----

describe('badgeFor', () => {
  it('risk label beats verdict: sell_soon + hold verdict → SELL SOON warning', () => {
    expect(badgeFor('hold', 'sell_soon')).toEqual({ text: 'SELL SOON', intent: 'warning' })
  })

  it('risk label sell → negative even when verdict is buy', () => {
    expect(badgeFor('buy', 'sell')).toEqual({ text: 'SELL', intent: 'negative' })
  })

  it('minutes_trap and fixture_trap map to warning', () => {
    expect(badgeFor(undefined, 'minutes_trap')).toEqual({ text: 'MINS TRAP', intent: 'warning' })
    expect(badgeFor(undefined, 'fixture_trap')).toEqual({ text: 'FIX TRAP', intent: 'warning' })
  })

  it('verdict-only paths: sell → negative, buy → positive, hold → neutral', () => {
    expect(badgeFor('sell', undefined)).toEqual({ text: 'SELL', intent: 'negative' })
    expect(badgeFor('buy', undefined)).toEqual({ text: 'BUY', intent: 'positive' })
    expect(badgeFor('hold', undefined)).toEqual({ text: 'HOLD', intent: 'neutral' })
  })

  it('non-risk lifecycle labels (hold, buy_next_week, hold_one_more) fall through to verdict', () => {
    expect(badgeFor('buy', 'hold')).toEqual({ text: 'BUY', intent: 'positive' })
    expect(badgeFor('sell', 'buy_next_week')).toEqual({ text: 'SELL', intent: 'negative' })
    expect(badgeFor('hold', 'hold_one_more')).toEqual({ text: 'HOLD', intent: 'neutral' })
  })

  it('no verdict, no label → HOLD neutral', () => {
    expect(badgeFor(undefined, undefined)).toEqual({ text: 'HOLD', intent: 'neutral' })
  })
})

// ---- riskCount: only the 4-risk subset counts ----

describe('riskCount', () => {
  it('counts only sell / sell_soon / minutes_trap / fixture_trap', () => {
    const labels = new Map<number, LifecycleLabel>([
      [1, 'sell'],
      [2, 'sell_soon'],
      [3, 'minutes_trap'],
      [4, 'fixture_trap'],
      [5, 'hold'],
      [6, 'buy_next_week'],
      [7, 'hold_one_more'],
    ])
    expect(riskCount(labels)).toBe(4)
  })

  it('empty map → 0', () => {
    expect(riskCount(new Map())).toBe(0)
  })
})

// ---- formatBank: entry_history.bank is tenths of £m ----

describe('formatBank', () => {
  it('formatBank(5) = £0.5m', () => {
    expect(formatBank(5)).toBe('£0.5m')
  })
  it('formatBank(0) = £0.0m and formatBank(23) = £2.3m', () => {
    expect(formatBank(0)).toBe('£0.0m')
    expect(formatBank(23)).toBe('£2.3m')
  })
})

// ---- transferHeadline: first non-roll OCS row with transfer legs ----

function mkPlayer(over: Partial<MergedPlayer>): MergedPlayer {
  return { id: 0, web_name: 'P', team_short_name: 'XXX', element_type: 3, now_cost: 50, ...over } as MergedPlayer
}

function mkRow(over: Partial<OCSRow>): OCSRow {
  return {
    kind: 'roll',
    label: 'Roll',
    xPtsGain: 0,
    xPtsGainNet: 0,
    xPtsGainPerGw: 0,
    breakEvenGws: null,
    cost: 0,
    bankAfter: 0,
    isAffordable: true,
    ...over,
  } as OCSRow
}

describe('transferHeadline', () => {
  const sell = mkPlayer({ id: 10, web_name: 'Selman' })
  const buy = mkPlayer({ id: 20, web_name: 'Buyer' })

  it('skips the Roll row and returns the first row with transfer legs', () => {
    const rows = [
      mkRow({}),
      mkRow({ kind: 'single-free', label: '1 free', xPtsGain: 1.4, transfers: [{ sell, buy }] }),
    ]
    const h = transferHeadline(rows)
    expect(h).not.toBeNull()
    expect(h!.sellName).toBe('Selman')
    expect(h!.buyName).toBe('Buyer')
    expect(h!.gain).toBeCloseTo(1.4)
    expect(h!.costLabel).toBe('Free transfer')
  })

  it('hit rows include cost and break-even in the cost label', () => {
    const rows = [
      mkRow({}),
      mkRow({ kind: 'single-hit', xPtsGain: 5.2, cost: 4, breakEvenGws: 2, transfers: [{ sell, buy }] }),
    ]
    expect(transferHeadline(rows)!.costLabel).toBe('-4 pt hit · breaks even in 2 GWs')
  })

  it('returns null when no row has transfers (roll-only)', () => {
    expect(transferHeadline([mkRow({})])).toBeNull()
    expect(transferHeadline([])).toBeNull()
  })
})

// ---- xiProjectedPts: starters sum + captain doubled (LineupTab semantics) ----

describe('xiProjectedPts', () => {
  it('sums starter xPts_1gw and adds the captain bonus once more', () => {
    const players = [
      mkPlayer({ id: 1, xPts_1gw: 4 }),
      mkPlayer({ id: 2, xPts_1gw: 6 }),
      mkPlayer({ id: 3, xPts_1gw: 2 }),
    ]
    // starters 1+2 (=10), captain id 2 doubles (+6) → 16; player 3 not a starter
    expect(xiProjectedPts([1, 2], 2, players)).toBeCloseTo(16)
  })

  it('missing players / undefined xPts count as 0', () => {
    const players = [mkPlayer({ id: 1 })]
    expect(xiProjectedPts([1, 99], 99, players)).toBe(0)
  })
})
