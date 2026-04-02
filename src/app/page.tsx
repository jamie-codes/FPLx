'use client'

import { useState } from 'react'
import { GemTable } from '@/components/gem-table/GemTable'
import { DefConTables } from '@/components/defcon/DefConTables'
import { TransferPanel } from '@/components/transfers/TransferPanel'
import { ClubFormTable } from '@/components/club-form/ClubFormTable'
import { LastUpdated } from '@/components/LastUpdated'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { ValueGemsTable } from '@/components/value-gems/ValueGemsTable'
import { MobileNav } from '@/components/nav/MobileNav'
import { PlannerTab } from '@/components/planner/PlannerTab'

type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems' | 'planner'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('gems')

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
        {/* Tab navigation */}
        <div className="hidden sm:flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-700">
          <button
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'gems'
                ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('gems')}
          >
            Gem Ratings
          </button>
          <button
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'defcon'
                ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('defcon')}
          >
            DefCon Analysis
          </button>
          <button
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'squad'
                ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('squad')}
          >
            Squad & Transfers
          </button>
          <button
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'club-form'
                ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('club-form')}
          >
            Club Form
          </button>
          <button
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'value-gems'
                ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('value-gems')}
          >
            Value Gems
          </button>
          <button
            className={`pb-2 px-1 text-sm font-medium ${
              activeTab === 'planner'
                ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            onClick={() => setActiveTab('planner')}
          >
            Planner
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'gems' && <GemTable />}
        {activeTab === 'defcon' && <DefConTables />}
        {activeTab === 'squad' && <TransferPanel />}
        {activeTab === 'club-form' && <ClubFormTable />}
        {activeTab === 'value-gems' && <ValueGemsTable />}
        {activeTab === 'planner' && <PlannerTab />}
      </main>
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  )
}
