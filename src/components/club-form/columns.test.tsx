// @vitest-environment jsdom
// CF-01: the "Next 5" column must show five gameweeks, not the whole lookahead.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ClubForm, FixtureEntry } from '@/lib/types'
import { columns } from './columns'

function fx(event_id: number, opponent = 'ARS'): FixtureEntry {
  return {
    opponent_team: opponent, is_home: true, event_id,
    difficulty_score: 0.5, difficulty_tier: 'medium',
    attacking_difficulty: 0.5, defensive_difficulty: 0.5,
  }
}

function makeTeam(upcoming: FixtureEntry[]): ClubForm {
  return {
    team_id: 1, team_name: 'Team', team_short_name: 'TST',
    wins: 3, draws: 1, losses: 1, goals_scored: 8, goals_conceded: 4,
    upcoming_fixtures: upcoming, current_gw_played: [],
    attacking_ease_1gw: null, attacking_ease_3gw: null, attacking_ease_5gw: null,
    defensive_ease_1gw: null, defensive_ease_3gw: null, defensive_ease_5gw: null,
  } as unknown as ClubForm
}

/** Render just the upcoming column's cell for one team. */
function renderUpcoming(team: ClubForm) {
  function Harness() {
    const table = useReactTable({
      data: [team], columns, getCoreRowModel: getCoreRowModel(),
    })
    const cell = table.getRowModel().rows[0].getVisibleCells()
      .find(c => c.column.id === 'upcoming')!
    return <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>
  }
  return render(<Harness />).container
}

describe('club-form columns — Next 5 (CF-01)', () => {
  it('shows five gameweeks even though the pipeline sends 32', () => {
    // FIXTURE_LOOKAHEAD is 32; the column header promises 5. It used to pass the
    // raw array straight through, rendering 32 badges on every row.
    const container = renderUpcoming(makeTeam(
      Array.from({ length: 32 }, (_, i) => fx(i + 1)),
    ))
    expect(container.querySelectorAll('span.border')).toHaveLength(5)
  })

  it('counts a double gameweek as one of the five, not two', () => {
    // slice(0, 5) would show four gameweeks here. Limiting by event keeps five.
    const upcoming = [fx(1), fx(2), fx(3, 'CHE'), fx(3, 'LIV'), fx(4), fx(5), fx(6), fx(7)]
    const container = renderUpcoming(makeTeam(upcoming))
    // 5 gameweeks, one of which carries two fixtures -> 6 badges.
    expect(container.querySelectorAll('span.border')).toHaveLength(6)
    expect(container.textContent).toContain('DGW')
    // GW6 and GW7 are beyond the window and must not appear.
    const events = Array.from(container.querySelectorAll('span.border'))
    expect(events.length).toBeLessThan(upcoming.length)
  })

  it('renders fewer than five when the season is running out', () => {
    const container = renderUpcoming(makeTeam([fx(37), fx(38)]))
    expect(container.querySelectorAll('span.border')).toHaveLength(2)
  })

  it('renders nothing for a team with no upcoming fixtures', () => {
    const container = renderUpcoming(makeTeam([]))
    expect(container.querySelectorAll('span.border')).toHaveLength(0)
  })
})
