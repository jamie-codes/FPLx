import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'

const col = createColumnHelper<ScoredPlayer>()

// Position code to label map
const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

// Format score as 0-100 integer for display
const fmtScore = (v: number) => (v * 100).toFixed(0)
const fmtScoreNull = (v: number | null) => (v === null ? '\u2014' : (v * 100).toFixed(0))
const fmtDec2 = (v: number | null) => (v === null ? '\u2014' : v.toFixed(2))

export const columns = [
  col.accessor('web_name', { header: 'Player', enableSorting: true }),
  col.accessor('team_short_name', { header: 'Team', enableSorting: false }),
  col.accessor('element_type', {
    header: 'Pos',
    filterFn: 'equals',
    enableSorting: false,
    cell: (info) => POS_LABEL[info.getValue()] ?? '?',
  }),
  col.accessor('now_cost', {
    header: 'Price',
    cell: (info) => `${(info.getValue() / 10).toFixed(1)}`,
  }),
  col.accessor('gem_score', {
    header: 'Gem',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('fdr_score', {
    header: 'FDR',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('form_score', {
    header: 'Form',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('xg_per90', {
    header: 'xG/90',
    cell: (info) => fmtDec2(info.getValue()),
  }),
  col.accessor('xa_per90', {
    header: 'xA/90',
    cell: (info) => fmtDec2(info.getValue()),
  }),
  col.accessor('xg_score', {
    header: 'xG Sc',
    cell: (info) => fmtScoreNull(info.getValue()),
  }),
  col.accessor('xa_score', {
    header: 'xA Sc',
    cell: (info) => fmtScoreNull(info.getValue()),
  }),
  col.accessor('ownership_score', {
    header: 'Own',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('minutes_score', {
    header: 'Min',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('set_piece_score', {
    header: 'SP',
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.accessor('selected_by_percent', { header: 'Own%' }),
  col.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: (info) => info.getValue() === 'a' ? '' : info.getValue().toUpperCase(),
  }),
  col.display({
    id: 'trend',
    header: 'Trend',
    cell: ({ row }) => {
      const ev = row.original.cost_change_event
      const st = row.original.cost_change_start
      const seasonAmt = (Math.abs(st) / 10).toFixed(1)
      const seasonSign = st > 0 ? '+' : st < 0 ? '-' : ''
      const seasonText = st !== 0 ? `${seasonSign}${seasonAmt}m season` : ''

      if (ev > 0) return (
        <div>
          <span className="text-green-600">↑ {(ev / 10).toFixed(1)}m</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
      if (ev < 0) return (
        <div>
          <span className="text-red-600">↓ {(Math.abs(ev) / 10).toFixed(1)}m</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
      return (
        <div>
          <span className="text-zinc-400">—</span>
          {seasonText && <span className="block text-[10px] text-zinc-400">{seasonText}</span>}
        </div>
      )
    },
  }),
  col.display({
    id: 'fixtures',
    header: 'Next 5',
    cell: ({ row }) => <FixtureBadges fixtures={row.original.fixtures.slice(0, 5)} />,
    enableSorting: false,
  }),
]
