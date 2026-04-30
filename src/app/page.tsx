'use client'

import { useState, useCallback } from 'react'
import { GemTable } from '@/components/gem-table/GemTable'
import type { ViewPreset } from '@/components/gem-table/GwToggle'
import type { ScoredPlayer } from '@/lib/types'
import { PlayerComparisonModal } from '@/components/gem-table/PlayerComparisonModal'
import { DefConTables } from '@/components/defcon/DefConTables'
import { TransferPanel } from '@/components/transfers/TransferPanel'
import { ClubFormTable } from '@/components/club-form/ClubFormTable'
import { FixtureEaseRankingPanel } from '@/components/club-form/FixtureEaseRankingPanel'
import { LastUpdated } from '@/components/LastUpdated'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { ValueGemsTable } from '@/components/value-gems/ValueGemsTable'
import { MobileNav } from '@/components/nav/MobileNav'
import { PlannerTab } from '@/components/planner/PlannerTab'
import { SetPieceTakerPanel } from '@/components/set-pieces/SetPieceTakerPanel'
import { CaptainPicksPanel } from '@/components/captaincy/CaptainPicksPanel'
import { InsightsTab } from '@/components/insights/InsightsTab'
import { AccuracyTab } from '@/components/accuracy/AccuracyTab'
import { OptimiserPanel } from '@/components/optimiser/OptimiserPanel'

export type Section = 'analyse' | 'plan' | 'squad'
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy' | 'transfers' | 'optimiser'

export const SECTIONS = [
  {
    id: 'analyse' as Section,
    label: 'Analyse',
    subTabs: [
      { id: 'gems' as SubTab,       label: 'Gem Ratings',     mobileLabel: 'Gems'     },
      { id: 'insights' as SubTab,   label: 'Insights',        mobileLabel: 'Insights' },
      { id: 'defcon' as SubTab,     label: 'DefCon Analysis', mobileLabel: 'DefCon'   },
      { id: 'set-pieces' as SubTab, label: 'Set Pieces',      mobileLabel: 'SP'       },
      { id: 'accuracy' as SubTab,   label: 'Accuracy',        mobileLabel: 'Acc'      },
    ],
    defaultSubTab: 'gems' as SubTab,
  },
  {
    id: 'plan' as Section,
    label: 'Plan',
    subTabs: [
      { id: 'planner' as SubTab,    label: 'Planner',    mobileLabel: 'Planner' },
      { id: 'club-form' as SubTab,  label: 'Club Form',  mobileLabel: 'Form'    },
      { id: 'value-gems' as SubTab, label: 'Value Gems', mobileLabel: 'Values'  },
    ],
    defaultSubTab: 'planner' as SubTab,
  },
  {
    id: 'squad' as Section,
    label: 'Squad',
    subTabs: [
      { id: 'transfers' as SubTab, label: 'Transfers', mobileLabel: 'Transfers' },
      { id: 'optimiser' as SubTab, label: 'Optimiser', mobileLabel: 'Optimiser' },
    ],
    defaultSubTab: 'transfers' as SubTab,
  },
] as const

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>('analyse')
  const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
    analyse: 'gems',
    plan: 'planner',
    squad: 'transfers',
  })
  const [gemPreset, setGemPreset] = useState<ViewPreset>('default')
  const [comparePlayer, setComparePlayer] = useState<ScoredPlayer | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)

  // Phase 43 D-11: teamId / submittedId lifted from TransferPanel so both Transfers
  // and Optimiser sub-tabs share the squad fetch via TanStack Query cache.
  const [teamId, setTeamId] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('fpl_team_id') ?? '') : ''
  )
  const [submittedId, setSubmittedId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null
  )
  const handleTeamIdSubmit = useCallback(() => {
    if (teamId.trim()) {
      setSubmittedId(teamId.trim())
      localStorage.setItem('fpl_team_id', teamId.trim())
    }
  }, [teamId])

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
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-[family-name:var(--font-honk)] text-5xl text-zinc-900 dark:text-white leading-none">FPLx</span>
          <div className="ml-auto flex items-center gap-2">
            <LastUpdated />
            <ThemeToggle />
          </div>
        </div>

        {/* Section navigation */}
        <nav aria-label="Section navigation" className="hidden sm:flex gap-4 border-b border-zinc-200 dark:border-zinc-700 mb-0">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`pb-2 px-1 text-sm font-medium ${activeSection === section.id ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
              onClick={() => handleSectionChange(section.id)}
              aria-current={activeSection === section.id ? 'page' : undefined}
            >
              {section.label}
            </button>
          ))}
        </nav>

        {/* Sub-tab row — rendered for any section with subTabs.length > 0 (D-08) */}
        {(() => {
          const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
          if (activeSectionDef.subTabs.length === 0) return null
          return (
            <nav aria-label={`${activeSectionDef.label} sub-tabs`} className="hidden sm:flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-700">
              {activeSectionDef.subTabs.map((sub) => (
                <button
                  key={sub.id}
                  className={`pb-2 px-1 text-sm font-medium ${activeSubTab === sub.id ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                  onClick={() => handleSubTabChange(sub.id)}
                  aria-current={activeSubTab === sub.id ? 'page' : undefined}
                >
                  {sub.label}
                </button>
              ))}
            </nav>
          )
        })()}

        {/* Tab content — squad guards on section + sub-tab; others guard on sub-tab AND non-squad section */}
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
        {activeSection !== 'squad' && activeSubTab === 'gems' && (
          <GemTable preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} />
        )}
        {activeSection !== 'squad' && activeSubTab === 'defcon' && <DefConTables />}
        {activeSection !== 'squad' && activeSubTab === 'club-form' && (
          <>
            <FixtureEaseRankingPanel />
            <ClubFormTable />
          </>
        )}
        {activeSection !== 'squad' && activeSubTab === 'set-pieces' && <SetPieceTakerPanel />}
        {activeSection !== 'squad' && activeSubTab === 'insights' && <InsightsTab />}
        {activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab />}
        {activeSection !== 'squad' && activeSubTab === 'value-gems' && <ValueGemsTable />}
        {activeSection !== 'squad' && activeSubTab === 'planner' && (
          <>
            <PlannerTab />
            <CaptainPicksPanel />
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
