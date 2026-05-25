// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TopScorersTable } from './TopScorersTable'
import type { FPLElementRaw } from '@/lib/fpl-adapter'
import type { FPLTeam } from '@/lib/types'

function mkPlayer(id: number, element_type: 1 | 2 | 3 | 4, team: number): FPLElementRaw {
  return {
    id, code: id, web_name: `P${id}`, team, element_type, now_cost: 50,
    selected_by_percent: '5.0', form: '5.0', status: 'a', minutes: 90,
    starts: 1, defensive_contribution: null, defensive_contribution_per_90: null,
    clearances_blocks_interceptions: null, direct_freekicks_order: null,
    penalties_order: null, corners_and_indirect_freekicks_order: null, news: '',
  }
}

const teams: FPLTeam[] = [
  { id: 1, name: 'Club A', short_name: 'CLA', code: 1 },
  { id: 2, name: 'Club B', short_name: 'CLB', code: 2 },
]

// 2 GKs, 6 DEFs, 6 MIDs, 3 FWDs
const players: FPLElementRaw[] = [
  mkPlayer(1, 1, 1), mkPlayer(2, 1, 2),
  mkPlayer(3, 2, 1), mkPlayer(4, 2, 2), mkPlayer(5, 2, 1),
  mkPlayer(6, 2, 2), mkPlayer(7, 2, 1), mkPlayer(8, 2, 2),
  mkPlayer(9, 3, 1), mkPlayer(10, 3, 2), mkPlayer(11, 3, 1),
  mkPlayer(12, 3, 2), mkPlayer(13, 3, 1), mkPlayer(14, 3, 2),
  mkPlayer(15, 4, 1), mkPlayer(16, 4, 2), mkPlayer(17, 4, 1),
]

const livePoints: Record<number, number> = {
  1: 6, 2: 4,
  3: 9, 4: 7, 5: 5, 6: 3, 7: 1, 8: 1,
  9: 18, 10: 12, 11: 10, 12: 9, 13: 8, 14: 7,
  15: 15, 16: 9, 17: 7,
}

describe('TopScorersTable', () => {
  it('renders 4 position column headers', () => {
    render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    expect(screen.getByText('GK')).toBeTruthy()
    expect(screen.getByText('DEF')).toBeTruthy()
    expect(screen.getByText('MID')).toBeTruthy()
    expect(screen.getByText('FWD')).toBeTruthy()
  })

  it('shows top scorer first in each column', () => {
    const { container } = render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    // GK top scorer = P1 (6 pts) — must be the first GK row
    const firstGkRow = container.querySelector('[data-testid^="gk-row-"]')
    expect(firstGkRow?.textContent).toContain('P1')
    // MID top scorer = P9 (18 pts) — must be the first MID row
    const firstMidRow = container.querySelector('[data-testid^="mid-row-"]')
    expect(firstMidRow?.textContent).toContain('P9')
  })

  it('shows at most 5 players per position column', () => {
    const { container } = render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    // 6th-ranked MID (P14, 7pts) must be absent
    expect(screen.queryByTestId('mid-row-P14')).toBeNull()
    // 5th-ranked MID (P13, 8pts) must be present
    expect(container.querySelector('[data-testid="mid-row-P13"]')).not.toBeNull()
  })

  it('displays points for each player row', () => {
    render(<TopScorersTable players={players} livePoints={livePoints} teams={teams} />)
    // MID top scorer P9 has 18 pts
    expect(screen.getByTestId('mid-row-P9')).toBeTruthy()
    expect(within(screen.getByTestId('mid-row-P9')).getByText('18')).toBeTruthy()
  })
})
