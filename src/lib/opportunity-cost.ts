// Phase 50 (OCS-01..OCS-05): computeOpportunityCostRows — pure mapping function.
// Maps suggestTransfers() output (TransferSuggestion[]) into OCSRow[] for the
// OpportunityCostTable UI. Mirrors src/lib/suggest-transfers.ts pattern: no
// 'use client', no React, no side effects, importable in @vitest-environment node tests.
//
// Engine semantics this function relies on (verified in src/lib/suggest-transfers.ts):
//   - ftCount=1 → engine emits kind:'single' with cost:0 AND cost:4 (no combos).
//   - ftCount=2 → engine emits kind:'single' cost:0 AND kind:'combo' cost:0 (no hit single).
//   - Suggestions are sorted by xPtsGain desc — Array.find returns the BEST per type.
import type { TransferSuggestion, MergedPlayer } from './types'

export type OCSRowKind = 'roll' | 'single-free' | 'single-hit' | 'combo-free' | 'combo-hit'

export const MARGINAL_THRESHOLD = 1.0

export interface OCSRow {
  kind: OCSRowKind
  label: string
  xPtsGain: number
  xPtsGainNet: number
  xPtsGainPerGw: number
  breakEvenGws: number | null
  cost: 0 | 4
  transfers?: Array<{ sell: MergedPlayer; buy: MergedPlayer }>
  isMarginal?: boolean
}

export function computeOpportunityCostRows(
  suggestions: TransferSuggestion[],
  // ftCount accepted for API symmetry; engine emission rules already gate row presence.
  _ftCount: 1 | 2,
): OCSRow[] {
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
  })

  // Best 1-FT FREE single.
  const best1FTFree = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'single' }> =>
      s.kind === 'single' && s.cost === 0,
  )
  if (best1FTFree) {
    rows.push({
      kind: 'single-free',
      label: '1 FT',
      xPtsGain: best1FTFree.xPtsGain,
      xPtsGainNet: best1FTFree.xPtsGain,
      xPtsGainPerGw: best1FTFree.xPtsGainPerGw,
      breakEvenGws: null,
      cost: 0,
      transfers: [{ sell: best1FTFree.sell, buy: best1FTFree.buy }],
    })
  }

  // Best 1-FT HIT single (only emitted by engine when ftCount=1).
  const best1FTHit = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'single' }> =>
      s.kind === 'single' && s.cost === 4,
  )
  if (best1FTHit) {
    rows.push({
      kind: 'single-hit',
      label: '1 FT (Hit)',
      xPtsGain: best1FTHit.xPtsGain,
      xPtsGainNet: best1FTHit.xPtsGain - 4,
      xPtsGainPerGw: best1FTHit.xPtsGainPerGw,
      breakEvenGws: best1FTHit.breakEvenGws,
      cost: 4,
      transfers: [{ sell: best1FTHit.sell, buy: best1FTHit.buy }],
    })
  }

  // Best 2-FT FREE combo (only emitted by engine when ftCount=2).
  const best2FTCombo = suggestions.find(
    (s): s is Extract<TransferSuggestion, { kind: 'combo' }> =>
      s.kind === 'combo' && s.cost === 0,
  )
  if (best2FTCombo) {
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
    })
  }

  return rows
}
