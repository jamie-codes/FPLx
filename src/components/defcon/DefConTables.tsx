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
import { splitByPosition } from '@/lib/defcon'
import type { DefConPlayer } from '@/lib/types'
import { defconColumns } from './columns'
import { LandscapeTip } from '@/components/set-pieces/LandscapeTip'

function renderTable(table: Table<DefConPlayer>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-2 py-1 font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap ${
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
            <tr key={row.id} className="even:bg-zinc-50 dark:even:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700">
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
  )
}

export function DefConTables() {
  const { data, isLoading, error } = useDefCon()

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
    columns: defconColumns,
    state: { sorting: defSorting, columnVisibility },
    onSortingChange: setDefSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const midFwdTable = useReactTable({
    data: midFwdPlayers,
    columns: defconColumns,
    state: { sorting: midFwdSorting, columnVisibility },
    onSortingChange: setMidFwdSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) return <div className="text-center py-8 text-zinc-500">Loading DefCon data...</div>
  if (error) return <div className="text-center py-8 text-red-500">Failed to load DefCon data</div>

  return (
    <div className="space-y-8">
      <LandscapeTip isMobile={isMobile} isPortrait={isPortrait} />
      {/* DEF table - threshold=10 */}
      <section>
        <h2 className="text-lg font-semibold mb-2">
          Defenders (threshold: 10 contributions)
          <span className="ml-2 text-sm font-normal text-zinc-500">{defPlayers.length} players</span>
        </h2>
        {renderTable(defTable)}
      </section>

      {/* MID/FWD table - threshold=12 */}
      <section>
        <h2 className="text-lg font-semibold mb-2">
          Midfielders &amp; Forwards (threshold: 12 contributions)
          <span className="ml-2 text-sm font-normal text-zinc-500">{midFwdPlayers.length} players</span>
        </h2>
        {renderTable(midFwdTable)}
      </section>
    </div>
  )
}
