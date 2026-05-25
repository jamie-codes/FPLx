// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfectGWPitch } from './PerfectGWPitch'
import type { PerfectXIResult } from '@/lib/perfect-gw/computePerfectXI'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

function mkPlayer(id: number, element_type: 1 | 2 | 3 | 4, team: number): FPLElementRaw {
  return {
    id, code: id, web_name: `Player${id}`, team, element_type, now_cost: 60,
    selected_by_percent: '5.0', form: '5.0', status: 'a', minutes: 90, starts: 1,
    defensive_contribution: null, defensive_contribution_per_90: null,
    clearances_blocks_interceptions: null, direct_freekicks_order: null,
    penalties_order: null, corners_and_indirect_freekicks_order: null, news: '',
  }
}

const teams: FPLTeam[] = Array.from({ length: 11 }, (_, i) => ({
  id: i + 1, name: `Club ${i + 1}`, short_name: `C${i + 1}`, code: i + 1,
}))

// A valid 4-4-2 XI: 1 GK + 4 DEF + 4 MID + 2 FWD = 11
const xi: FPLElementRaw[] = [
  mkPlayer(1,  1, 1),   // GK
  mkPlayer(2,  2, 2), mkPlayer(3,  2, 3), mkPlayer(4,  2, 4), mkPlayer(5,  2, 5),  // DEF
  mkPlayer(6,  3, 6), mkPlayer(7,  3, 7), mkPlayer(8,  3, 8), mkPlayer(9,  3, 9),  // MID
  mkPlayer(10, 4, 10), mkPlayer(11, 4, 11), // FWD
]

const livePoints: Record<number, number> = {
  1: 6, 2: 8, 3: 7, 4: 6, 5: 5, 6: 12, 7: 9, 8: 8, 9: 7, 10: 18, 11: 9
}

const mockResult: PerfectXIResult = {
  xi,
  captain: xi[9], // Player10 has most points (18)
  formation: '4-4-2',
  totalPts: 95,
  squadCost: 660,
  overBudget: false,
  overBudgetBy: 0,
}

describe('PerfectGWPitch', () => {
  it('renders all 11 player names', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    for (let i = 1; i <= 11; i++) {
      expect(screen.getByText(`Player${i}`)).toBeTruthy()
    }
  })

  it('renders the total points', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText('95')).toBeTruthy()
  })

  it('renders the formation label', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText('4-4-2')).toBeTruthy()
  })

  it('renders the CAPT badge on the captain', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText('CAPT')).toBeTruthy()
  })

  it('renders BudgetBanner (within budget text visible)', () => {
    render(<PerfectGWPitch result={mockResult} teams={teams} livePoints={livePoints} />)
    expect(screen.getByText(/within budget/i)).toBeTruthy()
  })
})
