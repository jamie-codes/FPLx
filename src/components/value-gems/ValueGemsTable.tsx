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

type FilterMode = 'cheap' | 'low-owned' | 'all'

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
    return <p className="text-gray-500">Loading players...</p>
  }

  if (error) {
    return (
      <p className="text-red-500">
        Failed to load players: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Value Gems</h1>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {(['cheap', 'low-owned', 'all'] as const).map((mode) => (
          <button
            key={mode}
            className={`px-3 py-1 text-sm rounded-full border ${
              filter === mode
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-400'
            }`}
            onClick={() => setFilter(mode)}
          >
            {mode === 'cheap' ? 'Cheap (£6m-)' : mode === 'low-owned' ? 'Low-owned (<10%)' : 'All'}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500 mb-2">{table.getRowModel().rows.length} players</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-2 py-1 font-semibold text-gray-700 dark:text-zinc-300 whitespace-nowrap ${
                      header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'
                      ? ' \u25B2'
                      : header.column.getIsSorted() === 'desc'
                        ? ' \u25BC'
                        : null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="even:bg-gray-50 dark:even:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LastUpdated />
    </div>
  )
}
