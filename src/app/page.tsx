'use client'

import { useState } from 'react'
import { GemTable } from '@/components/gem-table/GemTable'
import { DefConTables } from '@/components/defcon/DefConTables'

type Tab = 'gems' | 'defcon'

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
      </div>

      {/* Tab content */}
      {activeTab === 'gems' && <GemTable />}
      {activeTab === 'defcon' && <DefConTables />}
    </main>
  )
}
