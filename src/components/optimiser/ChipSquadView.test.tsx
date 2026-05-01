// Phase 46 (CHIP-01..CHIP-02): ChipSquadView RTL tests — RED in Wave 0, GREEN in Wave 2.
// Wave 2 creates ChipSquadView.tsx and turns these GREEN.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { ChipSquadResult } from '@/lib/types'
import { ChipSquadView } from './ChipSquadView'

// Fixture: minimal valid ChipSquadResult
const MOCK_SQUAD: ChipSquadResult = {
  squad: [
    // 2 GKs
    { id: 1, web_name: 'Raya', element_type: 1, team: 1, now_cost: 55, xPts: 4.5 },
    { id: 2, web_name: 'Flekken', element_type: 1, team: 2, now_cost: 44, xPts: 2.1 },
    // 5 DEFs
    { id: 3, web_name: 'Alexander-Arnold', element_type: 2, team: 3, now_cost: 75, xPts: 7.2 },
    { id: 4, web_name: 'Pedro Porro', element_type: 2, team: 4, now_cost: 58, xPts: 5.1 },
    { id: 5, web_name: 'Mykolenko', element_type: 2, team: 5, now_cost: 43, xPts: 3.2 },
    { id: 6, web_name: 'Gabriel', element_type: 2, team: 6, now_cost: 62, xPts: 5.8 },
    { id: 7, web_name: 'Saliba', element_type: 2, team: 6, now_cost: 60, xPts: 5.5 },
    // 5 MIDs
    { id: 8, web_name: 'Salah', element_type: 3, team: 3, now_cost: 134, xPts: 10.2 },
    { id: 9, web_name: 'Saka', element_type: 3, team: 6, now_cost: 100, xPts: 8.1 },
    { id: 10, web_name: 'Mbeumo', element_type: 3, team: 7, now_cost: 79, xPts: 6.8 },
    { id: 11, web_name: 'Traoré', element_type: 3, team: 8, now_cost: 54, xPts: 4.2 },
    { id: 12, web_name: 'Andreas', element_type: 3, team: 9, now_cost: 50, xPts: 3.9 },
    // 3 FWDs
    { id: 13, web_name: 'Haaland', element_type: 4, team: 10, now_cost: 156, xPts: 9.8 },
    { id: 14, web_name: 'Watkins', element_type: 4, team: 11, now_cost: 89, xPts: 6.1 },
    { id: 15, web_name: 'Raúl', element_type: 4, team: 12, now_cost: 58, xPts: 4.8 },
  ],
  // XI = all except bench GK + 3 bench outfield (ids 2, 11, 12, 15)
  bestXI: [1, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14],
  formation: '5-3-2',
  budgetUsed: 917,
}

describe('ChipSquadView — Wave 0 (RED)', () => {
  it('file exists and ChipSquadView is exported', () => {
    expect(ChipSquadView).not.toBeNull()
  })

  it('renders with data-testid="chip-squad-view"', () => {
    const { getByTestId } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="wildcard" />
    )
    expect(getByTestId('chip-squad-view')).toBeTruthy()
  })

  it('renders headline with formation string', () => {
    const { getByTestId } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="wildcard" />
    )
    const headline = getByTestId('chip-squad-headline')
    expect(headline.textContent).toContain('5-3-2')
  })

  it('renders "Wildcard" in headline when chipMode is wildcard (D-17)', () => {
    const { getByTestId } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="wildcard" />
    )
    expect(getByTestId('chip-squad-headline').textContent).toContain('Wildcard')
  })

  it('renders "Free Hit" and FH reversion notice when chipMode is free-hit (D-17, D-18)', () => {
    const { getByTestId } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="free-hit" />
    )
    expect(getByTestId('chip-squad-headline').textContent).toContain('Free Hit')
    const notice = getByTestId('fh-reversion-notice')
    expect(notice.textContent).toContain('reverts')
  })

  it('renders budget used in headline (D-17)', () => {
    const { getByTestId } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="wildcard" />
    )
    // budgetUsed = 917 tenths = £91.7m
    expect(getByTestId('chip-squad-headline').textContent).toContain('91.7')
  })

  it('XI players have green accent border (border-l-2 border-green-500) (D-16)', () => {
    const { container } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="wildcard" />
    )
    const xiRows = container.querySelectorAll('[data-xi="true"]')
    expect(xiRows.length).toBe(11)
    xiRows.forEach(row => {
      expect(row.className).toContain('border-green-500')
    })
  })

  it('bench players (not in bestXI) have opacity-60 class (D-16)', () => {
    const { container } = render(
      <ChipSquadView result={MOCK_SQUAD} chipMode="wildcard" />
    )
    const benchRows = container.querySelectorAll('[data-xi="false"]')
    expect(benchRows.length).toBe(4)
    benchRows.forEach(row => {
      expect(row.className).toContain('opacity-60')
    })
  })
})
