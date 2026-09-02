'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table'
import { useDefCon } from '@/lib/hooks/useDefCon'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { splitByPosition } from '@/lib/defcon'
import type { DefConPlayer, MergedPlayer } from '@/lib/types'
import { createDefconColumns } from './columns'
import { LandscapeTip } from '@/components/set-pieces/LandscapeTip'
import { TableShell, Th, Td, TABLE_CLS, TR_CLS } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

function renderTable(table: Table<DefConPlayer>) {
  return (
    <TableShell>
      <table className={TABLE_CLS}>
        <thead className="sticky top-0 bg-surface-1">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Th
                  key={header.id}
                  className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc'
                    ? ' ▲'
                    : header.column.getIsSorted() === 'desc'
                      ? ' ▼'
                      : null}
                </Th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={TR_CLS}>
              {row.getVisibleCells().map((cell) => (
                <Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

/** Mirrors the `games_played < 5` gate in pipeline/defcon.py — keep in step. */
const MIN_GAMES = 5

export function DefConTables() {
  const { data, isLoading, error } = useDefCon()
  // UIX-03 Task 1: join the shared players cache by id so the identity column
  // can render PlayerCell headshots/badges (defcon rows lack code/team_code).
  const { data: players } = usePlayers()

  const playerById = useMemo(
    () => new Map<number, MergedPlayer>((players ?? []).map((p) => [p.id, p])),
    [players]
  )
  const columns = useMemo(() => createDefconColumns(playerById), [playerById])

  const { def: defPlayers, midFwd: midFwdPlayers } = useMemo(
    () => splitByPosition(data ?? []),
    [data]
  )

  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640)
      setIsPortrait(window.innerHeight > window.innerWidth)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  const columnVisibility: VisibilityState = isMobile
    ? { hits: false, distance_to_threshold: false, fixture_correlation: false }
    : {}

  const [defSorting, setDefSorting] = useState<SortingState>([
    { id: 'hit_rate', desc: true },
  ])
  const [midFwdSorting, setMidFwdSorting] = useState<SortingState>([
    { id: 'hit_rate', desc: true },
  ])

  const defTable = useReactTable({
    data: defPlayers,
    columns,
    state: { sorting: defSorting, columnVisibility },
    onSortingChange: setDefSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const midFwdTable = useReactTable({
    data: midFwdPlayers,
    columns,
    state: { sorting: midFwdSorting, columnVisibility },
    onSortingChange: setMidFwdSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) return <div className="text-center py-8 text-ink-muted">Loading DefCon data...</div>
  if (error) return <div className="text-center py-8 text-negative">Failed to load DefCon data</div>

  // DEFCON-02 (2026-09-02): reported as "the tab is blank". The data was
  // correct — pipeline/defcon.py needs MIN_GAMES appearances per player before
  // a hit rate means anything, so early in a season the artifact is legitimately
  // empty. The UI rendered two headers reading "0 players" above empty tables,
  // which looks broken rather than not-yet-available. Say which it is.
  if (defPlayers.length === 0 && midFwdPlayers.length === 0) {
    return (
      <div className="py-8" data-testid="defcon-empty">
        <EmptyState
          title="Not enough games played yet"
          hint={`DefCon hit rates need at least ${MIN_GAMES} appearances per player to mean anything, so this fills in once the season has run that far. Nothing is broken — check back around GW${MIN_GAMES}.`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <LandscapeTip isMobile={isMobile} isPortrait={isPortrait} />
      {/* DEF table - threshold=10 */}
      <section>
        <h2 className="text-lg font-semibold mb-2">
          Defenders (threshold: 10 contributions)
          <span className="ml-2 text-sm font-normal text-ink-muted">{defPlayers.length} players</span>
        </h2>
        {renderTable(defTable)}
      </section>

      {/* MID/FWD table - threshold=12 */}
      <section>
        <h2 className="text-lg font-semibold mb-2">
          Midfielders &amp; Forwards (threshold: 12 contributions)
          <span className="ml-2 text-sm font-normal text-ink-muted">{midFwdPlayers.length} players</span>
        </h2>
        {renderTable(midFwdTable)}
      </section>
    </div>
  )
}
