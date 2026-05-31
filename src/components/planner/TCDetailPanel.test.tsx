// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TCDetailPanel } from './TCDetailPanel'
import type { TCCandidate } from '@/lib/chip-strategy-engine'
import type { ScoredPlayer } from '@/lib/types'

function makeCandidate(overrides: Partial<TCCandidate> & { id: number }): TCCandidate {
  const player = { id: overrides.id, web_name: `P${overrides.id}` } as ScoredPlayer
  return {
    player,
    fixture_label: overrides.fixture_label ?? 'ARS (H)',
    is_dgw: overrides.is_dgw ?? false,
    tc_xpts: overrides.tc_xpts ?? 10.0,
    ceiling: overrides.ceiling ?? 15.0,
    start_risk: overrides.start_risk ?? 'low',
    tc_rating: overrides.tc_rating ?? 10.0,
    ...overrides,
  }
}

describe('TCDetailPanel', () => {
  it('renders player name, fixture, tc_xpts, and rating columns', () => {
    const candidates = [makeCandidate({ id: 1, fixture_label: 'ARS (H)', tc_xpts: 12.0, tc_rating: 12.0 })]
    render(<TCDetailPanel candidates={candidates} />)
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByText('ARS (H)')).toBeInTheDocument()
    expect(screen.getAllByText('12.0').length).toBeGreaterThanOrEqual(1) // TC xPts (and rating, same value)
  })

  it('shows 2× badge on DGW row', () => {
    const candidates = [makeCandidate({ id: 1, is_dgw: true, fixture_label: 'ARS (H) + CHE (A)' })]
    render(<TCDetailPanel candidates={candidates} />)
    expect(screen.getByText('2×')).toBeInTheDocument()
  })

  it('does not show 2× badge on non-DGW row', () => {
    const candidates = [makeCandidate({ id: 1, is_dgw: false })]
    render(<TCDetailPanel candidates={candidates} />)
    expect(screen.queryByText('2×')).not.toBeInTheDocument()
  })

  it('renders start-risk dot with correct data-risk attribute', () => {
    const candidates = [
      makeCandidate({ id: 1, start_risk: 'low' }),
      makeCandidate({ id: 2, start_risk: 'medium' }),
      makeCandidate({ id: 3, start_risk: 'high' }),
    ]
    render(<TCDetailPanel candidates={candidates} />)
    expect(document.querySelector('[data-risk="low"]')).toBeInTheDocument()
    expect(document.querySelector('[data-risk="medium"]')).toBeInTheDocument()
    expect(document.querySelector('[data-risk="high"]')).toBeInTheDocument()
  })

  it('renders empty state when candidates array is empty', () => {
    render(<TCDetailPanel candidates={[]} />)
    expect(screen.getByText('No player data available')).toBeInTheDocument()
  })

  it('renders at most 5 rows', () => {
    const candidates = [1,2,3,4,5,6].map(i => makeCandidate({ id: i }))
    render(<TCDetailPanel candidates={candidates} />)
    // 5 player rows max (6th player id=6 not shown)
    const rows = document.querySelectorAll('[data-testid="tc-candidate-row"]')
    expect(rows.length).toBeLessThanOrEqual(5)
  })
})
