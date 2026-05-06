// Phase 65 (WHY-02): HighOwnershipCallout — RTL component tests.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighOwnershipCallout } from './HighOwnershipCallout'
import type { ScoredPlayer } from '@/lib/types'

function makeEntry(
  overrides: Partial<{
    id: number
    web_name: string
    selected_by_percent: string
    inSquad: boolean
    squadRank: number
    posCode: string
  }> = {},
) {
  const id = overrides.id ?? 1
  return {
    player: {
      id,
      web_name: overrides.web_name ?? 'Salah',
      selected_by_percent: overrides.selected_by_percent ?? '50.0',
    } as unknown as ScoredPlayer,
    inSquad: overrides.inSquad ?? false,
    squadRank: overrides.squadRank,
    posCode: overrides.posCode ?? 'MID',
  }
}

describe('HighOwnershipCallout — Phase 65 WHY-02', () => {
  it('renders nothing when entries is empty array', () => {
    const { container } = render(<HighOwnershipCallout entries={[]} />)
    expect(container.firstChild).toBeNull()
    expect(container.querySelector('[data-testid="high-ownership-callout"]')).toBeNull()
  })

  it('renders root div with data-testid="high-ownership-callout" when entries provided', () => {
    const { container } = render(<HighOwnershipCallout entries={[makeEntry()]} />)
    const callout = container.querySelector('[data-testid="high-ownership-callout"]')
    expect(callout).not.toBeNull()
  })

  it('renders header reading "ℹ️ Why aren\'t these players appearing?"', () => {
    const { container } = render(<HighOwnershipCallout entries={[makeEntry()]} />)
    // The component uses HTML entities &#8505;&#65039; which render as ℹ️ in DOM
    expect(container.textContent).toMatch(/Why aren['']t these players appearing\?/)
  })

  it('renders in-squad variant copy: "[Name] (X%): Already ranked #N at POS in your squad by xPts — no upgrade needed"', () => {
    const { container } = render(
      <HighOwnershipCallout
        entries={[
          makeEntry({
            web_name: 'Salah',
            selected_by_percent: '50.0',
            inSquad: true,
            squadRank: 1,
            posCode: 'MID',
          }),
        ]}
      />,
    )
    expect(container.textContent).toContain('Salah')
    expect(container.textContent).toContain('(50%):')
    expect(container.textContent).toContain('Already ranked #1 at MID in your squad by xPts')
    expect(container.textContent).toContain('no upgrade needed')
    expect(container.textContent).toContain('—') // em-dash U+2014 present
  })

  it('renders not-in-squad variant copy: "[Name] (X%): xPts gain vs your POS options is negative — not worth transferring in"', () => {
    const { container } = render(
      <HighOwnershipCallout
        entries={[
          makeEntry({
            web_name: 'Haaland',
            selected_by_percent: '60.0',
            inSquad: false,
            posCode: 'FWD',
          }),
        ]}
      />,
    )
    expect(container.textContent).toContain('Haaland')
    expect(container.textContent).toContain('xPts gain vs your FWD options is negative')
    expect(container.textContent).toContain('not worth transferring in')
  })

  it('renders ownership percentage as integer via Math.round(parseFloat(selected_by_percent))', () => {
    const { container } = render(
      <HighOwnershipCallout entries={[makeEntry({ selected_by_percent: '12.5' })]} />,
    )
    // Math.round(12.5) === 13
    expect(container.textContent).toContain('(13%)')
  })

  it('renders all entries provided (caller controls cap-at-3)', () => {
    const entries = [
      makeEntry({ id: 1, web_name: 'A' }),
      makeEntry({ id: 2, web_name: 'B' }),
      makeEntry({ id: 3, web_name: 'C' }),
    ]
    const { container } = render(<HighOwnershipCallout entries={entries} />)
    const callout = container.querySelector('[data-testid="high-ownership-callout"]')
    expect(callout).not.toBeNull()
    // header <p> + 3 entry <p> = 4 paragraphs total
    expect(callout!.querySelectorAll('p').length).toBe(4)
  })
})
