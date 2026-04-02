'use client'

import type { PlannerHorizon } from '@/lib/types'

const HORIZONS: PlannerHorizon[] = [1, 2, 3, 4, 5]

interface Props {
  value: PlannerHorizon
  onChange: (v: PlannerHorizon) => void
}

export function HorizonSelector({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Planning horizon"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {HORIZONS.map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === gw
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
