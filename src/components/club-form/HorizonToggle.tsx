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
      className="flex rounded overflow-hidden border border-line"
    >
      {([8, 12, 16] as const).map((h) => (
        <button
          key={h}
          onClick={() => onChange(h)}
          aria-pressed={value === h}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
            value === h
              ? 'bg-ink text-surface-1'
              : 'bg-surface-1 text-ink hover:bg-surface-2'
          }`}
        >
          {h} GW
        </button>
      ))}
    </div>
  )
}
