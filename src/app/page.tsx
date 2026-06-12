'use client'

import { useState, useCallback, Component, useEffect } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { HorizonSelector } from '@/components/planner/HorizonSelector'
import { loadManualPlan } from '@/lib/manual-plan'
import type { PlannerHorizon } from '@/lib/types'
import { GemTable } from '@/components/gem-table/GemTable'
import type { ViewPreset } from '@/components/gem-table/GwToggle'
import type { ScoredPlayer } from '@/lib/types'
import { PlayerComparisonModal } from '@/components/gem-table/PlayerComparisonModal'
import { DefConTables } from '@/components/defcon/DefConTables'
import { TransferPanel } from '@/components/transfers/TransferPanel'
import { ClubFormTab } from '@/components/club-form/ClubFormTab'
import { LastUpdated } from '@/components/LastUpdated'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { BellNotificationButton } from '@/components/push/BellNotificationButton'
import { ValueGemsTable } from '@/components/value-gems/ValueGemsTable'
import { PlannerTab } from '@/components/planner/PlannerTab'
import { ManualPlanTab } from '@/components/planner/ManualPlanTab'
import { RouteTreeTab } from '@/components/planner/RouteTreeTab'
import { RankSimTab } from '@/components/planner/RankSimTab'
import { SetPieceTakerPanel } from '@/components/set-pieces/SetPieceTakerPanel'
import { CaptainPicksPanel } from '@/components/captaincy/CaptainPicksPanel'
import { InsightsTab } from '@/components/insights/InsightsTab'
import { AccuracyTab } from '@/components/accuracy/AccuracyTab'
import { SeasonReviewTab } from '@/components/season-review/SeasonReviewTab'
import { SummerWindowTab } from '@/components/news/SummerWindowTab'
import { PriceChangePanel } from '@/components/price-changes/PriceChangePanel'
import { PerfectGWTab } from '@/components/perfect-gw/PerfectGWTab'
import { PriceResetTab } from '@/components/price-reset/PriceResetTab'
import { RivalsTab } from '@/components/rivals/RivalsTab'
import { NextSeasonPlannerTab } from '@/components/next-season/NextSeasonPlannerTab'
import { WatchlistTab } from '@/components/watchlist/WatchlistTab'
import { WildcardBuilderTab } from '@/components/planner/WildcardBuilderTab'
import { useWatchlist } from '@/lib/hooks/useWatchlist'
import { OptimiserPanel } from '@/components/optimiser/OptimiserPanel'
import { LineupTab } from '@/components/squad/LineupTab'
import { GwReviewTab } from '@/components/squad/GwReviewTab'
import { DecisionSummaryTab } from '@/components/squad/DecisionSummaryTab'
import { LiveGwTab } from '@/components/squad/LiveGwTab'
import { useSettledGws } from '@/lib/hooks/useSettledGws'
import { DeadlineBanner } from '@/components/DeadlineBanner'
import { WeeklyPicksTab } from '@/components/weekly-picks/WeeklyPicksTab'
import { ALL_TOOL_IDS, groupOf, type ToolId } from '@/lib/navigation'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { MobileBar } from '@/components/shell/MobileBar'
import { MoreSheet } from '@/components/shell/MoreSheet'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

class DecisionErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[DecisionSummaryTab crash]', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 m-4 text-sm text-red-700 dark:text-red-300 space-y-1">
          <p className="font-semibold">Decision tab error — please report this message:</p>
          <pre className="whitespace-pre-wrap break-all text-xs">{this.state.error.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

// UIX-01: tools that consume the shared planHorizon (D-07) — the page-level
// HorizonSelector renders for exactly these. (Pre-shell it rendered for the
// whole Plan section; these five are the tools that actually take the prop.)
const HORIZON_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  'planner', 'manual-plan', 'route-tree', 'rank-sim', 'wildcard',
])

export default function Home() {
  // UIX-01 shell state: active tool + per-group memory (port of the old
  // sectionMemory, D-05 — switching groups restores the last tool used there).
  // Initial state is always 'home' (SSR-safe — avoids hydration mismatch).
  // The ?t= URL param is read in a useEffect below so both server and client
  // agree on the initial render.
  const [activeTool, setActiveTool] = useState<ToolId>('home')
  const [groupMemory, setGroupMemory] = useState<Partial<Record<string, ToolId>>>({})
  const [moreOpen, setMoreOpen] = useState(false)
  const [gemPreset, setGemPreset] = useState<ViewPreset>('default')
  const [comparePlayer, setComparePlayer] = useState<ScoredPlayer | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)

  const selectTool = useCallback((tool: ToolId) => {
    setActiveTool(tool)
    setGroupMemory((prev) => ({ ...prev, [groupOf(tool).id]: tool }))
    // UIX-01 URL sync: shareable/bookmarkable, no Next router involvement.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '?t=' + tool)
    }
  }, [])

  // UIX-01 URL sync — read ?t= once after mount (SSR-safe: avoids hydration
  // mismatch that occurs when reading window.location in useState initialiser).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')
    if (t !== null && (ALL_TOOL_IDS as string[]).includes(t)) {
      const toolId = t as ToolId
      setActiveTool(toolId)
      setGroupMemory({ [groupOf(toolId).id]: toolId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — runs once on mount only

  // Phase 98 PGW-02 live data + PGW-04 auto-surface input.
  // Default [] keeps the GwPillToggle's "no settled GWs" branch quiet during load/error.
  const { data: settledGws = [] } = useSettledGws()

  // Phase 98 PGW-04: auto-surface the Review tool when a new GW has settled and
  // the user has not yet seen it. One-time per GW (D-03); flag is written
  // synchronously at the moment of navigation (D-04); localStorage key format
  // documented in D-05. Runs after mount, so the once-per-GW surface wins over
  // the ?t= deep link on first visit (pre-shell behaviour: it overrode landing).
  useEffect(() => {
    if (settledGws.length === 0) return
    const latestGw = settledGws[settledGws.length - 1]
    const key = `pgw-reviewed:GW${latestGw}`
    try {
      if (localStorage.getItem(key) !== null) return
      selectTool('review')
      localStorage.setItem(key, '1')
    } catch {
      // localStorage unavailable (SSR / private browsing) — skip silently
    }
  }, [settledGws, selectTool])

  // UIX-01: MobileBar group buttons report the group's first tool; jump to the
  // group's remembered tool instead when we have one (per-group memory, D-05).
  const handleGroupSelect = useCallback((firstTool: ToolId) => {
    const group = groupOf(firstTool)
    selectTool(groupMemory[group.id] ?? firstTool)
  }, [groupMemory, selectTool])

  // Phase 43 D-11: teamId / submittedId lifted from TransferPanel so both Transfers
  // and Optimiser sub-tabs share the squad fetch via TanStack Query cache.
  const [teamId, setTeamId] = useState<string>(() => {
    try { return localStorage.getItem('fpl_team_id') ?? '' } catch { return '' }
  })
  const [submittedId, setSubmittedId] = useState<string | null>(() => {
    try { return localStorage.getItem('fpl_team_id') } catch { return null }
  })
  const handleTeamIdSubmit = useCallback(() => {
    if (teamId.trim()) {
      setSubmittedId(teamId.trim())
      try { localStorage.setItem('fpl_team_id', teamId.trim()) } catch {}
    }
  }, [teamId])

  // D-07: planning horizon shared across PlannerTab, ManualPlanTab, and RouteTreeTab.
  // Initialised from localStorage via loadManualPlan so the persisted plan's horizon is the
  // source of truth on page reload. Default 3 when no plan is stored.
  const [planHorizon, setPlanHorizon] = useState<PlannerHorizon>(() => {
    try {
      const persisted = loadManualPlan()
      return persisted?.horizon ?? 3
    } catch {
      return 3
    }
  })

  // Phase 127 D-10: watchlist state lifted to page.tsx level.
  // watchlistIds and toggleWatchlist passed as props to GemTable and WatchlistTab.
  const { watchlistIds, toggleWatchlist } = useWatchlist()

  const handleCompare = useCallback((player: ScoredPlayer) => {
    setComparePlayer(player)
    setCompareOpen(true)
  }, [])

  const activeGroup = groupOf(activeTool)

  return (
    <>
      <Sidebar active={activeTool} onSelect={selectTool} />
      <div className="lg:pl-[220px]">
        {/* Top bar — the right-cluster slot hosts the page's EXISTING chrome,
            relocated unchanged (UIX-01: moved, not recreated). */}
        <TopBar>
          <DeadlineBanner />
          <LastUpdated />
          <BellNotificationButton />
          <ThemeToggle />
        </TopBar>

        {/* Mobile tool pill row — the active group's tools (old sub-tab pattern restyled) */}
        <nav
          aria-label={`${activeGroup.label} tools`}
          className="lg:hidden sticky top-14 z-30 bg-surface-1/95 backdrop-blur border-b border-line px-3 py-2">
          <Tabs
            size="sm"
            items={activeGroup.tools.map((t) => ({ id: t.id, label: t.mobileLabel }))}
            value={activeTool}
            onChange={selectTool}
          />
        </nav>

        <main className="max-w-7xl mx-auto px-4 pt-4 pb-8 max-lg:pb-24 overflow-x-hidden">
          {/* D-07: page-level HorizonSelector — for the tools that consume planHorizon */}
          {HORIZON_TOOLS.has(activeTool) && (
            <>
              <div className="hidden sm:flex items-center gap-3 mb-6" data-testid="plan-section-horizon">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Planning Horizon</span>
                <HorizonSelector value={planHorizon} onChange={setPlanHorizon} />
              </div>
              <div className="sm:hidden flex items-center gap-3 mb-4 overflow-x-auto" data-testid="plan-section-horizon-mobile">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Horizon</span>
                <HorizonSelector value={planHorizon} onChange={setPlanHorizon} />
              </div>
            </>
          )}

          {/* Tool content — all 27 pre-shell tabs re-keyed by tool id, props unchanged */}
          {activeTool === 'home' && (
            <Card
              title="Welcome to FPLx"
              subtitle="The home dashboard arrives in UIX-02 — every tool is one click away in the meantime.">
              <div className="flex flex-col items-start gap-3">
                <p className="text-body text-ink-muted">
                  Jump straight into this week&apos;s decisions, or pick any tool from the navigation.
                </p>
                <Button variant="primary" onClick={() => selectTool('picks')}>
                  Go to This Week
                </Button>
              </div>
            </Card>
          )}
          {activeTool === 'decision' && (
            <DecisionErrorBoundary>
              <DecisionSummaryTab
                teamId={teamId}
                onTeamIdChange={setTeamId}
                submittedId={submittedId}
                onSubmit={handleTeamIdSubmit}
              />
            </DecisionErrorBoundary>
          )}
          {activeTool === 'transfers' && (
            <TransferPanel
              teamId={teamId}
              onTeamIdChange={setTeamId}
              submittedId={submittedId}
              onSubmit={handleTeamIdSubmit}
            />
          )}
          {activeTool === 'optimiser' && (
            <OptimiserPanel teamId={submittedId ?? ''} />
          )}
          {activeTool === 'lineup' && (
            <LineupTab teamId={submittedId ?? ''} />
          )}
          {activeTool === 'review' && (
            <GwReviewTab teamId={submittedId ?? ''} settledGws={settledGws} />
          )}
          {activeTool === 'live' && (
            <LiveGwTab teamId={submittedId != null && /^\d+$/.test(submittedId) ? parseInt(submittedId, 10) : null} />
          )}
          {activeTool === 'gems' && (
            <GemTable preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} watchlistIds={watchlistIds} toggleWatchlist={toggleWatchlist} />
          )}
          {activeTool === 'picks' && <WeeklyPicksTab />}
          {activeTool === 'defcon' && <DefConTables />}
          {activeTool === 'club-form' && (
            <ClubFormTab submittedId={submittedId} />
          )}
          {activeTool === 'set-pieces' && <SetPieceTakerPanel />}
          {activeTool === 'insights' && <InsightsTab />}
          {activeTool === 'accuracy' && <AccuracyTab teamId={submittedId} />}
          {activeTool === 'season' && <SeasonReviewTab teamId={submittedId} />}
          {activeTool === 'window' && <SummerWindowTab />}
          {activeTool === 'price-reset' && <PriceResetTab />}
          {activeTool === 'price-changes' && <PriceChangePanel />}
          {activeTool === 'perfect-gw' && <PerfectGWTab />}
          {activeTool === 'value-gems' && <ValueGemsTable />}
          {activeTool === 'rivals' && (
            <RivalsTab submittedId={submittedId} />
          )}
          {activeTool === 'next-season' && (
            <NextSeasonPlannerTab />
          )}
          {activeTool === 'watchlist' && (
            <WatchlistTab watchlistIds={watchlistIds} toggleWatchlist={toggleWatchlist} />
          )}
          {activeTool === 'manual-plan' && (
            <ManualPlanTab submittedId={submittedId} horizon={planHorizon} />
          )}
          {activeTool === 'route-tree' && (
            <RouteTreeTab submittedId={submittedId} horizon={planHorizon} onSwitchSubTab={selectTool} />
          )}
          {activeTool === 'rank-sim' && (
            <RankSimTab submittedId={submittedId} horizon={planHorizon} />
          )}
          {activeTool === 'planner' && (
            <>
              <PlannerTab horizon={planHorizon} />
              <CaptainPicksPanel submittedId={submittedId} />
            </>
          )}
          {activeTool === 'wildcard' && (
            <WildcardBuilderTab submittedId={submittedId} horizon={planHorizon} />
          )}
        </main>
      </div>
      {comparePlayer && (
        <PlayerComparisonModal
          open={compareOpen}
          playerA={comparePlayer}
          onClose={() => setCompareOpen(false)}
        />
      )}
      <MobileBar active={activeTool} onSelect={handleGroupSelect} onMore={() => setMoreOpen(true)} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        active={activeTool}
        onSelect={(t) => { selectTool(t); setMoreOpen(false) }}
      />
    </>
  )
}
