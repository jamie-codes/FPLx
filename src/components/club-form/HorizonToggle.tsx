'use client'

interface Props {
  value: 8 | 12 | 16
  onChange: (v: 8 | 12 | 16) => void
}

export function HorizonToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Heat map horizon"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {([8, 12, 16] as const).map((h) => (
        <button
          key={h}
          onClick={() => onChange(h)}
          aria-pressed={value === h}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
            value === h
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {h} GW
        </button>
      ))}
    </div>
  )
}
