// Phase 36: page.tsx state — D-05 section memory, D-06 default landing, D-04 mobile pill labels
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('@/components/gem-table/GemTable', () => ({
  GemTable: ({ onCompare }: { onCompare?: (p: any) => void }) => (
    <div data-testid="gem-table">
      <button data-testid="gem-table-compare-trigger" onClick={() => onCompare?.({ id: 99, web_name: 'TestPlayer' })}>
        compare
      </button>
    </div>
  ),
}))
vi.mock('@/components/defcon/DefConTables', () => ({ DefConTables: () => <div data-testid="defcon" /> }))
vi.mock('@/components/transfers/TransferPanel', () => ({ TransferPanel: (_props: { teamId: string; onTeamIdChange: (id: string) => void; submittedId: string | null; onSubmit: () => void }) => <div data-testid="transfer-panel" /> }))
vi.mock('@/components/optimiser/OptimiserPanel', () => ({ OptimiserPanel: (_props: { teamId: string }) => <div data-testid="optimiser-panel" /> }))
vi.mock('@/components/club-form/ClubFormTable', () => ({ ClubFormTable: () => <div data-testid="club-form-table" /> }))
vi.mock('@/components/club-form/FixtureEaseRankingPanel', () => ({ FixtureEaseRankingPanel: () => <div data-testid="fixture-ease" /> }))
vi.mock('@/components/club-form/FixtureSwingDetector', () => ({ FixtureSwingDetector: () => <div data-testid="fixture-swing" /> }))
vi.mock('@/components/LastUpdated', () => ({ LastUpdated: () => <div data-testid="last-updated" /> }))
vi.mock('@/components/theme/ThemeToggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }))
vi.mock('@/components/value-gems/ValueGemsTable', () => ({ ValueGemsTable: () => <div data-testid="value-gems" /> }))
vi.mock('@/components/planner/PlannerTab', () => ({ PlannerTab: () => <div data-testid="planner" /> }))
vi.mock('@/components/set-pieces/SetPieceTakerPanel', () => ({ SetPieceTakerPanel: () => <div data-testid="set-piece-taker" /> }))
vi.mock('@/components/captaincy/CaptainPicksPanel', () => ({ CaptainPicksPanel: () => <div data-testid="captain-picks" /> }))
vi.mock('@/components/insights/InsightsTab', () => ({ InsightsTab: () => <div data-testid="insights" /> }))
vi.mock('@/components/gem-table/PlayerComparisonModal', () => ({
  PlayerComparisonModal: ({ open, playerA }: { open: boolean; playerA?: { web_name?: string } }) =>
    open ? <div data-testid="comparison-modal">{playerA?.web_name}</div> : null,
}))

import Home from '@/app/page'

describe('Phase 36: page.tsx state', () => {
  it('default landing is Analyse section with Gem Ratings sub-tab active (D-06)', () => {
    const { container } = render(<Home />)
    const analyseBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Analyse')
    expect(analyseBtn?.getAttribute('aria-current')).toBe('page')
    const gemRatingsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Gem Ratings')
    expect(gemRatingsBtn?.getAttribute('aria-current')).toBe('page')
    expect(container.querySelector('[data-testid="gem-table"]')).not.toBeNull()
    // CaptainPicksPanel was moved to Planner tab (b81c240) — not rendered on default Gems tab
  })

  it('restores last active sub-tab when returning to Analyse section (D-05)', () => {
    const { container } = render(<Home />)
    // Navigate to Insights sub-tab within Analyse
    const insightsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Insights')
    fireEvent.click(insightsBtn!)
    expect(container.querySelector('[data-testid="insights"]')).not.toBeNull()
    // Switch to Squad section
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    expect(container.querySelector('[data-testid="transfer-panel"]')).not.toBeNull()
    expect(container.querySelector('nav[aria-label="Analyse sub-tabs"]')).toBeNull()
    expect(container.querySelector('nav[aria-label="Plan sub-tabs"]')).toBeNull()
    // Return to Analyse — Insights must be restored, not Gem Ratings
    const analyseBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Analyse')
    fireEvent.click(analyseBtn!)
    const analyseSubTabs = container.querySelector('nav[aria-label="Analyse sub-tabs"]')
    expect(analyseSubTabs).not.toBeNull()
    const activeSubTabBtn = analyseSubTabs?.querySelector('button[aria-current="page"]')
    expect(activeSubTabBtn?.textContent).toBe('Insights')
    expect(container.querySelector('[data-testid="insights"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="gem-table"]')).toBeNull()
  })

  it('restores last active sub-tab when returning to Plan section (D-05)', () => {
    const { container } = render(<Home />)
    // Switch to Plan section
    const planBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn!)
    const planSubTabs = container.querySelector('nav[aria-label="Plan sub-tabs"]')
    const activePlanBtn = planSubTabs?.querySelector('button[aria-current="page"]')
    expect(activePlanBtn?.textContent).toBe('Planner')
    expect(container.querySelector('[data-testid="planner"]')).not.toBeNull()
    // Switch to Club Form sub-tab
    const clubFormBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Club Form')
    fireEvent.click(clubFormBtn!)
    expect(container.querySelector('[data-testid="fixture-ease"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="club-form-table"]')).not.toBeNull()
    // Switch to Squad then back to Plan — Club Form must be restored
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    const planBtn2 = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn2!)
    const planSubTabs2 = container.querySelector('nav[aria-label="Plan sub-tabs"]')
    const activeBtn = planSubTabs2?.querySelector('button[aria-current="page"]')
    expect(activeBtn?.textContent).toBe('Club Form')
    expect(container.querySelector('[data-testid="fixture-ease"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="club-form-table"]')).not.toBeNull()
  })

  it('MobileNav uses abbreviated mobile labels not desktop sub-tab labels (D-04)', () => {
    const { container } = render(<Home />)
    const nav = container.querySelector('nav[aria-label="Mobile navigation"]')
    expect(nav).not.toBeNull()
    // Analyse active: mobile pills use mobileLabel abbreviations, not desktop labels
    expect(nav?.textContent).toContain('Gems')
    expect(nav?.textContent).not.toContain('Gem Ratings')
    expect(nav?.textContent).toContain('DefCon')
    expect(nav?.textContent).not.toContain('DefCon Analysis')
    expect(nav?.textContent).toContain('SP')
    expect(nav?.textContent).not.toContain('Set Pieces')
    // Switch to Plan section — plan pills use abbreviated mobileLabels
    const planBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn!)
    // When Plan is active, Gems pill must be absent (Analyse-only pill)
    expect(nav?.textContent).not.toContain('Gems')
    expect(nav?.textContent).toContain('Form')
    expect(nav?.textContent).not.toContain('Club Form')
    expect(nav?.textContent).toContain('Values')
    expect(nav?.textContent).not.toContain('Value Gems')
    expect(nav?.textContent).toContain('Planner')
  })

  it('Squad section default sub-tab is Transfers; TransferPanel visible, OptimiserPanel hidden, sub-tab nav present (D-05, D-07, D-08)', () => {
    const { container } = render(<Home />)
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    // TransferPanel visible (default sub-tab = 'transfers' per D-07)
    expect(container.querySelector('[data-testid="transfer-panel"]')).not.toBeNull()
    // OptimiserPanel NOT visible until user navigates to Optimiser sub-tab
    expect(container.querySelector('[data-testid="optimiser-panel"]')).toBeNull()
    // Squad sub-tab nav IS now present (D-08 removed the activeSection !== 'squad' guard)
    expect(container.querySelector('nav[aria-label="Squad sub-tabs"]')).not.toBeNull()
    // Sub-tab nav contains both Transfers and Optimiser buttons
    const subTabs = container.querySelector('nav[aria-label="Squad sub-tabs"]')
    const subTabBtns = Array.from(subTabs!.querySelectorAll('button')).map(b => b.textContent)
    expect(subTabBtns).toEqual(['Transfers', 'Optimiser'])
  })

  it('Squad Optimiser sub-tab shows OptimiserPanel and hides TransferPanel (NAV-01, D-09)', () => {
    const { container } = render(<Home />)
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    const optimiserBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Optimiser')
    fireEvent.click(optimiserBtn!)
    expect(container.querySelector('[data-testid="optimiser-panel"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="transfer-panel"]')).toBeNull()
  })
})

describe('Phase 39: player comparison modal mount', () => {
  it('clicking GemTable onCompare mounts PlayerComparisonModal with playerA (CMP-01 page-level)', () => {
    const { container } = render(<Home />)
    // Modal must NOT be mounted before any compare action
    expect(container.querySelector('[data-testid="comparison-modal"]')).toBeNull()
    // Trigger the compare callback exposed by the mocked GemTable
    const trigger = container.querySelector('[data-testid="gem-table-compare-trigger"]') as HTMLButtonElement
    expect(trigger).not.toBeNull()
    fireEvent.click(trigger)
    // Modal must now be mounted with the test player
    const modal = container.querySelector('[data-testid="comparison-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.textContent).toBe('TestPlayer')
  })
})
