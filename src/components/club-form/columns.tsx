import { createColumnHelper } from '@tanstack/react-table'
import type { ClubForm } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'

const col = createColumnHelper<ClubForm>()

export const columns = [
  col.accessor('team_short_name', { header: 'Team', enableSorting: true }),
  col.accessor('wins', { header: 'W' }),
  col.accessor('draws', { header: 'D' }),
  col.accessor('losses', { header: 'L' }),
  col.accessor('goals_scored', { header: 'GS' }),
  col.accessor('goals_conceded', { header: 'GC' }),
  col.display({
    id: 'goal_diff',
    header: 'GD',
    cell: ({ row }) => {
      const gd = row.original.goals_scored - row.original.goals_conceded
      return gd > 0 ? `+${gd}` : String(gd)
    },
  }),
  col.display({
    id: 'upcoming',
    header: 'Next 5',
    cell: ({ row }) => <FixtureBadges fixtures={row.original.upcoming_fixtures} />,
    enableSorting: false,
  }),
]
