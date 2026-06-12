import { createColumnHelper } from '@tanstack/react-table'
import type { ScoredPlayer } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { PlayerCell } from '@/components/ui/PlayerCell'
import { PriceTrendCell } from '@/components/shared/PriceTrendCell'

const col = createColumnHelper<ScoredPlayer>()

const POS_LABEL: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const fmtScore = (v: number) => (v * 100).toFixed(0)
const H = (label: string, tip: string) => () => <span title={tip} className="cursor-help">{label}</span>

export const columns = [
  col.accessor('web_name', {
    header: 'Player',
    enableSorting: true,
    // UIX-03 Task 2: identity column → PlayerCell sm (MergedPlayer carries
    // code/team_code directly; pos/team/price stay in their own columns).
    cell: (info) => (
      <PlayerCell
        size="sm"
        webName={info.getValue()}
        code={info.row.original.code}
        teamCode={info.row.original.team_code}
      />
    ),
  }),
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
  col.accessor('total_points', {
    id: 'total_points',
    header: 'Total Pts',
    enableSorting: true,
  }),
  col.accessor('pts_last5gw', {
    id: 'pts_last5gw',
    header: 'Pts L5',
    enableSorting: true,
    cell: (info) => {
      const value = info.getValue()
      const gwCount = info.row.original.pts_gw_count
      // D-11: asterisk for partial window (fewer than 5 GWs of data)
      return gwCount < 5 ? <span title={`${gwCount} of 5 gameweeks`}>{value}*</span> : value
    },
  }),
  col.accessor('pts_last3gw', {
    id: 'pts_last3gw',
    header: 'Pts L3',
    enableSorting: true,
    cell: (info) => {
      const value = info.getValue()
      const gwCount = info.row.original.pts_gw_count
      // D-11: asterisk for partial window (fewer than 3 GWs of data)
      return gwCount < 3 ? <span title={`${gwCount} of 3 gameweeks`}>{value}*</span> : value
    },
  }),
  col.accessor('gem_score', {
    header: H('Gem', 'Composite Gem score (0–100): weighted blend of FDR, form, xG/90, xA/90, differential ownership, minutes reliability, and set-piece role'),
    cell: (info) => fmtScore(info.getValue()),
  }),
  col.display({
    id: 'trend',
    header: 'Trend',
    // UIX-03 Task 2: repointed to the shared PriceTrendCell (gem-table's
    // duplicate is repointed in Task 5).
    cell: ({ row }) => (
      <PriceTrendCell
        costChangeEvent={row.original.cost_change_event ?? 0}
        costChangeStart={row.original.cost_change_start ?? 0}
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
