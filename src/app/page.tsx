'use client'

import { useState, useCallback, Component, useEffect } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { HorizonSelector } from '@/components/planner/HorizonSelector'
import { loadManualPlan } from '@/lib/manual-plan'
import type { PlannerHorizon } from '@/lib/types'
import type { ViewPreset } from '@/components/gem-table/GwToggle'
import type { ScoredPlayer } from '@/lib/types'
import { LastUpdated } from '@/components/LastUpdated'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { BellNotificationButton } from '@/components/push/BellNotificationButton'
import { useWatchlist } from '@/lib/hooks/useWatchlist'
import { useSettledGws } from '@/lib/hooks/useSettledGws'
import { DeadlineBanner } from '@/components/DeadlineBanner'
import { MobileDeadlinePill } from '@/components/shell/MobileDeadlinePill'
import { ALL_TOOL_IDS, groupOf, type ToolId } from '@/lib/navigation'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { MobileBar } from '@/components/shell/MobileBar'
import { MoreSheet } from '@/components/shell/MoreSheet'
import { Tabs } from '@/components/ui/Tabs'
import {
  CockpitTab, WeeklyPicksTab, LineupTab, LiveGwTab, ReviewHub,
  TransferPanel, OptimiserPanel, WatchlistTab, RankSimTab, RivalsTab,
  GemsHub, InsightsTab, DefConTables, SetPieceTakerPanel, ClubFormTab,
  PlannerTab, ManualPlanTab, RouteTreeTab, WildcardBuilderTab,
  PreSeasonTab, PricesTab, AccuracyTab, SeasonReviewTab, PlayerComparisonModal,
  CaptainPicksPanel,
} from './dynamic-tabs'
import { HomeTab } from '@/components/home/HomeTab'

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
        <div className="rounded border border-negative/40 bg-negative-soft p-4 m-4 text-body text-negative space-y-1">
          <p className="font-semibold">Decision tab error — please report this message:</p>
          <pre className="whitespace-pre-wrap break-all text-data">{this.state.error.message}</pre>
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
    const raw = new URLSearchParams(window.location.search).get('t')
    // Retired tool ids alias to their merge hosts (product-audit 2026-07).
    const LEGACY_ALIASES: Record<string, string> = {
      'decision': 'cockpit', 'value-gems': 'gems',
      'price-reset': 'prices', 'price-changes': 'prices',
      'window': 'pre-season', 'transfers-confirmed': 'pre-season', 'next-season': 'pre-season',
      'perfect-gw': 'review',
    }
    const t = raw !== null ? (LEGACY_ALIASES[raw] ?? raw) : raw
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
      <div className="lg:pl-[var(--sidebar-w)]">
        {/* Top bar — the right-cluster slot hosts the page's EXISTING chrome,
            relocated unchanged (UIX-01: moved, not recreated). */}
        <TopBar>
          <MobileDeadlinePill />
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
            scrollIntoViewActive
          />
        </nav>

        <main className="max-w-7xl mx-auto px-4 pt-4 pb-8 max-lg:pb-24 overflow-x-hidden">
          {/* D-07: page-level HorizonSelector — for the tools that consume planHorizon */}
          {HORIZON_TOOLS.has(activeTool) && (
            <>
              <div className="hidden sm:flex items-center gap-3 mb-6" data-testid="plan-section-horizon">
                <span className="text-data font-medium text-ink-muted">Planning Horizon</span>
                <HorizonSelector value={planHorizon} onChange={setPlanHorizon} />
              </div>
              <div className="sm:hidden flex items-center gap-3 mb-4 overflow-x-auto" data-testid="plan-section-horizon-mobile">
                <span className="text-data font-medium text-ink-muted">Horizon</span>
                <HorizonSelector value={planHorizon} onChange={setPlanHorizon} />
              </div>
            </>
          )}

          {/* Tool content — all 27 pre-shell tabs re-keyed by tool id, props unchanged */}
          {activeTool === 'home' && (
            <HomeTab
              teamId={teamId}
              onTeamIdChange={setTeamId}
              submittedId={submittedId}
              onSubmit={handleTeamIdSubmit}
              selectTool={selectTool}
            />
          )}
          {activeTool === 'cockpit' && (
            <DecisionErrorBoundary>
              <CockpitTab
                teamId={teamId}
                onTeamIdChange={setTeamId}
                submittedId={submittedId}
                onSubmit={handleTeamIdSubmit}
                selectTool={selectTool}
                watchlistIds={watchlistIds}
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
            <ReviewHub teamId={submittedId ?? ''} settledGws={settledGws} />
          )}
          {activeTool === 'live' && (
            <LiveGwTab teamId={submittedId != null && /^\d+$/.test(submittedId) ? parseInt(submittedId, 10) : null} />
          )}
          {activeTool === 'gems' && (
            <GemsHub preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} watchlistIds={watchlistIds} toggleWatchlist={toggleWatchlist} />
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
          {activeTool === 'pre-season' && <PreSeasonTab />}
          {activeTool === 'prices' && <PricesTab />}
          {activeTool === 'rivals' && (
            <RivalsTab submittedId={submittedId} />
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
      <MobileBar active={activeTool} onSelect={handleGroupSelect} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        active={activeTool}
        onSelect={(t) => { selectTool(t); setMoreOpen(false) }}
      />
    </>
  )
}
