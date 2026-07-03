// Phase 36 → UIX-01: page.tsx state — per-group memory (port of D-05), home
// landing, URL sync, all-27-tools re-home, mobile pill labels (D-04 port).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
vi.mock('@/components/club-form/ClubFormTab', () => ({
  ClubFormTab: (props: { submittedId?: string | null }) => (
    <div data-testid="club-form-tab" data-submitted-id={props.submittedId ?? ''} />
  ),
}))
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
vi.mock('@/components/planner/ManualPlanTab', () => ({
  ManualPlanTab: (props: { submittedId: string | null; horizon: number }) => <div data-testid="manual-plan-tab" data-horizon={props.horizon} />,
}))
vi.mock('@/components/planner/RouteTreeTab', () => ({
  RouteTreeTab: (props: { submittedId: string | null; onSwitchSubTab: (tab: string) => void; horizon: number }) => <div data-testid="route-tree-tab" data-horizon={props.horizon} />,
}))
vi.mock('@/components/planner/RankSimTab', () => ({
  RankSimTab: (_props: { submittedId: string | null; horizon: number }) => <div data-testid="rank-sim-tab-mock">RankSimTab</div>,
}))
vi.mock('@/lib/hooks/useSettledGws', () => ({
  useSettledGws: () => ({ data: [33, 34, 35] }),
}))
vi.mock('@/components/DeadlineBanner', () => ({
  DeadlineBanner: () => null,
}))
vi.mock('@/components/squad/GwReviewTab', () => ({
  GwReviewTab: (props: { teamId: string; settledGws: number[] }) => (
    <div data-testid="gw-review-tab-mock" data-settled={JSON.stringify(props.settledGws)} />
  ),
}))
vi.mock('@/components/squad/LiveGwTab', () => ({
  LiveGwTab: (_props: { teamId: number | null }) => <div data-testid="live-gw-tab" />,
}))
vi.mock('@/components/news/SummerWindowTab', () => ({
  SummerWindowTab: () => <div data-testid="summer-window-tab" />,
}))
vi.mock('@/components/next-season/NextSeasonPlannerTab', () => ({
  NextSeasonPlannerTab: () => <div data-testid="next-season-planner-tab" />,
}))
vi.mock('@/components/season-review/SeasonReviewTab', () => ({
  SeasonReviewTab: (_props: { teamId: string | null }) => <div data-testid="season-review-tab" />,
}))
// UIX-01: tools never mounted by the pre-shell tests now get the all-27 sweep
vi.mock('@/components/weekly-picks/WeeklyPicksTab', () => ({
  WeeklyPicksTab: () => <div data-testid="weekly-picks-tab" />,
}))
vi.mock('@/components/watchlist/WatchlistTab', () => ({
  WatchlistTab: (_props: { watchlistIds: number[]; toggleWatchlist: (id: number) => void }) => <div data-testid="watchlist-tab" />,
}))
vi.mock('@/components/planner/WildcardBuilderTab', () => ({
  WildcardBuilderTab: (_props: { submittedId: string | null; horizon: number }) => <div data-testid="wildcard-builder-tab" />,
}))
vi.mock('@/components/perfect-gw/PerfectGWTab', () => ({
  PerfectGWTab: () => <div data-testid="perfect-gw-tab" />,
}))
vi.mock('@/components/price-reset/PriceResetTab', () => ({
  PriceResetTab: () => <div data-testid="price-reset-tab" />,
}))
vi.mock('@/components/transfers-confirmed/ConfirmedTransfersTab', () => ({
  ConfirmedTransfersTab: (_props: { onOpenWindow: () => void }) => <div data-testid="confirmed-transfers-tab" />,
}))
// UIX-02: HomeTab orchestrates TanStack Query hooks + engines — mocked here like
// every other tab (page.test.tsx renders without a QueryClientProvider). The
// mock preserves the selectTool deep-link contract for the CTA test.
vi.mock('@/components/home/HomeTab', () => ({
  HomeTab: (props: { selectTool: (t: string) => void }) => (
    <div data-testid="home-tab-mock">
      <button onClick={() => props.selectTool('picks')}>Go to This Week</button>
    </div>
  ),
}))

// Product-audit 2026-07: CockpitTab composes TanStack Query hooks — mocked like
// every other tab (page.test.tsx renders without a QueryClientProvider).
vi.mock('@/components/cockpit/CockpitTab', () => ({
  CockpitTab: (_props: { submittedId: string | null; selectTool: (t: string) => void }) => (
    <div data-testid="cockpit-tab" />
  ),
}))

import Home from '@/app/page'
import { ALL_TOOL_IDS, GROUPS, groupOf } from '@/lib/navigation'
import type { ToolId } from '@/lib/navigation'

// Click a tool in the desktop Sidebar by its (unique) full label.
// UIX-01 audit: sidebar items are links (?t=<id>) with SPA onClick.
function clickSidebarTool(container: HTMLElement, label: string) {
  const sidebar = container.querySelector('nav[aria-label="Primary navigation"]')!
  const link = Array.from(sidebar.querySelectorAll('a')).find((a) => a.textContent === label)
  expect(link, `sidebar tool "${label}"`).toBeDefined()
  fireEvent.click(link!)
}

// Global beforeEach: mark GW35 as already seen so the PGW-04 auto-surface
// useEffect does not redirect away from the default Home landing in existing
// tests, and reset the URL so the ?t= mount read starts clean per test.
beforeEach(() => {
  window.localStorage.setItem('pgw-reviewed:GW35', '1')
  window.history.replaceState(null, '', '/')
})

describe('UIX-01: shell state in page.tsx', () => {
  it('default landing is the Home tool with the HomeTab command centre (UIX-02)', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('[data-testid="home-tab-mock"]')).not.toBeNull()
    const sidebar = container.querySelector('nav[aria-label="Primary navigation"]')!
    const active = sidebar.querySelector('a[aria-current="page"]')
    expect(active?.textContent).toBe('Home')
    expect(container.querySelector('[data-testid="gem-table"]')).toBeNull()
  })

  it('home CTA deep-links to Weekly Picks via selectTool', () => {
    const { container } = render(<Home />)
    const cta = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Go to This Week')
    fireEvent.click(cta!)
    expect(container.querySelector('[data-testid="weekly-picks-tab"]')).not.toBeNull()
    expect(window.location.search).toBe('?t=picks')
  })

  it('every one of the 27 legacy tools renders its component when selected (keep-all-features)', () => {
    const TOOL_TESTID: Record<Exclude<ToolId, 'home'>, string> = {
      'cockpit': 'cockpit-tab',
      'picks': 'weekly-picks-tab',
      'lineup': 'lineup-tab',
      'live': 'live-gw-tab',
      'review': 'gw-review-tab-mock',
      'transfers': 'transfer-panel',
      'optimiser': 'optimiser-panel',
      'watchlist': 'watchlist-tab',
      'rank-sim': 'rank-sim-tab-mock',
      'rivals': 'rivals-tab',
      'gems': 'gem-table',
      'insights': 'insights',
      'defcon': 'defcon',
      'set-pieces': 'set-piece-taker',
      'club-form': 'club-form-tab',
      'perfect-gw': 'perfect-gw-tab',
      'planner': 'planner',
      'manual-plan': 'manual-plan-tab',
      'route-tree': 'route-tree-tab',
      'wildcard': 'wildcard-builder-tab',
      'pre-season': 'pre-season-tab',
      'prices': 'prices-tab',
      'accuracy': 'accuracy-tab',
      'season': 'season-review-tab',
    }
    const { container } = render(<Home />)
    const allTools = GROUPS.flatMap((g) => g.tools)
    for (const toolId of ALL_TOOL_IDS) {
      if (toolId === 'home') continue
      const label = allTools.find((t) => t.id === toolId)!.label
      clickSidebarTool(container, label)
      expect(
        container.querySelector(`[data-testid="${TOOL_TESTID[toolId]}"]`),
        `tool ${toolId} → ${TOOL_TESTID[toolId]}`
      ).not.toBeNull()
      expect(window.location.search).toBe(`?t=${toolId}`)
    }
  })

  it('Planner also renders CaptainPicksPanel beneath it (b81c240 contract)', () => {
    const { container } = render(<Home />)
    clickSidebarTool(container, 'Planner')
    expect(container.querySelector('[data-testid="planner"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="captain-picks"]')).not.toBeNull()
  })

  it('reads ?t=<toolId> from the URL once on mount (deep link)', () => {
    window.history.replaceState(null, '', '/?t=insights')
    const { container } = render(<Home />)
    expect(container.querySelector('[data-testid="insights"]')).not.toBeNull()
    const sidebar = container.querySelector('nav[aria-label="Primary navigation"]')!
    expect(sidebar.querySelector('a[aria-current="page"]')?.textContent).toBe('Insights')
  })

  it('aliases every retired ?t= deep link to its merge host', () => {
    const ALIASES: Array<[string, string]> = [
      ['decision', 'cockpit-tab'],
      ['value-gems', 'gem-table'],          // gems hub, ratings section default
      ['price-reset', 'prices-tab'],
      ['price-changes', 'prices-tab'],
      ['window', 'pre-season-tab'],
      ['transfers-confirmed', 'pre-season-tab'],
      ['next-season', 'pre-season-tab'],
    ]
    for (const [legacy, testid] of ALIASES) {
      window.history.replaceState(null, '', `/?t=${legacy}`)
      const { container, unmount } = render(<Home />)
      expect(container.querySelector(`[data-testid="${testid}"]`), `?t=${legacy}`).not.toBeNull()
      unmount()
    }
  })

  it('ignores an invalid ?t= value and stays on Home', () => {
    window.history.replaceState(null, '', '/?t=not-a-tool')
    const { container } = render(<Home />)
    expect(container.querySelector('[data-testid="home-tab-mock"]')).not.toBeNull()
  })

  it('restores the remembered tool when re-entering a group via the MobileBar (D-05 port)', () => {
    const { container } = render(<Home />)
    // Visit Research > Insights, then leave for This Week > Cockpit
    clickSidebarTool(container, 'Insights')
    expect(container.querySelector('[data-testid="insights"]')).not.toBeNull()
    clickSidebarTool(container, 'Cockpit')
    expect(container.querySelector('[data-testid="cockpit-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="insights"]')).toBeNull()
    // Re-enter Research from the mobile bar — Insights restored, not Gem Ratings
    const mobileNav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const researchLink = Array.from(mobileNav.querySelectorAll('a')).find((a) => a.textContent?.includes('Research'))
    fireEvent.click(researchLink!)
    expect(container.querySelector('[data-testid="insights"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="gem-table"]')).toBeNull()
  })

  it("MobileBar group button without memory lands on the group's first tool", () => {
    const { container } = render(<Home />)
    const mobileNav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const squadLink = Array.from(mobileNav.querySelectorAll('a')).find((a) => a.textContent?.includes('Squad'))
    fireEvent.click(squadLink!)
    // my-squad group's first tool is Transfers
    expect(container.querySelector('[data-testid="transfer-panel"]')).not.toBeNull()
  })

  it('mobile pill row shows the active group tools with abbreviated mobileLabels (D-04 port)', () => {
    const { container } = render(<Home />)
    clickSidebarTool(container, 'Gem Ratings')
    const pillRow = container.querySelector('nav[aria-label="Research tools"]')
    expect(pillRow).not.toBeNull()
    const pillLabels = Array.from(pillRow!.querySelectorAll('[role="tab"]')).map((b) => b.textContent)
    expect(pillLabels).toEqual(['Gems', 'Insights', 'DefCon', 'SP', 'Form', 'Perfect'])
    // abbreviations, never the desktop labels
    expect(pillRow!.textContent).not.toContain('Gem Ratings')
    expect(pillRow!.textContent).not.toContain('DefCon Analysis')
    expect(pillRow!.textContent).not.toContain('Set Pieces')
    // pill click selects the tool
    const defconPill = Array.from(pillRow!.querySelectorAll('[role="tab"]')).find((b) => b.textContent === 'DefCon')
    fireEvent.click(defconPill!)
    expect(container.querySelector('[data-testid="defcon"]')).not.toBeNull()
  })

  it('MoreSheet opens from the MobileBar and selects Planning/Model tools', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('[role="dialog"][aria-label="More tools"]')).toBeNull()
    const mobileNav = container.querySelector('nav[aria-label="Mobile navigation"]')!
    const moreBtn = Array.from(mobileNav.querySelectorAll('button')).find((b) => b.textContent?.includes('More'))
    fireEvent.click(moreBtn!)
    const sheet = container.querySelector('[role="dialog"][aria-label="More tools"]')
    expect(sheet).not.toBeNull()
    const wildcardLink = Array.from(sheet!.querySelectorAll('a')).find((a) => a.textContent === 'Wildcard')
    fireEvent.click(wildcardLink!)
    expect(container.querySelector('[data-testid="wildcard-builder-tab"]')).not.toBeNull()
    // sheet closes after selection
    expect(container.querySelector('[role="dialog"][aria-label="More tools"]')).toBeNull()
  })

  it('D-07: page-level HorizonSelector shares horizon across Planner, Manual Plan and Route Tree', () => {
    const { container } = render(<Home />)
    clickSidebarTool(container, 'Planner')

    // HorizonSelector present (desktop + mobile each get data-testid)
    const horizonSelectors = container.querySelectorAll('[data-testid="plan-section-horizon"]')
    expect(horizonSelectors.length).toBeGreaterThanOrEqual(1)

    // Default horizon=3 reaches Planner tab
    expect(container.querySelector('[data-testid="planner"]')?.getAttribute('data-horizon')).toBe('3')

    // Click 1 GW in the first horizon group
    const horizonGroup = container.querySelector('[aria-label="Planning horizon"]')!
    const oneGwBtn = Array.from(horizonGroup.querySelectorAll('button')).find((b) => b.textContent === '1 GW')!
    fireEvent.click(oneGwBtn)

    // Planner tab now receives horizon=1
    expect(container.querySelector('[data-testid="planner"]')?.getAttribute('data-horizon')).toBe('1')

    // Switch to Manual Plan — same horizon shared
    clickSidebarTool(container, 'Manual Plan')
    expect(container.querySelector('[data-testid="manual-plan-tab"]')?.getAttribute('data-horizon')).toBe('1')

    // Switch to Route Tree — same horizon shared
    clickSidebarTool(container, 'Route Tree')
    expect(container.querySelector('[data-testid="route-tree-tab"]')?.getAttribute('data-horizon')).toBe('1')
  })

  it('D-07: HorizonSelector renders only for the horizon-consuming tools', () => {
    const { container } = render(<Home />)
    for (const label of ['Planner', 'Manual Plan', 'Route Tree', 'Rank Sim', 'Wildcard']) {
      clickSidebarTool(container, label)
      expect(
        container.querySelector('[data-testid="plan-section-horizon"]'),
        `horizon selector on ${label}`
      ).not.toBeNull()
    }
    // Planning-group tools that do NOT take the prop don't get the selector
    for (const label of ['Prices', 'Pre-Season', 'Gem Ratings']) {
      clickSidebarTool(container, label)
      expect(
        container.querySelector('[data-testid="plan-section-horizon"]'),
        `no horizon selector on ${label}`
      ).toBeNull()
    }
  })

  it('sidebar exposes all 6 groups and 25 tools (navigation.ts is the source of truth)', () => {
    const { container } = render(<Home />)
    const sidebar = container.querySelector('nav[aria-label="Primary navigation"]')!
    expect(sidebar.querySelectorAll('a')).toHaveLength(25)
    for (const group of GROUPS) {
      expect(sidebar.textContent).toContain(group.label)
    }
  })

  it('chrome survives in the TopBar slot: LastUpdated + ThemeToggle render (bell renders live)', () => {
    const { container } = render(<Home />)
    const header = container.querySelector('header')!
    expect(header.querySelector('[data-testid="last-updated"]')).not.toBeNull()
    expect(header.querySelector('[data-testid="theme-toggle"]')).not.toBeNull()
  })
})

describe('Phase 98: page.tsx auto-surface (PGW-04)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('auto-surfaces the Review tool on first visit after a settled GW (PGW-04 D-01..D-05)', () => {
    window.localStorage.removeItem('pgw-reviewed:GW35')
    const { container } = render(<Home />)
    // useEffect fires synchronously after mount; the Review tool is now active.
    const reviewTab = container.querySelector('[data-testid="gw-review-tab-mock"]')
    expect(reviewTab).not.toBeNull()
    expect(reviewTab?.getAttribute('data-settled')).toBe('[33,34,35]')
    // Localstorage seen-flag was written (D-04: synchronous, at moment of navigation)
    expect(window.localStorage.getItem('pgw-reviewed:GW35')).toBe('1')
    // Review lives in This Week — its group is reflected by groupOf
    expect(groupOf('review').id).toBe('this-week')
  })

  it('does NOT auto-surface when the latest settled GW has already been seen (PGW-04 D-03)', () => {
    window.localStorage.setItem('pgw-reviewed:GW35', '1')
    const { container } = render(<Home />)
    // Default landing remains Home — no override
    expect(container.querySelector('[data-testid="home-tab-mock"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="gw-review-tab-mock"]')).toBeNull()
  })
})

describe('Phase 39: player comparison modal mount', () => {
  it('clicking GemTable onCompare mounts PlayerComparisonModal with playerA (CMP-01 page-level)', () => {
    const { container } = render(<Home />)
    clickSidebarTool(container, 'Gem Ratings')
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
