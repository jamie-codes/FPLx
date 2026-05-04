// @vitest-environment jsdom
// Phase 58 ML-02 — RivalSummaryTable unit tests.
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RivalSummaryTable } from './RivalSummaryTable'
import type { RivalEntry } from '@/lib/types'

function rival(over: Partial<RivalEntry>): RivalEntry {
  return {
    entryId: 1, entryName: 'A Team', playerName: 'Alice',
    rank: 5, rankGap: -3, picks: [], captainPlayerId: null,
    chipsRemaining: ['bboost', '3xc', 'freehit', 'wildcard'],
    ...over,
  }
}

describe('RivalSummaryTable', () => {
  const noNames = new Map<number, string>()
  const onSelect = vi.fn()

  it('renders all 5 column headers', () => {
    const { container } = render(
      <RivalSummaryTable rivals={[]} selectedRivalId={null} onSelect={onSelect} playerNameById={noNames} />,
    )
    const ths = Array.from(container.querySelectorAll('th')).map(th => th.textContent)
    expect(ths).toEqual(['Rank', 'Manager Name', 'Rank Gap', 'Captain', 'Chips Remaining'])
  })

  it('ML-02: shows em-dash for null captainPlayerId', () => {
    const { container } = render(
      <RivalSummaryTable
        rivals={[rival({ captainPlayerId: null })]}
        selectedRivalId={null}
        onSelect={onSelect}
        playerNameById={noNames}
      />,
    )
    const captainCell = container.querySelector('tbody tr td:nth-child(4)')
    expect(captainCell?.textContent).toBe('—')
  })

  it('ML-02 post-deadline: shows player web_name when captainPlayerId resolves', () => {
    const names = new Map<number, string>([[123, 'Salah']])
    const { container } = render(
      <RivalSummaryTable
        rivals={[rival({ captainPlayerId: 123 })]}
        selectedRivalId={null}
        onSelect={onSelect}
        playerNameById={names}
      />,
    )
    const captainCell = container.querySelector('tbody tr td:nth-child(4)')
    expect(captainCell?.textContent).toBe('Salah')
  })

  it('shows "None remaining" for empty chipsRemaining', () => {
    const { container } = render(
      <RivalSummaryTable
        rivals={[rival({ chipsRemaining: [] })]}
        selectedRivalId={null}
        onSelect={onSelect}
        playerNameById={noNames}
      />,
    )
    const chipsCell = container.querySelector('tbody tr td:nth-child(5)')
    expect(chipsCell?.textContent).toBe('None remaining')
  })

  it('joins chipsRemaining with commas', () => {
    const { container } = render(
      <RivalSummaryTable
        rivals={[rival({ chipsRemaining: ['wildcard', '3xc'] })]}
        selectedRivalId={null}
        onSelect={onSelect}
        playerNameById={noNames}
      />,
    )
    const chipsCell = container.querySelector('tbody tr td:nth-child(5)')
    expect(chipsCell?.textContent).toBe('wildcard, 3xc')
  })

  it('clicking a row calls onSelect with its entryId', () => {
    const onSel = vi.fn()
    const { container } = render(
      <RivalSummaryTable
        rivals={[rival({ entryId: 42 })]}
        selectedRivalId={null}
        onSelect={onSel}
        playerNameById={noNames}
      />,
    )
    const row = container.querySelector('[data-testid="rival-row-42"]') as HTMLElement
    fireEvent.click(row)
    expect(onSel).toHaveBeenCalledWith(42)
  })

  it('selected row has bg-zinc-100 class', () => {
    const { container } = render(
      <RivalSummaryTable
        rivals={[rival({ entryId: 42 })]}
        selectedRivalId={42}
        onSelect={onSelect}
        playerNameById={noNames}
      />,
    )
    const row = container.querySelector('[data-testid="rival-row-42"]') as HTMLElement
    expect(row.className).toContain('bg-zinc-100')
  })

  it('rank gap signs: user ahead = +N (green), rival ahead = −N (red), equal = 0', () => {
    const rivals: RivalEntry[] = [
      rival({ entryId: 1, rankGap: -3 }),  // user ahead by 3 → +3
      rival({ entryId: 2, rankGap:  4 }),  // rival ahead by 4 → −4
      rival({ entryId: 3, rankGap:  0 }),
    ]
    const { container } = render(
      <RivalSummaryTable rivals={rivals} selectedRivalId={null} onSelect={onSelect} playerNameById={noNames} />,
    )
    const cells = Array.from(container.querySelectorAll('tbody tr')).map(tr => {
      const cell = tr.querySelector('td:nth-child(3)')!
      return { text: cell.textContent, cls: cell.className }
    })
    expect(cells[0].text).toBe('+3')
    expect(cells[0].cls).toContain('text-green-600')
    expect(cells[1].text).toBe('−4')
    expect(cells[1].cls).toContain('text-red-600')
    expect(cells[2].text).toBe('0')
  })
})
