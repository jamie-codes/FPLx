'use client'

// Phase 45 (TFR-01): FtToggle — "Free transfers: [1 FT] [2 FTs]" pill toggle.
// Visual sibling of src/components/gem-table/GwToggle.tsx. Locked by 45-UI-SPEC.md §1.

interface FtToggleProps {
  value: 1 | 2
  onChange: (value: 1 | 2) => void
}

export function FtToggle({ value, onChange }: FtToggleProps) {
  return (
    <div className="flex items-center gap-2" data-testid="ft-toggle">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Free transfers:</span>
      <div
        role="group"
        aria-label="Available free transfers"
        className="inline-flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
      >
        <button
          type="button"
          onClick={() => onChange(1)}
          aria-pressed={value === 1}
          className={
            `min-h-[44px] px-3 text-xs font-semibold transition-colors ` +
            (value === 1
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700')
          }
          data-testid="ft-toggle-1"
        >
          1 FT
        </button>
        <button
          type="button"
          onClick={() => onChange(2)}
          aria-pressed={value === 2}
          className={
            `min-h-[44px] px-3 text-xs font-semibold transition-colors ` +
            (value === 2
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700')
          }
          data-testid="ft-toggle-2"
        >
          2 FTs
        </button>
      </div>
    </div>
  )
}
