'use client'

// Phase 46 (CHIP-01..CHIP-03): ChipModeToggle — 4-button chip selector pill.
// Locked by 46-CONTEXT.md D-01. Mirrors FtToggle.tsx pattern exactly.
import type { ChipMode } from '@/lib/types'

interface ChipModeToggleProps {
  value: ChipMode
  onChange: (value: ChipMode) => void
}

const OPTIONS: { value: ChipMode; label: string; testId: string }[] = [
  { value: 'none',        label: 'None',        testId: 'chip-toggle-none' },
  { value: 'wildcard',    label: 'Wildcard',     testId: 'chip-toggle-wildcard' },
  { value: 'free-hit',    label: 'Free Hit',     testId: 'chip-toggle-freehit' },
  { value: 'bench-boost', label: 'Bench Boost',  testId: 'chip-toggle-benchboost' },
]

export function ChipModeToggle({ value, onChange }: ChipModeToggleProps) {
  return (
    <div className="flex items-center gap-2" data-testid="chip-mode-toggle">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Chip:</span>
      <div
        role="group"
        aria-label="Chip mode"
        className="inline-flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
      >
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={
              `min-h-[44px] px-3 text-xs font-semibold transition-colors ` +
              (value === opt.value
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700')
            }
            data-testid={opt.testId}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
