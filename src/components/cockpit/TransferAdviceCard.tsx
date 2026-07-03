'use client'

// TRF-01: the pipeline transfer advisor's recommendation for this GW.
// Advises on the MODEL's squad trajectory (the pipeline cannot see a user's
// team) — the moves are "what the model would do", labelled as such.
import { useTransferAdvice } from '@/lib/hooks/useTransferAdvice'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ArrowRight } from 'lucide-react'

const POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' } as const

export function TransferAdviceCard() {
  const { data, isLoading, isError } = useTransferAdvice()

  return (
    <Card
      title="Transfers"
      subtitle={data ? `GW${data.gw} · model squad trajectory` : 'model squad trajectory'}
      action={
        data && !data.hold ? (
          <Chip intent={data.net_gain > 0 ? 'positive' : 'warning'}>
            net {data.net_gain > 0 ? '+' : ''}{data.net_gain.toFixed(1)} xPts
          </Chip>
        ) : data?.hold ? (
          <Chip intent="neutral">hold</Chip>
        ) : null
      }
    >
      {isLoading && <Skeleton className="h-24" />}
      {isError && (
        <EmptyState
          title="No transfer advice yet"
          hint="Appears after the next pipeline run."
        />
      )}
      {data && data.hold && (
        <p className="text-body text-ink-muted" data-testid="hold-message">
          No move clears the gain bar this week — the strongest play is to bank
          the free transfer.
        </p>
      )}
      {data && !data.hold && (
        <ul className="space-y-2" data-testid="advice-moves">
          {data.moves.map((m) => (
            <li
              key={m.out.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2"
            >
              <Chip intent="neutral" size="sm">{POS[m.out.element_type]}</Chip>
              <span className={`text-body ${m.out.available === false ? 'text-ink-muted line-through' : 'text-ink'}`}>
                {m.out.name}
              </span>
              <ArrowRight size={14} className="text-ink-muted" aria-hidden />
              <span className="text-body font-semibold text-ink">{m.in.name}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {m.out.available === false && (
                  <Chip intent="negative" size="sm" title={m.reason}>forced</Chip>
                )}
                {m.hit && <Chip intent="warning" size="sm">-4 hit</Chip>}
                <span className="text-data tabular text-positive">+{m.gain.toFixed(1)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <p className="mt-3 text-data text-ink-muted">
          {data.n_free_used} free{data.n_hits > 0 ? ` + ${data.n_hits} hit` : ''} ·
          validated on 2025/26: +136 pts vs holding all season (exp14).
        </p>
      )}
    </Card>
  )
}
