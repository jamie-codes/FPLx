'use client'
// PICK-01: Weekly Picks tab — confidence strip, side-by-side 1GW/3GW top-10, gems row.
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAccuracy } from '@/lib/hooks/useAccuracy'
import { rankPicks, underTheRadar, isOffSeason } from '@/lib/picks'
import { ConfidenceStrip } from './ConfidenceStrip'
import { PicksTable } from './PicksTable'
import { UnderTheRadar } from './UnderTheRadar'

export function WeeklyPicksTab() {
  const { data: players, isLoading, error } = usePlayers()
  const { data: accuracy } = useAccuracy()

  if (isLoading) {
    return <p className="text-gray-500 dark:text-zinc-400">Loading players...</p>
  }
  if (error) {
    return (
      <p className="text-red-500">
        Failed to load players: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }
  const all = players ?? []

  if (isOffSeason(all)) {
    return (
      <div className="space-y-4">
        <ConfidenceStrip honest={accuracy?.summary?.honest_metrics} />
        <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-zinc-500 dark:text-zinc-400">
          Picks return when the season starts.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfidenceStrip honest={accuracy?.summary?.honest_metrics} />
      <div className="flex flex-wrap gap-4">
        <PicksTable title="Next GW" players={rankPicks(all, '1gw')} horizon="1gw" />
        <PicksTable title="Next 3 GWs" players={rankPicks(all, '3gw')} horizon="3gw" />
      </div>
      <UnderTheRadar players={underTheRadar(all)} />
    </div>
  )
}
