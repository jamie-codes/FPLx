'use client'

import { LABEL_EXPLANATIONS, type LifecycleLabel } from '@/lib/lifecycle-label'

interface Config {
  bg: string
  text: string
  label: string
}

// UIX-04: stays bespoke, internals retokenized. The 7-tier ladder keeps 7
// distinct labels mapped onto semantic intents: buy_next_week→positive,
// hold_one_more→accent, hold→neutral, minutes_trap/fixture_trap/sell_soon→warning,
// sell→negative. Hover titles come from the shared LABEL_EXPLANATIONS map so
// every surface explains a label with the same (threshold-interpolated) words.
const LABEL_MAP: Record<LifecycleLabel, Config> = {
  buy_next_week: {
    bg: 'bg-positive-soft',
    text: 'text-positive',
    label: 'Buy Next Week',
  },
  hold_one_more: {
    bg: 'bg-accent-soft',
    text: 'text-accent',
    label: 'Hold One More',
  },
  sell_soon: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Sell Soon',
  },
  minutes_trap: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Minutes Trap',
  },
  fixture_trap: {
    bg: 'bg-warning-soft',
    text: 'text-warning',
    label: 'Fixture Trap',
  },
  hold: {
    bg: 'bg-surface-2',
    text: 'text-ink-muted',
    label: 'Hold',
  },
  sell: {
    bg: 'bg-negative-soft',
    text: 'text-negative',
    label: 'Sell',
  },
}

export function LifecycleLabelBadge({ label }: { label: LifecycleLabel | null }) {
  if (!label) return null
  const config = LABEL_MAP[label]
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={LABEL_EXPLANATIONS[label]}
    >
      {config.label}
    </span>
  )
}
