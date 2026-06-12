// @vitest-environment jsdom
// UIX-02 Tasks 2+3: Home command centre — presentational components + orchestration.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import { SquadStrip } from './SquadStrip'
import { ActionCards } from './ActionCards'

function mkPlayer(over: Partial<MergedPlayer>): MergedPlayer {
  return {
    id: 0,
    web_name: 'Player',
    team_short_name: 'XXX',
    element_type: 3,
    now_cost: 50,
    ...over,
  } as MergedPlayer
}

// ---- SquadStrip (Task 2) ----

describe('SquadStrip', () => {
  const xi = [
    { player: mkPlayer({ id: 1, web_name: 'Haaland', element_type: 4 }), badge: { text: 'BUY', intent: 'positive' as const }, isCaptain: true },
    { player: mkPlayer({ id: 2, web_name: 'Saka' }), badge: { text: 'SELL SOON', intent: 'warning' as const }, isCaptain: false },
  ]
  const bench = [
    mkPlayer({ id: 12, web_name: 'BenchOne', element_type: 1 }),
    mkPlayer({ id: 13, web_name: 'BenchTwo' }),
    mkPlayer({ id: 14, web_name: 'BenchThree' }),
    mkPlayer({ id: 15, web_name: 'BenchFour' }),
  ]

  it('renders XI rows with badge chips and the captain C chip', () => {
    render(<SquadStrip xi={xi} bench={bench} />)
    expect(screen.getByText('My Squad')).toBeTruthy()
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.getByText('BUY')).toBeTruthy()
    expect(screen.getByText('SELL SOON')).toBeTruthy()
    // exactly one captain chip
    expect(screen.getAllByTitle('Optimised captain').length).toBe(1)
    const captainRow = screen.getByTestId('squad-row-1')
    expect(captainRow.textContent).toContain('C')
  })

  it('renders all 4 bench players', () => {
    render(<SquadStrip xi={xi} bench={bench} />)
    for (const name of ['BenchOne', 'BenchTwo', 'BenchThree', 'BenchFour']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
  })

  it('renders nothing when xi is empty (parent decides states)', () => {
    const { container } = render(<SquadStrip xi={[]} bench={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

// ---- ActionCards (Task 2) ----

describe('ActionCards', () => {
  const captain = { name: 'Haaland', team: 'MCI', projectedPts: 14.4, captainType: 'safe' as const }
  const transfer = { sellName: 'Selman', buyName: 'Buyer', gain: 1.4, costLabel: 'Free transfer' }
  const lineup = { formation: '4-3-3', xiXpts: 61.2 }

  it('captain card shows name and doubled points; routes to decision', () => {
    const onGo = vi.fn()
    render(<ActionCards captain={captain} transfer={transfer} lineup={lineup} onGo={onGo} />)
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.getByText(/14\.4/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /decision/i }))
    expect(onGo).toHaveBeenCalledWith('decision')
  })

  it('transfer card shows sell ➜ buy headline, gain, and cost label; routes to transfers', () => {
    const onGo = vi.fn()
    render(<ActionCards captain={captain} transfer={transfer} lineup={lineup} onGo={onGo} />)
    expect(screen.getByText(/Selman\s*➜\s*Buyer/)).toBeTruthy()
    expect(screen.getByText(/\+1\.4/)).toBeTruthy()
    expect(screen.getByText(/Free transfer/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /transfers/i }))
    expect(onGo).toHaveBeenCalledWith('transfers')
  })

  it('lineup card shows formation and projected XI pts; routes to lineup', () => {
    const onGo = vi.fn()
    render(<ActionCards captain={captain} transfer={transfer} lineup={lineup} onGo={onGo} />)
    expect(screen.getByText('4-3-3')).toBeTruthy()
    expect(screen.getByText(/61\.2/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /lineup/i }))
    expect(onGo).toHaveBeenCalledWith('lineup')
  })

  it('cards with undefined data are absent', () => {
    render(<ActionCards captain={captain} onGo={vi.fn()} />)
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /transfers/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /lineup/i })).toBeNull()
  })

  it('renders nothing when every card is undefined', () => {
    const { container } = render(<ActionCards onGo={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
