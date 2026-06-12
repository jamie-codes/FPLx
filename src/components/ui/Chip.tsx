'use client'
// UIX-01 primitive: the badge/pill unifier. Styled exclusively from semantic tokens.
const INTENT_CLS = {
  neutral:  'bg-surface-2 text-ink-muted border-line',
  accent:   'bg-accent-soft text-accent border-accent/40',
  positive: 'bg-positive-soft text-positive border-positive/40',
  warning:  'bg-warning-soft text-warning border-warning/40',
  negative: 'bg-negative-soft text-negative border-negative/40',
} as const

export type ChipIntent = keyof typeof INTENT_CLS

export function Chip({ intent = 'neutral', size = 'sm', title, children }: {
  intent?: ChipIntent
  size?: 'sm' | 'md'
  title?: string
  children: React.ReactNode
}) {
  const sizeCls = size === 'sm' ? 'text-data px-2 py-0.5' : 'text-body px-2.5 py-1'
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 rounded-md border whitespace-nowrap ${INTENT_CLS[intent]} ${sizeCls}`}>
      {children}
    </span>
  )
}
