'use client'

import { useState } from 'react'
import { HorizonSelector } from './HorizonSelector'
import type { PlannerHorizon } from '@/lib/types'

export function PlannerTab() {
  const [horizon, setHorizon] = useState<PlannerHorizon>(3)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Planning Horizon
        </h2>
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </div>
      <button
        disabled
        className="px-4 py-2 rounded text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 opacity-40 cursor-not-allowed"
      >
        Generate Plan
      </button>
    </div>
  )
}
