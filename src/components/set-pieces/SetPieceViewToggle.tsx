'use client'

export type SetPieceView = 'takers' | 'league'

const VIEW_LABELS: Record<SetPieceView, string> = {
  takers: 'Takers',
  league: 'League Table',
}

interface SetPieceViewToggleProps {
  view: SetPieceView
  onViewChange: (v: SetPieceView) => void
}

export function SetPieceViewToggle({ view, onViewChange }: SetPieceViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Set-piece view"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {(['takers', 'league'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onViewChange(v)}
          aria-pressed={view === v}
          className={`px-3 py-2 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] sm:min-h-0 ${
            view === v
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  )
}
