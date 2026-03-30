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
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Buy',
    title: 'Buy: strong gem score relative to position average',
  },
  hold: {
    bg: 'bg-zinc-100',
    text: 'text-zinc-700',
    label: 'Hold',
    title: 'Hold: gem score within acceptable range — no action needed',
  },
  sell: {
    bg: 'bg-red-100',
    text: 'text-red-700',
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
