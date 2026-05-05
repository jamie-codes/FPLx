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
vi.mock('@/components/squad/LineupTab', () => ({ LineupTab: (_props: { teamId: string }) => <div data-testid="lineup-tab" /> }))
vi.mock('@/components/squad/DecisionSummaryTab', () => ({ DecisionSummaryTab: (_props: { teamId: string; onTeamIdChange: (id: string) => void; submittedId: string | null; onSubmit: () => void }) => <div data-testid="decision-summary-tab" /> }))
vi.mock('@/components/club-form/ClubFormTable', () => ({ ClubFormTable: () => <div data-testid="club-form-table" /> }))
vi.mock('@/components/club-form/FixtureEaseRankingPanel', () => ({ FixtureEaseRankingPanel: () => <div data-testid="fixture-ease" /> }))
vi.mock('@/components/club-form/FixtureSwingDetector', () => ({ FixtureSwingDetector: () => <div data-testid="fixture-swing" /> }))
vi.mock('@/components/LastUpdated', () => ({ LastUpdated: () => <div data-testid="last-updated" /> }))
vi.mock('@/components/theme/ThemeToggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }))
vi.mock('@/components/value-gems/ValueGemsTable', () => ({ ValueGemsTable: () => <div data-testid="value-gems" /> }))
vi.mock('@/components/planner/PlannerTab', () => ({ PlannerTab: (props: { horizon: number }) => <div data-testid="planner" data-horizon={props.horizon} /> }))
vi.mock('@/components/set-pieces/SetPieceTakerPanel', () => ({ SetPieceTakerPanel: () => <div data-testid="set-piece-taker" /> }))
vi.mock('@/components/captaincy/CaptainPicksPanel', () => ({ CaptainPicksPanel: () => <div data-testid="captain-picks" /> }))
vi.mock('@/components/insights/InsightsTab', () => ({ InsightsTab: () => <div data-testid="insights" /> }))
vi.mock('@/components/gem-table/PlayerComparisonModal', () => ({
  PlayerComparisonModal: ({ open, playerA }: { open: boolean; playerA?: { web_name?: string } }) =>
    open ? <div data-testid="comparison-modal">{playerA?.web_name}</div> : null,
}))
vi.mock('@/components/rivals/RivalsTab', () => ({
  RivalsTab: (_props: { submittedId: string | null }) => <div data-testid="rivals-tab" />,
}))
vi.mock('@/components/accuracy/AccuracyTab', () => ({
  AccuracyTab: () => <div data-testid="accuracy-tab" />,
}))
vi.mock('@/components/price-changes/PriceChangePanel', () => ({
  PriceChangePanel: () => <div data-testid="price-change-panel" />,
}))
vi.mock('@/components/club-form/FixtureHeatMap', () => ({
  FixtureHeatMap: () => <div data-testid="fixture-heat-map" />,
}))
vi.mock('@/components/planner/ManualPlanTab', () => ({
  ManualPlanTab: (props: { submittedId: string | null; horizon: number }) => <div data-testid="manual-plan-tab" data-horizon={props.horizon} />,
}))
vi.mock('@/components/planner/RouteTreeTab', () => ({
  RouteTreeTab: (props: { submittedId: string | null; onSwitchSubTab: (tab: string) => void; horizon: number }) => <div data-testid="route-tree-tab" data-horizon={props.horizon} />,
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
    // Switch to Squad section — default is now Decision (D-10 / Phase 51)
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    expect(container.querySelector('[data-testid="decision-summary-tab"]')).not.toBeNull()
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
    // Switch to Squad (lands on Decision — D-10) then back to Plan — Club Form must be restored
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
    // 'Manual Plan' uses the 'Manual' mobile abbreviation per D-01
    expect(nav?.textContent).toContain('Manual')
    expect(nav?.textContent).not.toContain('Manual Plan')
    expect(nav?.textContent).toContain('Values')
    expect(nav?.textContent).not.toContain('Value Gems')
    expect(nav?.textContent).toContain('Planner')
  })

  it('Squad section default sub-tab is Decision; DecisionSummaryTab visible, others hidden, sub-tab nav present (D-05, D-07, D-08, D-10/Phase51)', () => {
    const { container } = render(<Home />)
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    // DecisionSummaryTab visible (default sub-tab = 'decision' per D-10 / Phase 51)
    expect(container.querySelector('[data-testid="decision-summary-tab"]')).not.toBeNull()
    // TransferPanel and OptimiserPanel NOT visible on default Decision sub-tab
    expect(container.querySelector('[data-testid="transfer-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="optimiser-panel"]')).toBeNull()
    // Squad sub-tab nav IS now present (D-08 removed the activeSection !== 'squad' guard)
    expect(container.querySelector('nav[aria-label="Squad sub-tabs"]')).not.toBeNull()
    // Sub-tab nav contains Decision, Transfers, Optimiser buttons in that order
    const subTabs = container.querySelector('nav[aria-label="Squad sub-tabs"]')
    const subTabBtns = Array.from(subTabs!.querySelectorAll('button')).map(b => b.textContent)
    expect(subTabBtns).toEqual(['Decision', 'Transfers', 'Optimiser', 'Lineup'])
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

  it('Squad Lineup sub-tab shows LineupTab and hides OptimiserPanel (LINEUP-01, D-09)', () => {
    const { container } = render(<Home />)
    const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
    fireEvent.click(squadBtn!)
    const lineupBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Lineup')
    fireEvent.click(lineupBtn!)
    expect(container.querySelector('[data-testid="lineup-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="optimiser-panel"]')).toBeNull()
  })

  it('Plan section sub-tab nav contains "Manual Plan" after "Planner" (D-01, MTP-01)', () => {
    const { container } = render(<Home />)
    const planBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn!)
    const planSubTabs = container.querySelector('nav[aria-label="Plan sub-tabs"]')
    expect(planSubTabs).not.toBeNull()
    const subTabBtns = Array.from(planSubTabs!.querySelectorAll('button')).map(b => b.textContent)
    // Order locked by D-01 + D-05/D-06: Manual Plan after Planner, Route Tree after Manual Plan
    expect(subTabBtns).toEqual(['Planner', 'Manual Plan', 'Route Tree', 'Club Form', 'Value Gems', 'Rivals'])
  })

  it('inserts Route Tree sub-tab after Manual Plan in Plan section nav (D-05/D-06)', () => {
    const { container } = render(<Home />)
    // Navigate to Plan section
    const planBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn!)
    // Click the Route Tree sub-tab
    const routeTreeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Route Tree')
    expect(routeTreeBtn).toBeDefined()
    fireEvent.click(routeTreeBtn!)
    // RouteTreeTab renders
    expect(container.querySelector('[data-testid="route-tree-tab"]')).not.toBeNull()
    // aria-current is Route Tree
    expect(container.querySelector('nav[aria-label="Plan sub-tabs"] button[aria-current="page"]')?.textContent).toBe('Route Tree')
    // Sub-tab order: Planner | Manual Plan | Route Tree | Club Form | Value Gems | Rivals
    const subTabBtns = Array.from(container.querySelectorAll('nav[aria-label="Plan sub-tabs"] button')).map(b => b.textContent)
    expect(subTabBtns).toEqual(['Planner', 'Manual Plan', 'Route Tree', 'Club Form', 'Value Gems', 'Rivals'])
  })

  it('clicking "Manual Plan" sub-tab mounts ManualPlanTab and hides PlannerTab (MTP-01, D-02)', () => {
    const { container } = render(<Home />)
    const planBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn!)
    // Default Plan landing is Planner — confirm PlannerTab visible, ManualPlanTab hidden
    expect(container.querySelector('[data-testid="planner"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="manual-plan-tab"]')).toBeNull()
    // Click Manual Plan
    const manualBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Manual Plan')
    fireEvent.click(manualBtn!)
    // Manual Plan visible, Planner hidden
    expect(container.querySelector('[data-testid="manual-plan-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="planner"]')).toBeNull()
  })

  it('Phase 66: clicking "Heat Map" sub-tab mounts FixtureHeatMap and shows aria-current="page" (HEAT-01, D-06, D-07)', () => {
    const { container } = render(<Home />)
    // Default landing is Analyse / Gems — confirm Heat Map sub-tab exists in the Analyse nav
    const analyseSubTabs = container.querySelector('nav[aria-label="Analyse sub-tabs"]')
    expect(analyseSubTabs).not.toBeNull()
    const subTabBtns = Array.from(analyseSubTabs!.querySelectorAll('button')).map(b => b.textContent)
    // Locked order per D-06: Gem Ratings | Insights | DefCon Analysis | Set Pieces | Accuracy | Price Changes | Heat Map
    expect(subTabBtns).toEqual([
      'Gem Ratings',
      'Insights',
      'DefCon Analysis',
      'Set Pieces',
      'Accuracy',
      'Price Changes',
      'Heat Map',
    ])
    // Click Heat Map
    const heatMapBtn = Array.from(analyseSubTabs!.querySelectorAll('button')).find(b => b.textContent === 'Heat Map')
    expect(heatMapBtn).toBeDefined()
    fireEvent.click(heatMapBtn!)
    // FixtureHeatMap mounted; PriceChangePanel and Gems hidden
    expect(container.querySelector('[data-testid="fixture-heat-map"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="price-change-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="gem-table"]')).toBeNull()
    // aria-current is now Heat Map
    expect(
      container.querySelector('nav[aria-label="Analyse sub-tabs"] button[aria-current="page"]')?.textContent
    ).toBe('Heat Map')
  })

  it('D-07: section-level HorizonSelector shares horizon across all Plan sub-tabs', () => {
    const { container } = render(<Home />)
    const planBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Plan')
    fireEvent.click(planBtn!)

    // Section-level HorizonSelector present (desktop + mobile each get data-testid)
    const horizonSelectors = container.querySelectorAll('[data-testid="plan-section-horizon"]')
    expect(horizonSelectors.length).toBeGreaterThanOrEqual(1)

    // Default horizon=3 reaches Planner tab
    expect(container.querySelector('[data-testid="planner"]')?.getAttribute('data-horizon')).toBe('3')

    // Click 1 GW in the first horizon group
    const horizonGroup = container.querySelector('[aria-label="Planning horizon"]')!
    const oneGwBtn = Array.from(horizonGroup.querySelectorAll('button')).find(b => b.textContent === '1 GW')!
    fireEvent.click(oneGwBtn)

    // Planner tab now receives horizon=1
    expect(container.querySelector('[data-testid="planner"]')?.getAttribute('data-horizon')).toBe('1')

    // Switch to Manual Plan — same horizon shared
    const manualBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Manual Plan')
    fireEvent.click(manualBtn!)
    expect(container.querySelector('[data-testid="manual-plan-tab"]')?.getAttribute('data-horizon')).toBe('1')

    // Switch to Route Tree — same horizon shared
    const routeTreeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Route Tree')
    fireEvent.click(routeTreeBtn!)
    expect(container.querySelector('[data-testid="route-tree-tab"]')?.getAttribute('data-horizon')).toBe('1')
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
