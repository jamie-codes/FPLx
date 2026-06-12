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
      <span className="text-xs text-ink-muted">Chip:</span>
      <div
        role="group"
        aria-label="Chip mode"
        className="inline-flex rounded-md overflow-hidden border border-line"
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
                ? 'bg-ink text-surface-1'
                : 'bg-surface-1 text-ink hover:bg-surface-2')
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
