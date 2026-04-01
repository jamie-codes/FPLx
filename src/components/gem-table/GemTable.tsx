'use client'

import { useState, useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import type { PositionCode } from '@/lib/types'
import { columns } from './columns'
import { PositionFilter } from './PositionFilter'
import { GwToggle, getColumnVisibility } from './GwToggle'

export function GemTable() {
  const { data, isLoading, error } = usePlayers()

  const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'gem_score', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [activePosition, setActivePosition] = useState<PositionCode | null>(null)
  const [gwHorizon, setGwHorizon] = useState<1 | 3 | 5>(1)

  const columnVisibility: VisibilityState = getColumnVisibility(gwHorizon)

  const table = useReactTable({
    data: scoredPlayers,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const handlePositionChange = (code: PositionCode | null) => {
    setActivePosition(code)
    if (code === null) {
      setColumnFilters([])
    } else {
      setColumnFilters([{ id: 'element_type', value: code }])
    }
  }

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
      <h1 className="text-2xl font-bold mb-4">Gem Ratings</h1>
      <div className="flex justify-between items-center mb-2">
        <PositionFilter active={activePosition} onChange={handlePositionChange} />
        <GwToggle value={gwHorizon} onChange={setGwHorizon} />
      </div>
      <p className="text-sm text-gray-500 mb-2">
        {table.getRowModel().rows.length} players
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-2 py-2.5 sm:py-1 font-semibold text-gray-700 whitespace-nowrap min-h-[44px] ${
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
              <tr key={row.id} className="even:bg-gray-50 hover:bg-blue-50">
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
    </div>
  )
}
