'use client'

export type ClubFormView = 'form' | 'heat-map'

const VIEW_LABELS: Record<ClubFormView, string> = {
  'form': 'Form',
  'heat-map': 'Heat Map',
}

interface ClubFormViewToggleProps {
  view: ClubFormView
  onViewChange: (v: ClubFormView) => void
}

export function ClubFormViewToggle({ view, onViewChange }: ClubFormViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Club Form view"
      className="flex rounded overflow-hidden border border-line"
    >
      {(['form', 'heat-map'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onViewChange(v)}
          aria-pressed={view === v}
          className={`px-3 py-2 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] sm:min-h-0 ${
            view === v
              ? 'bg-ink text-surface-1'
              : 'bg-surface-1 text-ink hover:bg-surface-2'
          }`}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  )
}
