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
import { ValueGemsTable } from '@/components/value-gems/ValueGemsTable'
import { MobileNav } from '@/components/nav/MobileNav'
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
import { RivalsTab } from '@/components/rivals/RivalsTab'
import { OptimiserPanel } from '@/components/optimiser/OptimiserPanel'
import { LineupTab } from '@/components/squad/LineupTab'
import { GwReviewTab } from '@/components/squad/GwReviewTab'
import { DecisionSummaryTab } from '@/components/squad/DecisionSummaryTab'
import { useSettledGws } from '@/lib/hooks/useSettledGws'

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

export type Section = 'analyse' | 'plan' | 'squad'
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'window' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim'

export const SECTIONS = [
  {
    id: 'analyse' as Section,
    label: 'Analyse',
    subTabs: [
      { id: 'gems' as SubTab,          label: 'Gem Ratings',     mobileLabel: 'Gems'     },
      { id: 'insights' as SubTab,      label: 'Insights',        mobileLabel: 'Insights' },
      { id: 'defcon' as SubTab,        label: 'DefCon Analysis', mobileLabel: 'DefCon'   },
      { id: 'set-pieces' as SubTab,    label: 'Set Pieces',      mobileLabel: 'SP'       },
      { id: 'club-form' as SubTab,     label: 'Club Form',       mobileLabel: 'Form'     },
      { id: 'accuracy' as SubTab,      label: 'Accuracy',        mobileLabel: 'Acc'      },
      { id: 'season' as SubTab,        label: 'Season',          mobileLabel: 'Season'   },
      { id: 'window' as SubTab,        label: 'Summer Window',   mobileLabel: 'Window'   },
      { id: 'price-changes' as SubTab, label: 'Price Changes',   mobileLabel: 'Prices'   },
    ],
    defaultSubTab: 'gems' as SubTab,
  },
  {
    id: 'plan' as Section,
    label: 'Plan',
    subTabs: [
      { id: 'planner' as SubTab,     label: 'Planner',     mobileLabel: 'Planner' },
      { id: 'manual-plan' as SubTab, label: 'Manual Plan', mobileLabel: 'Manual'  },
      { id: 'route-tree' as SubTab,  label: 'Route Tree',  mobileLabel: 'Routes'  },
      { id: 'rank-sim' as SubTab,    label: 'Rank Sim',    mobileLabel: 'Rank Sim' },  // Phase 62 MC-03
      { id: 'value-gems' as SubTab, label: 'Value Gems', mobileLabel: 'Values'  },
      { id: 'rivals' as SubTab,     label: 'Rivals',     mobileLabel: 'Rivals'  },
    ],
    defaultSubTab: 'planner' as SubTab,
  },
  {
    id: 'squad' as Section,
    label: 'Squad',
    subTabs: [
      { id: 'decision' as SubTab,  label: 'Decision',  mobileLabel: 'Decision'  },
      { id: 'transfers' as SubTab, label: 'Transfers', mobileLabel: 'Transfers' },
      { id: 'optimiser' as SubTab, label: 'Optimiser', mobileLabel: 'Optimiser' },
      { id: 'lineup' as SubTab,    label: 'Lineup',    mobileLabel: 'Lineup'    },
      { id: 'review' as SubTab,    label: 'Review',    mobileLabel: 'Review'    },
    ],
    defaultSubTab: 'decision' as SubTab,
  },
] as const

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>('analyse')
  const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
    analyse: 'gems',
    plan: 'planner',
    squad: 'decision',
  })
  const [gemPreset, setGemPreset] = useState<ViewPreset>('default')
  const [comparePlayer, setComparePlayer] = useState<ScoredPlayer | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)

  // Phase 98 PGW-02 live data + PGW-04 auto-surface input.
  // Default [] keeps the GwPillToggle's "no settled GWs" branch quiet during load/error.
  const { data: settledGws = [] } = useSettledGws()

  // Phase 98 PGW-04: auto-surface Squad > Review when a new GW has settled and the
  // user has not yet seen it. One-time per GW (D-03); flag is written synchronously
  // at the moment of navigation (D-04); localStorage key format documented in D-05.
  useEffect(() => {
    if (settledGws.length === 0) return
    const latestGw = settledGws[settledGws.length - 1]
    const key = `pgw-reviewed:GW${latestGw}`
    try {
      if (localStorage.getItem(key) !== null) return
      setActiveSection('squad')
      setSectionMemory((prev) => ({ ...prev, squad: 'review' }))
      localStorage.setItem(key, '1')
    } catch {
      // localStorage unavailable (SSR / private browsing) — skip silently
    }
  }, [settledGws])

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

  // D-07: Plan-section horizon shared across PlannerTab, ManualPlanTab, and RouteTreeTab.
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

  const handleCompare = useCallback((player: ScoredPlayer) => {
    setComparePlayer(player)
    setCompareOpen(true)
  }, [])

  const activeSubTab = sectionMemory[activeSection]

  function handleSectionChange(section: Section) {
    setActiveSection(section)
    // sectionMemory already holds last sub-tab — D-05 means we DO NOT reset
  }

  function handleSubTabChange(subTab: SubTab) {
    setSectionMemory(prev => ({ ...prev, [activeSection]: subTab }))
  }

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 pt-2 pb-8 max-sm:pb-24 overflow-x-hidden">
        {/* Header — scrolls away */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-[family-name:var(--font-honk)] text-5xl text-zinc-900 dark:text-white leading-none">FPLx</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Sticky nav wrapper — section tabs + sub-tabs (D-07, D-08) */}
        <div className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border -mx-4 px-4">
          {/* Section navigation */}
          <nav aria-label="Section navigation" className="hidden sm:flex items-center gap-2 py-2">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`px-4 py-1.5 text-sm font-medium rounded-full min-h-[44px] transition-colors ${activeSection === section.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                onClick={() => handleSectionChange(section.id)}
                aria-current={activeSection === section.id ? 'page' : undefined}
              >
                {section.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <LastUpdated />
              <ThemeToggle />
            </div>
          </nav>

          {/* Sub-tab row — rendered for any section with subTabs.length > 0 (D-08) */}
          {(() => {
            const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
            if (!activeSectionDef.subTabs.length) return null
            return (
              <nav aria-label={`${activeSectionDef.label} sub-tabs`} className="hidden sm:flex items-center gap-2 py-2">
                {activeSectionDef.subTabs.map((sub) => (
                  <button
                    key={sub.id}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full min-h-[44px] transition-colors ${activeSubTab === sub.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                    onClick={() => handleSubTabChange(sub.id)}
                    aria-current={activeSubTab === sub.id ? 'page' : undefined}
                  >
                    {sub.label}
                  </button>
                ))}
              </nav>
            )
          })()}
        </div>

        {/* Spacing below sticky nav — lg (24px) per UI-SPEC spacing scale */}
        <div className="h-6" />

        {/* D-07: Section-level HorizonSelector — only when Plan section is active */}
        {activeSection === 'plan' && (
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

        {/* Tab content — squad guards on section + sub-tab; others guard on sub-tab AND non-squad section */}
        {activeSection === 'squad' && activeSubTab === 'decision' && (
          <DecisionErrorBoundary>
            <DecisionSummaryTab
              teamId={teamId}
              onTeamIdChange={setTeamId}
              submittedId={submittedId}
              onSubmit={handleTeamIdSubmit}
            />
          </DecisionErrorBoundary>
        )}
        {activeSection === 'squad' && activeSubTab === 'transfers' && (
          <TransferPanel
            teamId={teamId}
            onTeamIdChange={setTeamId}
            submittedId={submittedId}
            onSubmit={handleTeamIdSubmit}
          />
        )}
        {activeSection === 'squad' && activeSubTab === 'optimiser' && (
          <OptimiserPanel teamId={submittedId ?? ''} />
        )}
        {activeSection === 'squad' && activeSubTab === 'lineup' && (
          <LineupTab teamId={submittedId ?? ''} />
        )}
        {activeSection === 'squad' && activeSubTab === 'review' && (
          <GwReviewTab teamId={submittedId ?? ''} settledGws={settledGws} />
        )}
        {activeSection !== 'squad' && activeSubTab === 'gems' && (
          <GemTable preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} />
        )}
        {activeSection !== 'squad' && activeSubTab === 'defcon' && <DefConTables />}
        {activeSection !== 'squad' && activeSubTab === 'club-form' && (
          <ClubFormTab submittedId={submittedId} />
        )}
        {activeSection !== 'squad' && activeSubTab === 'set-pieces' && <SetPieceTakerPanel />}
        {activeSection !== 'squad' && activeSubTab === 'insights' && <InsightsTab />}
        {activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab teamId={submittedId} />}
        {activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}
        {activeSection !== 'squad' && activeSubTab === 'window' && <SummerWindowTab />}
        {activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}
        {activeSection !== 'squad' && activeSubTab === 'value-gems' && <ValueGemsTable />}
        {activeSection === 'plan' && activeSubTab === 'rivals' && (
          <RivalsTab submittedId={submittedId} />
        )}
        {activeSection === 'plan' && activeSubTab === 'manual-plan' && (
          <ManualPlanTab submittedId={submittedId} horizon={planHorizon} />
        )}
        {activeSection === 'plan' && activeSubTab === 'route-tree' && (
          <RouteTreeTab submittedId={submittedId} horizon={planHorizon} onSwitchSubTab={handleSubTabChange} />
        )}
        {activeSection === 'plan' && activeSubTab === 'rank-sim' && (
          <RankSimTab submittedId={submittedId} horizon={planHorizon} />
        )}
        {activeSection === 'plan' && activeSubTab === 'planner' && (
          <>
            <PlannerTab horizon={planHorizon} />
            <CaptainPicksPanel submittedId={submittedId} />
          </>
        )}
      </main>
      {comparePlayer && (
        <PlayerComparisonModal
          open={compareOpen}
          playerA={comparePlayer}
          onClose={() => setCompareOpen(false)}
        />
      )}
      <MobileNav
        activeSection={activeSection}
        activeSubTab={activeSubTab}
        onSectionChange={handleSectionChange}
        onSubTabChange={handleSubTabChange}
      />
    </>
  )
}
