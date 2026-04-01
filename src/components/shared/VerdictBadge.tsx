'use client'

import type { Verdict } from '@/lib/recommend'

interface Config {
  bg: string
  text: string
  label: string
  title: string
}

const VERDICT_MAP: Record<Verdict, Config> = {
  buy: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-800 dark:text-green-200',
    label: 'Buy',
    title: 'Buy: strong gem score relative to position average',
  },
  hold: {
    bg: 'bg-zinc-100 dark:bg-zinc-700',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Hold',
    title: 'Hold: gem score within acceptable range — no action needed',
  },
  sell: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    label: 'Sell',
    title: 'Sell: low gem score — consider replacing',
  },
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null
  const config = VERDICT_MAP[verdict]
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
