'use client'
// UIX-01 primitive: the badge/pill unifier. Styled exclusively from semantic tokens.
// UIX-03 adds the violet intent (VarianceBadge ceiling / xA route pill) and the
// outline variant (transparent bg, 1px full-strength intent border, intent ink).
const INTENT_CLS = {
  neutral:  'bg-surface-2 text-ink-muted border-line',
  accent:   'bg-accent-soft text-accent border-accent/40',
  positive: 'bg-positive-soft text-positive border-positive/40',
  warning:  'bg-warning-soft text-warning border-warning/40',
  negative: 'bg-negative-soft text-negative border-negative/40',
  violet:   'bg-violet-soft text-violet border-violet/40',
} as const

const OUTLINE_CLS = {
  neutral:  'bg-transparent text-ink-muted border-line',
  accent:   'bg-transparent text-accent border-accent',
  positive: 'bg-transparent text-positive border-positive',
  warning:  'bg-transparent text-warning border-warning',
  negative: 'bg-transparent text-negative border-negative',
  violet:   'bg-transparent text-violet border-violet',
} as const

export type ChipIntent = keyof typeof INTENT_CLS
export type ChipVariant = 'solid' | 'outline'

export function Chip({ intent = 'neutral', variant = 'solid', size = 'sm', title, children }: {
  intent?: ChipIntent
  variant?: ChipVariant
  size?: 'sm' | 'md'
  title?: string
  children: React.ReactNode
}) {
  const sizeCls = size === 'sm' ? 'text-data px-2 py-0.5' : 'text-body px-2.5 py-1'
  const intentCls = variant === 'outline' ? OUTLINE_CLS[intent] : INTENT_CLS[intent]
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 rounded-md border whitespace-nowrap ${intentCls} ${sizeCls}`}>
      {children}
    </span>
  )
}
