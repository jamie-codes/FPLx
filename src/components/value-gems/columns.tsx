import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'

const col = createColumnHelper<ScoredPlayer>()

const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const fmtScore = (v: number) => (v * 100).toFixed(0)

/** Reusable price trend cell renderer — shows GW change (primary) with season total (secondary sub-text) per CONTEXT.md */
function PriceTrendCell({ costChangeEvent, costChangeStart }: { costChangeEvent: number; costChangeStart: number }) {
  const seasonAmt = (Math.abs(costChangeStart) / 10).toFixed(1)
  const seasonSign = costChangeStart > 0 ? '+' : costChangeStart < 0 ? '-' : ''
  const seasonText = costChangeStart !== 0 ? `${seasonSign}${seasonAmt}m season` : ''

  if (costChangeEvent > 0) return (
    <div>
      <span className="text-green-600">↑ {(costChangeEvent / 10).toFixed(1)}m</span>
      {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
    </div>
  )
  if (costChangeEvent < 0) return (
    <div>
      <span className="text-red-600">↓ {(Math.abs(costChangeEvent) / 10).toFixed(1)}m</span>
      {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
    </div>
  )
  return (
    <div>
      <span className="text-zinc-400">—</span>
      {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
    </div>
  )
}

export const columns = [
  col.accessor('web_name', { header: 'Player', enableSorting: true }),
  col.accessor('element_type', {
    header: 'Pos',
    enableSorting: false,
    cell: (info) => POS_LABEL[info.getValue()] ?? '?',
  }),
  col.accessor('team_short_name', { header: 'Team', enableSorting: false }),
  col.accessor('now_cost', {
    header: 'Price',
    cell: (info) => `${(info.getValue() / 10).toFixed(1)}`,
  }),
  col.accessor('selected_by_percent', { header: 'Own%' }),
  col.accessor('total_points', { header: 'Pts' }),
  col.accessor('gem_score', {
    header: 'Gem',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.display({
    id: 'trend',
    header: 'Trend',
    cell: ({ row }) => (
      <PriceTrendCell
        costChangeEvent={row.original.cost_change_event}
        costChangeStart={row.original.cost_change_start}
      />
    ),
  }),
  col.display({
    id: 'fixtures',
    header: 'Next 5',
    cell: ({ row }) => <FixtureBadges fixtures={row.original.fixtures.slice(0, 5)} />,
    enableSorting: false,
  }),
]
