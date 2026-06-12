'use client'

interface Props {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

export function OwnedFilterToggle({ value, onChange, disabled }: Props) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-label={value ? 'Show all teams' : 'Show only teams with owned players'}
      disabled={disabled}
      title={disabled ? 'Load your team to filter to owned teams' : undefined}
      className={`px-3 py-2.5 sm:py-1 text-sm font-medium rounded border transition-all cursor-pointer active:scale-95 min-h-[44px] ${
        disabled
          ? 'bg-surface-2 text-ink-muted border-line cursor-not-allowed opacity-50'
          : value
            ? 'bg-ink text-surface-1 border-ink'
            : 'bg-surface-1 text-ink border-line hover:bg-surface-2'
      }`}
    >
      Owned only
    </button>
  )
}
