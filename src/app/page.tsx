'use client'

import { useState } from 'react'
import { GemTable } from '@/components/gem-table/GemTable'
import type { ViewPreset } from '@/components/gem-table/GwToggle'
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

export type Section = 'analyse' | 'plan' | 'squad'
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems'

export const SECTIONS = [
  {
    id: 'analyse' as Section,
    label: 'Analyse',
    subTabs: [
      { id: 'gems' as SubTab,       label: 'Gem Ratings',     mobileLabel: 'Gems'     },
      { id: 'insights' as SubTab,   label: 'Insights',        mobileLabel: 'Insights' },
      { id: 'defcon' as SubTab,     label: 'DefCon Analysis', mobileLabel: 'DefCon'   },
      { id: 'set-pieces' as SubTab, label: 'Set Pieces',      mobileLabel: 'SP'       },
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
    subTabs: [],
    defaultSubTab: null,
  },
] as const

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>('analyse')
  const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
    analyse: 'gems',
    plan: 'planner',
    squad: null,
  })
  const [gemPreset, setGemPreset] = useState<ViewPreset>('default')

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

        {/* Sub-tab row — hidden when Squad is active */}
        {activeSection !== 'squad' && (() => {
          const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
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

        {/* Spacer when Squad is active — preserves mb-6 gap before content */}
        {activeSection === 'squad' && <div className="mb-6 hidden sm:block" />}

        {/* Tab content — squad guards on section; others guard on sub-tab AND non-squad section */}
        {activeSection === 'squad' && <TransferPanel />}
        {activeSection !== 'squad' && activeSubTab === 'gems' && (
          <>
            <GemTable preset={gemPreset} onPresetChange={setGemPreset} />
            <CaptainPicksPanel />
          </>
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
        {activeSection !== 'squad' && activeSubTab === 'value-gems' && <ValueGemsTable />}
        {activeSection !== 'squad' && activeSubTab === 'planner' && <PlannerTab />}
      </main>
      <MobileNav
        activeSection={activeSection}
        activeSubTab={activeSubTab}
        onSectionChange={handleSectionChange}
        onSubTabChange={handleSubTabChange}
      />
    </>
  )
}
