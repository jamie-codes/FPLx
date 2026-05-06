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
          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-50'
          : value
            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700'
      }`}
    >
      Owned only
    </button>
  )
}
