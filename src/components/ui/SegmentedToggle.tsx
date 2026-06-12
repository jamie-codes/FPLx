'use client'
// UIX-03 primitive: button-based segmented control. Unifies GwToggle,
// PositionFilter, the Value Gems filter pills and SetPieceViewToggle (each
// call site keeps its own option list/semantics — only the control unifies).
// Active segment uses the existing GwToggle visual convention, tokenized:
// bg-ink text-surface-1. Buttons tab naturally; aria-pressed marks state.
export function SegmentedToggle({ options, value, onChange, size = 'md', ariaLabel }: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  size?: 'sm' | 'md'
  ariaLabel: string
}) {
  const sizeCls = size === 'sm' ? 'min-h-[32px] px-3 text-data' : 'min-h-[44px] px-4 text-body'
  return (
    <div role="group" aria-label={ariaLabel}
      className="inline-flex rounded-md border border-line overflow-hidden">
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button key={opt.id} type="button" aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`${sizeCls} font-medium whitespace-nowrap transition-colors duration-150 ${
              active ? 'bg-ink text-surface-1' : 'text-ink-muted hover:bg-surface-2'
            }`}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
