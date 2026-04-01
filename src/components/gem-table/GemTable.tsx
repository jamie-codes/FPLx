'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import type { PositionCode } from '@/lib/types'
import { columns } from './columns'
import { PositionFilter } from './PositionFilter'
import { GwToggle, getColumnVisibility } from './GwToggle'

const HIDDEN_COLUMN_LABELS: Record<string, string> = {
  team_short_name: 'Team',
  now_cost: 'Price',
  fdr_score: 'FDR',
  form_score: 'Form',
  xg_per90: 'xG/90',
  xa_per90: 'xA/90',
  xg_score: 'xG Score',
  xa_score: 'xA Score',
  ownership_score: 'Own Score',
  minutes_score: 'Minutes',
  set_piece_score: 'Set Piece',
  selected_by_percent: 'Owned %',
  status: 'Status',
  trend: 'Price Trend',
  fixtures: 'Next 5',
}

export function GemTable() {
  const { data, isLoading, error } = usePlayers()

  const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'gem_score', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [activePosition, setActivePosition] = useState<PositionCode | null>(null)
  const [gwHorizon, setGwHorizon] = useState<1 | 3 | 5>(1)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [expanded, setExpanded] = useState<ExpandedState>({})

  const columnVisibility: VisibilityState = getColumnVisibility(gwHorizon, isMobile)

  const table = useReactTable({
    data: scoredPlayers,
    columns,
    state: { sorting, columnFilters, columnVisibility, expanded },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => isMobile,
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
                      header.column.id === 'web_name'
                        ? 'sticky left-0 z-30 bg-white'
                        : 'z-20'
                    } ${
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
              <Fragment key={row.id}>
                <tr
                  className={`even:bg-gray-50 hover:bg-blue-50 ${isMobile ? 'cursor-pointer active:bg-blue-100' : ''}`}
                  onClick={() => { if (isMobile) row.toggleExpanded() }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={
                        cell.column.id === 'web_name'
                          ? 'px-2 py-1 whitespace-nowrap sticky left-0 z-10 bg-white'
                          : 'px-2 py-1 whitespace-nowrap'
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr className="bg-blue-50 sm:hidden">
                    <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {row.getAllCells()
                          .filter(cell => HIDDEN_COLUMN_LABELS[cell.column.id])
                          .map(cell => (
                            <div key={cell.column.id} className="flex gap-1">
                              <dt className="text-gray-500 shrink-0">
                                {HIDDEN_COLUMN_LABELS[cell.column.id]}:
                              </dt>
                              <dd className="font-medium truncate">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </dd>
                            </div>
                          ))
                        }
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
