import { createColumnHelper } from '@tanstack/react-table'
import type { ClubForm } from '@/lib/types'
import { FixtureBadges } from '@/components/fixtures/FixtureBadges'
import { nextEventsFixtures } from '@/lib/picks'

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
    // CF-01 (2026-09-03): this was passing the raw upcoming_fixtures, which the
    // pipeline fills to 32 gameweeks (FIXTURE_LOOKAHEAD) — so a column headed
    // "Next 5" rendered 32 badges per row. Every other FixtureBadges caller
    // already limits; this one was missed when the lookahead grew from 5.
    //
    // Limited by GAMEWEEK, not array index: a double gameweek contributes two
    // fixtures, and slice(0, 5) would silently show four gameweeks instead of
    // five whenever one of them is a DGW.
    cell: ({ row }) => <FixtureBadges fixtures={nextEventsFixtures(row.original.upcoming_fixtures, 5)} />,
    enableSorting: false,
  }),
]
