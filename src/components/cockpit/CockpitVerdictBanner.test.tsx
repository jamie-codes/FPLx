// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildVerdict } from './CockpitVerdictBanner'
import type { TransferAdvice, ChipAdvice, ChipAdviceEntry, CaptainPicks } from '@/lib/types'

function mkTransfer(over: Partial<TransferAdvice> = {}): TransferAdvice {
  return {
    gw: 1, generated_at: '', moves: [], n_free_used: 0, n_hits: 0,
    predicted_gain: 0, net_gain: 0, hold: false, new_squad_ids: [],
    ...over,
  }
}
function mkMove(outName: string, inName: string) {
  return {
    out: { id: 1, name: outName, element_type: 3 as const, cost: 80, value: 5 },
    in: { id: 2, name: inName, element_type: 3 as const, cost: 83, value: 6 },
    gain: 3.2, hit: false, reason: 'x',
  }
}
function mkChip(over: Partial<ChipAdvice['chips']> = {}): ChipAdvice {
  const hold: ChipAdviceEntry = { signal: 'hold', reason: '' }
  return {
    gw: 1, generated_at: '', dgw_team_count: 0, bgw_team_count: 0,
    chips: { bench_boost: hold, triple_captain: hold, free_hit: hold, wildcard: hold, ...over },
    note: '',
  }
}
function mkCaptain(name: string | null): CaptainPicks {
  return {
    generated_at: '', gameweek: 1,
    ceiling: name
      ? { id: 1, name, team: 'ARS', position: 'MID', now_cost: 95, xPts_1gw: 7.1, xPts_90th_1gw: 11, selected_by_percent: '12.4' }
      : null,
    eo_adjusted: null,
  }
}

describe('buildVerdict', () => {
  it('composes transfer + captain + hold-chips with gain', () => {
    const v = buildVerdict(
      mkTransfer({ moves: [mkMove('Ünal', 'Marmoush')], predicted_gain: 4.7 }),
      mkChip(),
      mkCaptain('Saka'),
    )
    expect(v?.sentence).toBe('Make one transfer (Ünal → Marmoush), captain Saka, hold all chips.')
    expect(v?.gain).toBe(4.7)
  })

  it('uses Hold copy and null gain when transfer.hold', () => {
    const v = buildVerdict(mkTransfer({ hold: true }), mkChip(), mkCaptain('Saka'))
    expect(v?.sentence).toBe('Hold — no transfer, captain Saka, hold all chips.')
    expect(v?.gain).toBeNull()
  })

  it('names a chip to play when its signal is play', () => {
    const v = buildVerdict(
      mkTransfer({ hold: true }),
      mkChip({ bench_boost: { signal: 'play', reason: '' } }),
      mkCaptain('Haaland'),
    )
    expect(v?.sentence).toContain('play Bench Boost')
  })

  it('pluralises multiple transfers with an ellipsis', () => {
    const v = buildVerdict(
      mkTransfer({ moves: [mkMove('A', 'B'), mkMove('C', 'D')], predicted_gain: 2 }),
      mkChip(),
      mkCaptain(null),
    )
    expect(v?.sentence).toContain('Make 2 transfers (A → B, …)')
  })

  it('returns null when all inputs are undefined', () => {
    expect(buildVerdict(undefined, undefined, undefined)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// VERDICT-01 (2026-09-02): the banner named a player the user has never owned.
//
// It read transfer_advice.json, which the pipeline generates from its own
// SIMULATED model squad (transfer_advisor advance_and_advise). Presented under
// "This week's verdict" that reads as personal advice. When a team is loaded
// the verdict must come from that squad; the model advice is only a fallback,
// and must say so.
// ---------------------------------------------------------------------------
describe('buildVerdict — whose squad is it about', () => {
  const captain = { ceiling: { name: 'B.Fernandes' } } as never
  const chip = { chips: { bench_boost: { signal: 'play' } } } as never

  const userAdvice = {
    hold: false,
    moves: [{ out: { name: 'Mukiele' }, in: { name: 'Gabriel' } }],
    predicted_gain: 4.2,
  } as never

  const modelAdvice = {
    hold: false,
    moves: [{ out: { name: 'Georginio' }, in: { name: 'João Pedro' } }],
    predicted_gain: 9.9,
  } as never

  it('names players from the loaded squad, not the model squad', () => {
    const v = buildVerdict(userAdvice, chip, captain)!
    expect(v.sentence).toContain('Mukiele')
    expect(v.sentence).not.toContain('Georginio')
  })

  it('marks model-squad advice as such so it cannot read as personal', () => {
    const v = buildVerdict(modelAdvice, chip, captain, { isModelSquad: true })!
    expect(v.sentence.toLowerCase()).toContain('model squad')
  })

  it('does not add that caveat for the user is own squad', () => {
    const v = buildVerdict(userAdvice, chip, captain)!
    expect(v.sentence.toLowerCase()).not.toContain('model squad')
  })
})

// ---------------------------------------------------------------------------
// VERDICT-02 (2026-09-02): the chip clause had the same defect as the transfer
// clause. build_chip_advice reads ledger['bench'] / model_xi, so "play Bench
// Boost" reflects the MODEL squad's bench. A user whose own bench is two
// zero-minute fillers would be told to boost it.
// ---------------------------------------------------------------------------
describe('buildVerdict — bench boost must reflect the loaded bench', () => {
  const captain = { ceiling: { name: 'B.Fernandes' } } as never
  const modelSaysPlay = { chips: { bench_boost: { signal: 'play' } } } as never
  const hold = { hold: true, moves: [], predicted_gain: 0 } as never

  it('drops the boost recommendation when the loaded bench is weak', () => {
    const v = buildVerdict(hold, modelSaysPlay, captain, { userBenchXPts: 3.2 })!
    expect(v.sentence).not.toContain('Bench Boost')
  })

  it('keeps it when the loaded bench is genuinely strong', () => {
    const v = buildVerdict(hold, modelSaysPlay, captain, { userBenchXPts: 18.0 })!
    expect(v.sentence).toContain('Bench Boost')
  })

  it('defers to the model signal when no squad is loaded', () => {
    const v = buildVerdict(hold, modelSaysPlay, captain, { isModelSquad: true })!
    expect(v.sentence).toContain('Bench Boost')
  })
})
