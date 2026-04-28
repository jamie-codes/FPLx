'use client'

interface Props {
  value: 'ATT' | 'DEF'
  onChange: (v: 'ATT' | 'DEF') => void
}

export function AttDefToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Fixture ease position view"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {(['ATT', 'DEF'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={value === m}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === m
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
