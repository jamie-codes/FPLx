'use client'

import { useState } from 'react'
import { GemTable } from '@/components/gem-table/GemTable'
import { DefConTables } from '@/components/defcon/DefConTables'
import { TransferPanel } from '@/components/transfers/TransferPanel'
import { ClubFormTable } from '@/components/club-form/ClubFormTable'
import { LastUpdated } from '@/components/LastUpdated'

type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('gems')

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Tab navigation */}
      <div className="flex gap-4 mb-6 border-b border-zinc-200">
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'gems'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('gems')}
        >
          Gem Ratings
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'defcon'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('defcon')}
        >
          DefCon Analysis
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'squad'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('squad')}
        >
          Squad & Transfers
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'club-form'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('club-form')}
        >
          Club Form
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium ${
            activeTab === 'value-gems'
              ? 'border-b-2 border-zinc-900 text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
          onClick={() => setActiveTab('value-gems')}
        >
          Value Gems
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'gems' && (
        <div>
          <GemTable />
          <LastUpdated />
        </div>
      )}
      {activeTab === 'defcon' && (
        <div>
          <DefConTables />
          <LastUpdated />
        </div>
      )}
      {activeTab === 'squad' && (
        <div>
          <TransferPanel />
          <LastUpdated />
        </div>
      )}
      {activeTab === 'club-form' && <ClubFormTable />}
      {activeTab === 'value-gems' && <p className="text-gray-500">Coming soon...</p>}
    </main>
  )
}
