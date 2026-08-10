'use client'

// CHP-01: pre-deadline chip signals from the decision ledger + fixture shape.
// Generic advice — the pipeline cannot see which chips the user still holds.
import { useChipAdvice } from '@/lib/hooks/useChipAdvice'
import { Card } from '@/components/ui/Card'
import { Chip, type ChipIntent } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChipTimelineBar } from './ChipTimelineBar'
import type { ChipAdviceEntry, ChipSignal } from '@/lib/types'

const SIGNAL_INTENT: Record<ChipSignal, ChipIntent> = {
  play: 'positive',
  consider: 'warning',
  hold: 'neutral',
  informational: 'accent',
}

const CHIP_LABEL: Record<string, string> = {
  bench_boost: 'Bench Boost',
  triple_captain: 'Triple Captain',
  free_hit: 'Free Hit',
  wildcard: 'Wildcard',
}

function ChipRow({
  id,
  entry,
  horizonStart,
  horizonEnd,
}: {
  id: string
  entry: ChipAdviceEntry
  horizonStart?: number
  horizonEnd?: number
}) {
  return (
    <li className="border-b border-line pb-2.5 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="w-28 shrink-0">
          <div className="text-body font-semibold text-ink">{CHIP_LABEL[id] ?? id}</div>
          {entry.value != null && (
            <div className="text-data tabular text-ink-muted">{entry.value.toFixed(1)} xPts</div>
          )}
        </div>
        <Chip intent={SIGNAL_INTENT[entry.signal]} size="sm">
          {entry.signal}
        </Chip>
        <p className="min-w-0 flex-1 text-data leading-relaxed text-ink-muted">{entry.reason}</p>
      </div>
      {id !== 'wildcard' && (
        <div className="mt-2 pl-[7.75rem]">
          <ChipTimelineBar windows={entry.windows ?? []} horizonStart={horizonStart} horizonEnd={horizonEnd} />
        </div>
      )}
    </li>
  )
}

export function ChipAdviceCard() {
  const { data, isLoading, isError } = useChipAdvice()

  return (
    <Card
      title="Chips"
      subtitle={
        data
          ? `GW${data.gw}${data.dgw_team_count ? ` · ${data.dgw_team_count} DGW teams` : ''}${data.bgw_team_count ? ` · ${data.bgw_team_count} blanking` : ''}`
          : undefined
      }
    >
      {isLoading && <Skeleton className="h-24" />}
      {isError && (
        <EmptyState title="No chip advice yet" hint="Appears after the next pipeline run." />
      )}
      {data && (
        <>
          <ul className="space-y-2.5" data-testid="chip-rows">
            {(['bench_boost', 'triple_captain', 'free_hit', 'wildcard'] as const).map((id) => (
              <ChipRow key={id} id={id} entry={data.chips[id]} horizonStart={data.horizon_start} horizonEnd={data.horizon_end} />
            ))}
          </ul>
          <p className="mt-3 text-data text-ink-muted">
            {data.note} Windows are drawn from confirmed fixtures and fill in as DGWs/BGWs are scheduled.
          </p>
        </>
      )}
    </Card>
  )
}
