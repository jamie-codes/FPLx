import { createColumnHelper } from '@tanstack/react-table'
import type { DefConPlayer } from '@/lib/types'
import { formatHitRate, formatCorrelation } from '@/lib/defcon'

const col = createColumnHelper<DefConPlayer>()

export const defconColumns = [
  col.accessor('web_name', {
    header: 'Player',
    enableSorting: true,
  }),
  col.accessor('team_short_name', {
    header: 'Team',
    enableSorting: false,
  }),
  col.accessor('hit_rate', {
    header: 'Hit Rate',
    cell: (info) => formatHitRate(info.getValue()),
    enableSorting: true,
  }),
  col.accessor('hits', {
    header: 'Hits',
    cell: (info) => `${info.getValue()} / ${info.row.original.games_played}`,
    enableSorting: true,
  }),
  col.accessor('avg_per90', {
    header: 'Avg DC/90',
    cell: (info) => info.getValue().toFixed(1),
    enableSorting: true,
  }),
  col.accessor('distance_to_threshold', {
    header: 'Distance',
    cell: (info) => {
      const val = info.getValue()
      const cls = val < 0 ? 'text-green-600' : 'text-red-600'
      return <span className={cls}>{val.toFixed(1)}</span>
    },
    enableSorting: true,
  }),
  col.display({
    id: 'fixture_correlation',
    header: 'Easy vs Hard',
    cell: (info) => {
      const fc = info.row.original.fixture_correlation
      const formatted = formatCorrelation(fc)
      if (formatted.label) return <span className="text-zinc-400">{formatted.label}</span>
      return `Easy: ${formatted.easy} | Hard: ${formatted.hard}`
    },
    enableSorting: false,
  }),
]
