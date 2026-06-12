'use client'

import { CHIP_LABELS } from './plan-helpers'
import type { PlannerChip } from '@/lib/types'

const CHIP_CODES = ['wildcard', 'freehit', 'bboost', '3xc'] as const

interface ChipToggleProps {
  gw: number
  activeChip: PlannerChip
  onToggle: (chip: PlannerChip) => void
  disabled?: boolean
}

export function ChipToggle({ gw, activeChip, onToggle, disabled }: ChipToggleProps) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <div
        role="group"
        aria-label={`Chip for GW ${gw}`}
        aria-disabled={disabled}
        className="flex flex-wrap gap-1"
      >
        {CHIP_CODES.map((chipCode) => {
          const isActive = activeChip === chipCode
          return (
            <button
              key={chipCode}
              aria-pressed={isActive}
              onClick={() => onToggle(chipCode)}
              className={`min-h-[44px] px-2 py-1 text-xs font-semibold rounded transition-colors ${
                isActive
                  ? 'bg-ink text-surface-1'
                  : 'bg-surface-1 text-ink hover:bg-surface-2'
              }`}
            >
              {CHIP_LABELS[chipCode]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
