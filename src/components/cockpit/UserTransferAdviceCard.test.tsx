// TRF-02 UI: UserTransferAdviceCard — no team / hold / moves with forced+hit.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserTransferAdviceCard } from './UserTransferAdviceCard'
import type { MergedPlayer } from '@/lib/types'

vi.mock('@/lib/hooks/useSquad', () => ({ useSquad: vi.fn() }))
vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: vi.fn() }))
vi.mock('@/lib/hooks/useAuthStatus', () => ({ useAuthStatus: vi.fn() }))
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: vi.fn() }))

import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'

const mockSquad = vi.mocked(useSquad)
const mockPlayers = vi.mocked(usePlayers)
const mockAuth = vi.mocked(useAuthStatus)
const mockMyTeam = vi.mocked(useMyTeam)

function r(partial: object) { return partial as never }

function player(id: number, et: number, xp5: number, over: object = {}): MergedPlayer {
  return { id, web_name: `P${id}`, element_type: et, team: id, now_cost: 50,
           xPts_5gw: xp5, xPts_1gw: xp5 / 5, status: 'a', ...over } as unknown as MergedPlayer
}

function pick(element: number) {
  return { element, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false }
}

function fullSetup(extraPool: MergedPlayer[] = []) {
  // Legal-ish 15 (2/5/5/3) all valued 20 over 5 GWs.
  const squadPlayers: MergedPlayer[] = []
  let id = 1
  for (const [et, n] of [[1, 2], [2, 5], [3, 5], [4, 3]] as const) {
    for (let i = 0; i < n; i++) squadPlayers.push(player(id++, et, 20))
  }
  mockSquad.mockReturnValue(r({
    data: { picks: squadPlayers.map(p => pick(p.id)),
            entry_history: { event: 1, bank: 5, event_transfers: 0,
                             event_transfers_cost: 0, value: 755 },
            active_chip: null },
    isLoading: false,
  }))
  mockPlayers.mockReturnValue(r({ data: [...squadPlayers, ...extraPool], isLoading: false }))
  mockAuth.mockReturnValue(r({ isAuthenticated: false }))
  mockMyTeam.mockReturnValue(r({ data: undefined }))
}

describe('UserTransferAdviceCard', () => {
  it('prompts for a team id when none is set', () => {
    mockSquad.mockReturnValue(r({ data: undefined, isLoading: false }))
    mockPlayers.mockReturnValue(r({ data: [], isLoading: false }))
    mockAuth.mockReturnValue(r({ isAuthenticated: false }))
    mockMyTeam.mockReturnValue(r({ data: undefined }))
    render(<UserTransferAdviceCard submittedId={null} />)
    expect(screen.getByText('No team loaded')).toBeTruthy()
  })

  it('shows hold when nothing clears the bar', () => {
    fullSetup()   // pool == squad, no upgrades exist
    render(<UserTransferAdviceCard submittedId="123" />)
    expect(screen.getByTestId('user-hold-message')).toBeTruthy()
  })

  it('renders a validated upgrade move with gain', () => {
    fullSetup([player(100, 3, 30)])   // +10 over any squad MID
    render(<UserTransferAdviceCard submittedId="123" />)
    expect(screen.getByTestId('user-advice-moves')).toBeTruthy()
    expect(screen.getByText('P100')).toBeTruthy()
    expect(screen.getByText('+10.0')).toBeTruthy()
  })

  it('FT toggle re-runs the advice with 2 free transfers', () => {
    fullSetup([player(100, 3, 30), player(101, 4, 28)])
    render(<UserTransferAdviceCard submittedId="123" />)
    // With 1 FT the second upgrade (+8) is a hit and DOES clear the 6.0 bar,
    // so both appear — flip to 2 FT and the hit chip disappears.
    fireEvent.click(screen.getByRole('button', { name: '2 FT' }))
    expect(screen.queryByText('-4 hit')).toBeNull()
    expect(screen.getByText('P101')).toBeTruthy()
  })
})
