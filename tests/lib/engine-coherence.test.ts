// Engine coherence (2026-08-30): the 3-way verdict engine (recommend.ts) and
// the 7-label lifecycle engine (lifecycle-label.ts) score the same squad from
// the same gem ladder. They used to declare that ladder twice — recommend's
// SELL_THRESHOLD and lifecycle's SELL_SOON_THRESHOLD both hard-coded 0.90 —
// so retuning one would silently split them, and a row could read HOLD on one
// surface while another called the same player a sell.
//
// These tests pin the relationship itself, not the numbers, so a future retune
// either keeps both engines aligned or fails here.
import { describe, it, expect } from 'vitest'
import {
  computeVerdicts,
  BUY_THRESHOLD,
  SELL_THRESHOLD,
  HARD_SELL_THRESHOLD,
} from '@/lib/recommend'
import {
  computeLifecycleLabels,
  SELL_THRESHOLD as LIFECYCLE_SELL,
  SELL_SOON_THRESHOLD as LIFECYCLE_SELL_SOON,
  type LifecycleLabel,
} from '@/lib/lifecycle-label'
import type { ScoredPlayer, ClubForm } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

function mkPlayer(over: Partial<ScoredPlayer>): ScoredPlayer {
  return {
    id: 1, web_name: 'P', team: 1, team_short_name: 'TST', element_type: 3,
    now_cost: 70, selected_by_percent: '10.0', status: 'a', minutes: 900,
    starts: 10, fixtures: [], gem_score: 0.5, start_prob: 0.9,
    mins_risk: 'nailed', xg_per90: 0.3, xa_per90: 0.2,
    ...over,
  } as unknown as ScoredPlayer
}

function mkPick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

/** The sell family — labels that mean "this player is below the sell line".
 * The trap labels sit ABOVE the sell bands in the cascade and can fire on a
 * below-line player, so they belong here too. */
const SELL_FAMILY: ReadonlySet<LifecycleLabel> = new Set<LifecycleLabel>([
  'sell', 'sell_soon', 'minutes_trap', 'fixture_trap',
])

describe('engine coherence: verdict bands vs lifecycle bands', () => {
  it('the two engines read the same sell line', () => {
    expect(LIFECYCLE_SELL_SOON).toBe(SELL_THRESHOLD)
    expect(LIFECYCLE_SELL).toBe(HARD_SELL_THRESHOLD)
  })

  it('the ladder stays ordered: hard sell < sell < buy', () => {
    expect(HARD_SELL_THRESHOLD).toBeLessThan(SELL_THRESHOLD)
    expect(SELL_THRESHOLD).toBeLessThan(BUY_THRESHOLD)
  })

  it('a sell verdict always corresponds to a sell-family label, and vice versa', () => {
    // 20 background MIDs at 0.50 -> position average pins near 0.50.
    const background = Array.from({ length: 20 }, (_, i) =>
      mkPlayer({ id: 100 + i, gem_score: 0.5 }))

    // Sweep the whole band range so every boundary is exercised.
    const probes = [0.30, 0.40, 0.424, 0.43, 0.446, 0.45, 0.46, 0.49, 0.50, 0.55, 0.80]
    const squad = probes.map((gem, i) => mkPlayer({ id: i + 1, gem_score: gem }))
    const picks: SquadPick[] = squad.map((p, i) => mkPick(p.id, i + 1))
    const all = [...background, ...squad]

    const verdicts = computeVerdicts(picks, all)
    const labels = computeLifecycleLabels(picks, all, new Map<number, ClubForm>())

    for (const p of squad) {
      const verdict = verdicts.get(p.id)
      const label = labels.get(p.id)
      expect(verdict).toBeDefined()
      expect(label).toBeDefined()
      if (verdict === 'sell') {
        expect(SELL_FAMILY.has(label!)).toBe(true)
      } else {
        // Above the sell line, no sell-family label may fire.
        expect(SELL_FAMILY.has(label!)).toBe(false)
      }
    }
  })

  it('bench enablers are exempt in BOTH engines, not just one', () => {
    const background = Array.from({ length: 10 }, (_, i) =>
      mkPlayer({ id: 200 + i, gem_score: 0.5 }))
    const enabler = mkPlayer({ id: 50, gem_score: 0.10, now_cost: 40 })
    const all = [...background, enabler]
    const picks = [mkPick(50, 15)]

    expect(computeVerdicts(picks, all).get(50)).toBe('hold')
    expect(computeLifecycleLabels(picks, all, new Map()).get(50)).toBe('hold')
  })
})
