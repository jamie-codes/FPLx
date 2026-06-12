'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import { columns } from './columns'
import { LastUpdated } from '@/components/LastUpdated'
import { isCheapGem, isLowOwned } from '@/lib/value-gems'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { TableShell, Th, Td, TABLE_CLS, TR_CLS } from '@/components/ui/Table'

type FilterMode = 'cheap' | 'low-owned' | 'all'

const FILTER_OPTIONS: { id: FilterMode; label: string }[] = [
  { id: 'cheap', label: 'Cheap (£6m-)' },
  { id: 'low-owned', label: 'Low-owned (<10%)' },
  { id: 'all', label: 'All' },
]

export function ValueGemsTable() {
  const { data, isLoading, error } = usePlayers()
  const [filter, setFilter] = useState<FilterMode>('cheap')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'gem_score', desc: true },
  ])

  const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const columnVisibility: VisibilityState = isMobile
    ? { element_type: false, team_short_name: false, selected_by_percent: false, trend: false, fixtures: false, pts_last5gw: false, pts_last3gw: false }
    : {}

  const filteredPlayers = useMemo(() => {
    switch (filter) {
      case 'cheap':
        return scoredPlayers.filter(p => isCheapGem(p))
      case 'low-owned':
        return scoredPlayers.filter(p => isLowOwned(p))
      case 'all':
        return scoredPlayers
    }
  }, [scoredPlayers, filter])

  const table = useReactTable({
    data: filteredPlayers,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return <p className="text-ink-muted">Loading players...</p>
  }

  if (error) {
    return (
      <p className="text-negative">
        Failed to load players: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Value Gems</h1>

      {/* UIX-03 Task 2: filter pills → SegmentedToggle (same modes/semantics) */}
      <div className="mb-4">
        <SegmentedToggle
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(id) => setFilter(id as FilterMode)}
          size="sm"
          ariaLabel="Filter players"
        />
      </div>

      <p className="text-sm text-ink-muted mb-2">{table.getRowModel().rows.length} players</p>

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

      <LastUpdated />
    </div>
  )
}
