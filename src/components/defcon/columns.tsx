import { createColumnHelper } from '@tanstack/react-table'
import type { DefConPlayer } from '@/lib/types'
import { formatHitRate, formatCorrelation } from '@/lib/defcon'

const col = createColumnHelper<DefConPlayer>()

// Column header with hover tooltip
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>

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
    header: H('Hit Rate', 'Proportion of games where the player met the defensive contribution threshold (10 for DEF, 12 for MID/FWD)'),
    cell: (info) => formatHitRate(info.getValue()),
    enableSorting: true,
  }),
  col.accessor('hits', {
    header: H('Hits', 'Games meeting the threshold / total games played with minutes > 0'),
    cell: (info) => `${info.getValue()} / ${info.row.original.games_played}`,
    enableSorting: true,
  }),
  col.accessor('avg_per90', {
    header: H('Avg DC/90', 'Average defensive contributions per 90 minutes (tackles + clearances + blocks + interceptions)'),
    cell: (info) => info.getValue().toFixed(1),
    enableSorting: true,
  }),
  col.accessor('distance_to_threshold', {
    header: H('Distance', 'Threshold minus average DC/90. Negative (green) = player exceeds threshold. Positive (red) = player falls short'),
    cell: (info) => {
      const val = info.getValue()
      const cls = val < 0 ? 'text-green-600' : 'text-red-600'
      return <span className={cls}>{val.toFixed(1)}</span>
    },
    enableSorting: true,
  }),
  col.display({
    id: 'fixture_correlation',
    header: H('Easy vs Hard', 'Hit rate split by fixture difficulty. Requires ≥5 games in both easy and hard categories — "Insufficient data" means too few easy or hard fixtures to compare reliably'),
    cell: (info) => {
      const fc = info.row.original.fixture_correlation
      const formatted = formatCorrelation(fc)
      if (formatted.label) return <span className="text-zinc-400">{formatted.label}</span>
      return `Easy: ${formatted.easy} | Hard: ${formatted.hard}`
    },
    enableSorting: false,
  }),
]
