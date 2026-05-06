// Phase 50 (OCS-01..OCS-05): computeOpportunityCostRows — pure mapping function.
// Maps suggestTransfers() output (TransferSuggestion[]) into OCSRow[] for the
// OpportunityCostTable UI. Mirrors src/lib/suggest-transfers.ts pattern: no
// 'use client', no React, no side effects, importable in @vitest-environment node tests.
//
// Engine semantics this function relies on (verified in src/lib/suggest-transfers.ts):
//   - ftCount=1 → engine emits kind:'single' with cost:0 AND cost:4 AND kind:'combo' with cost:4.
//   - ftCount=2 → engine emits kind:'single' cost:0 AND kind:'combo' cost:0.
//   - Suggestions are sorted by xPtsGain desc — Array.find returns the BEST per type.
//   - D-07: −8 Hit row is derived from the best 2-FT combo (preferring cost:0 when ftCount=2,
//     falling back to cost:4 when ftCount=1). Not emitted by the engine.
//     Fix: gap-closure plan 074-05 (CR-01).
import type { TransferSuggestion, MergedPlayer } from './types'

export type OCSRowKind = 'roll' | 'single-free' | 'single-hit' | 'combo-free' | 'combo-hit' | 'combo-hit-8'

export const MARGINAL_THRESHOLD = 1.0

export interface OCSRow {
  kind: OCSRowKind
  label: string
  xPtsGain: number
  xPtsGainNet: number
  xPtsGainPerGw: number
  breakEvenGws: number | null
  cost: 0 | 4 | 8                        // widened from 0|4
  transfers?: Array<{ sell: MergedPlayer; buy: MergedPlayer }>
  isMarginal?: boolean
  bankAfter: number                       // bank remaining after this move, in tenths of £1m
  isAffordable: boolean                   // bankAfter >= 0
  disabledReason?: string                 // "Over budget by £X.Xm" when !isAffordable
}

export function computeOpportunityCostRows(
  suggestions: TransferSuggestion[],
  ftCount: 1 | 2,
  bank: number,                           // in tenths of £1m
): OCSRow[] {
  // Sell value for a player: the mapper does not receive the sellPrices map — it uses
  // the player's now_cost as a conservative proxy (same as the engine's fallback).
  const sellValueFor = (p: MergedPlayer): number => p.now_cost

  // Format affordability reason: "Over budget by £X.Xm" when bankAfter < 0.
  const formatDisabledReason = (bankAfter: number): string | undefined =>
    bankAfter < 0 ? `Over budget by £${(Math.abs(bankAfter) / 10).toFixed(1)}m` : undefined

  const rows: OCSRow[] = []

  // Row 0: Roll — always first, always 0 gain (OCS-04).
  rows.push({
    kind: 'roll',
    label: 'Roll',
    xPtsGain: 0,
    xPtsGainNet: 0,
    xPtsGainPerGw: 0,
    breakEvenGws: null,
    cost: 0,
    bankAfter: bank,
    isAffordable: bank >= 0,
    disabledReason: undefined,
  })

  // Best 1-FT FREE single.
  const best1FTFree = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'single' }> =>
      s.kind === 'single' && s.cost === 0,
  )
  if (best1FTFree) {
    const bankAfterSingle = bank + sellValueFor(best1FTFree.sell) - best1FTFree.buy.now_cost
    rows.push({
      kind: 'single-free',
      label: '1 FT',
      xPtsGain: best1FTFree.xPtsGain,
      xPtsGainNet: best1FTFree.xPtsGain,
      xPtsGainPerGw: best1FTFree.xPtsGainPerGw,
      breakEvenGws: null,
      cost: 0,
      transfers: [{ sell: best1FTFree.sell, buy: best1FTFree.buy }],
      bankAfter: bankAfterSingle,
      isAffordable: bankAfterSingle >= 0,
      disabledReason: formatDisabledReason(bankAfterSingle),
    })
  }

  // Best 2-FT combo — FREE (cost:0) when ftCount=2, HIT (cost:4) when ftCount=1.
  // Always enumerated by the engine (D-06) so we can derive the −8 Hit row from the best cost:0 combo.
  const best2FTCombo = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'combo' }> =>
      s.kind === 'combo' && s.cost === 0,
  )
  if (best2FTCombo) {
    const t1 = best2FTCombo.transfers[0]
    const t2 = best2FTCombo.transfers[1]
    const bankAfterCombo =
      bank + sellValueFor(t1.sell) + sellValueFor(t2.sell) - t1.buy.now_cost - t2.buy.now_cost
    rows.push({
      kind: 'combo-free',
      label: '2 FT',
      xPtsGain: best2FTCombo.xPtsGain,
      xPtsGainNet: best2FTCombo.xPtsGain,
      xPtsGainPerGw: best2FTCombo.xPtsGainPerGw,
      breakEvenGws: null,
      cost: 0,
      transfers: [...best2FTCombo.transfers],
      isMarginal: best2FTCombo.xPtsGain < MARGINAL_THRESHOLD,
      bankAfter: bankAfterCombo,
      isAffordable: bankAfterCombo >= 0,
      disabledReason: formatDisabledReason(bankAfterCombo),
    })
  }

  // Best 2-FT HIT combo (cost:4, emitted when ftCount=1).
  const best2FTHit = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'combo' }> =>
      s.kind === 'combo' && s.cost === 4,
  )
  if (best2FTHit) {
    const t1 = best2FTHit.transfers[0]
    const t2 = best2FTHit.transfers[1]
    const bankAfterComboHit =
      bank + sellValueFor(t1.sell) + sellValueFor(t2.sell) - t1.buy.now_cost - t2.buy.now_cost
    rows.push({
      kind: 'combo-hit',
      label: '2 FT (Hit)',
      xPtsGain: best2FTHit.xPtsGain,
      xPtsGainNet: best2FTHit.xPtsGain - 4,
      xPtsGainPerGw: best2FTHit.xPtsGainPerGw,
      breakEvenGws: best2FTHit.breakEvenGws,
      cost: 4,
      transfers: [...best2FTHit.transfers],
      isMarginal: (best2FTHit.xPtsGain - 4) < MARGINAL_THRESHOLD,
      bankAfter: bankAfterComboHit,
      isAffordable: bankAfterComboHit >= 0,
      disabledReason: formatDisabledReason(bankAfterComboHit),
    })
  }

  // Best 1-FT HIT single (only emitted by engine when ftCount=1).
  const best1FTHit = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'single' }> =>
      s.kind === 'single' && s.cost === 4,
  )
  if (best1FTHit) {
    const bankAfterHit = bank + sellValueFor(best1FTHit.sell) - best1FTHit.buy.now_cost
    rows.push({
      kind: 'single-hit',
      label: '−4 Hit',
      xPtsGain: best1FTHit.xPtsGain,
      xPtsGainNet: best1FTHit.xPtsGain - 4,
      xPtsGainPerGw: best1FTHit.xPtsGainPerGw,
      breakEvenGws: best1FTHit.breakEvenGws,
      cost: 4,
      transfers: [{ sell: best1FTHit.sell, buy: best1FTHit.buy }],
      bankAfter: bankAfterHit,
      isAffordable: bankAfterHit >= 0,
      disabledReason: formatDisabledReason(bankAfterHit),
    })
  }

  // −8 Hit row: reuses best 2-FT combo per D-07 (gap-closure 074-05 CR-01).
  // Prefers cost:0 combo (ftCount=2 path) but falls back to cost:4 combo (ftCount=1 path)
  // so the -8 Hit row is always present when any 2-transfer combo exists.
  const comboForHit8 = best2FTCombo ?? best2FTHit
  if (comboForHit8) {
    const t1 = comboForHit8.transfers[0]
    const t2 = comboForHit8.transfers[1]
    const bankAfter8 =
      bank + sellValueFor(t1.sell) + sellValueFor(t2.sell) - t1.buy.now_cost - t2.buy.now_cost
    rows.push({
      kind: 'combo-hit-8',
      label: '−8 Hit',
      xPtsGain: comboForHit8.xPtsGain,
      xPtsGainNet: comboForHit8.xPtsGain - 8,
      xPtsGainPerGw: comboForHit8.xPtsGainPerGw,
      breakEvenGws:
        comboForHit8.xPtsGainPerGw > 0
          ? Math.max(1, Math.ceil(8 / comboForHit8.xPtsGainPerGw))
          : null,
      cost: 8,
      transfers: [t1, t2],
      bankAfter: bankAfter8,
      isAffordable: bankAfter8 >= 0,
      disabledReason: formatDisabledReason(bankAfter8),
    })
  }

  return rows
}
