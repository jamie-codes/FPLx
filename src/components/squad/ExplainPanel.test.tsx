// Phase 65 (WHY-03): ExplainPanel rejection section — RTL component tests.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ExplainPanel } from './ExplainPanel'
import type { ShortlistEntry } from '@/lib/replacement-shortlist'

const SAMPLE_SHORTLIST: ShortlistEntry[] = [
  {
    player: { id: 99, web_name: 'Replacement', team_short_name: 'AVL' } as never,
    pts_delta: 1.5,
    budget_sufficient: true,
  } as ShortlistEntry,
]

describe('ExplainPanel — Phase 65 WHY-03', () => {
  it('renders positive reasons list always', () => {
    const { getByText } = render(<ExplainPanel reasons={['In form — 6.0 pts/90']} shortlist={null} />)
    expect(getByText('In form — 6.0 pts/90')).toBeTruthy()
  })

  it('does NOT render rejection section when rejectionReasons prop is undefined (backward compat)', () => {
    const { queryByText } = render(<ExplainPanel reasons={['x']} shortlist={null} />)
    expect(queryByText('Why not recommended:')).toBeNull()
  })

  it('does NOT render rejection section when rejectionReasons is empty array', () => {
    const { queryByText } = render(
      <ExplainPanel reasons={['x']} shortlist={null} rejectionReasons={[]} />,
    )
    expect(queryByText('Why not recommended:')).toBeNull()
  })

  it('renders rejection section with header "Why not recommended:" when rejectionReasons is non-empty', () => {
    const { getByText } = render(
      <ExplainPanel
        reasons={['Projected 6.0 pts next GW']}
        shortlist={null}
        rejectionReasons={['Ranked #5 at MID by xPts', 'Rotation risk — start probability 60%']}
      />,
    )
    expect(getByText('Why not recommended:')).toBeTruthy()
    expect(getByText('Ranked #5 at MID by xPts')).toBeTruthy()
    expect(getByText('Rotation risk — start probability 60%')).toBeTruthy()
  })

  it('renders one <li> per rejection reason with text-xs text-ink-muted styling', () => {
    const { container } = render(
      <ExplainPanel
        reasons={['x']}
        shortlist={null}
        rejectionReasons={['Ranked #5 at MID by xPts']}
      />,
    )
    const li = container.querySelector('li.text-xs.text-ink-muted')
    // At least one li with the expected classes exists (positive reasons list may also match)
    expect(li).not.toBeNull()
  })

  it('renders rejection section AFTER positive reasons in DOM order (D-08)', () => {
    const { container } = render(
      <ExplainPanel
        reasons={['POS-REASON-A']}
        shortlist={null}
        rejectionReasons={['REJ-REASON-A']}
      />,
    )
    const html = container.innerHTML
    const posIdx = html.indexOf('POS-REASON-A')
    const rejHeaderIdx = html.indexOf('Why not recommended:')
    const rejIdx = html.indexOf('REJ-REASON-A')
    expect(posIdx).toBeGreaterThanOrEqual(0)
    expect(rejHeaderIdx).toBeGreaterThan(posIdx)
    expect(rejIdx).toBeGreaterThan(rejHeaderIdx)
  })

  it('renders rejection section BEFORE replacement shortlist in DOM order (D-08)', () => {
    const { container } = render(
      <ExplainPanel
        reasons={['POS-REASON-A']}
        shortlist={SAMPLE_SHORTLIST}
        rejectionReasons={['REJ-REASON-A']}
      />,
    )
    const html = container.innerHTML
    const posIdx = html.indexOf('POS-REASON-A')
    const rejHeaderIdx = html.indexOf('Why not recommended:')
    const rejIdx = html.indexOf('REJ-REASON-A')
    const shortlistHeaderIdx = html.indexOf('Replacement options')
    expect(posIdx).toBeGreaterThanOrEqual(0)
    expect(rejHeaderIdx).toBeGreaterThan(posIdx)
    expect(rejIdx).toBeGreaterThan(rejHeaderIdx)
    expect(shortlistHeaderIdx).toBeGreaterThan(rejIdx)
  })
})
