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
      className="flex rounded overflow-hidden border border-line"
    >
      {(['ATT', 'DEF'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={value === m}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === m
              ? 'bg-ink text-surface-1'
              : 'bg-surface-1 text-ink hover:bg-surface-2'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
