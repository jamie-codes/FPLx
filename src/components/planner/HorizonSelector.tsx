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
      className="flex rounded overflow-hidden border border-line"
    >
      {HORIZONS.map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === gw
              ? 'bg-ink text-surface-1'
              : 'bg-surface-1 text-ink hover:bg-surface-2'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
