'use client'

import type { Verdict } from '@/lib/recommend'
import { Chip } from '@/components/ui/Chip'
import type { ChipIntent } from '@/components/ui/Chip'

const VERDICT_INTENT: Record<Verdict, ChipIntent> = {
  buy:  'positive',
  hold: 'neutral',
  sell: 'negative',
}

const VERDICT_TITLE: Record<Verdict, string> = {
  buy:  'Buy: strong gem score relative to position average',
  hold: 'Hold: gem score within acceptable range — no action needed',
  sell: 'Sell: low gem score — consider replacing',
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null
  return (
    <Chip intent={VERDICT_INTENT[verdict]} title={VERDICT_TITLE[verdict]}>
      {verdict.charAt(0).toUpperCase() + verdict.slice(1)}
    </Chip>
  )
}
