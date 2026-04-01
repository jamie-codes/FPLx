'use client'

import { useState, useEffect } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useClubForm } from '@/lib/hooks/useClubForm'
import { LastUpdated } from '@/components/LastUpdated'
import { columns } from './columns'

export function ClubFormTable() {
  const { data, isLoading, error } = useClubForm()

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const columnVisibility: VisibilityState = isMobile
    ? { goals_scored: false, goals_conceded: false, upcoming: false }
    : {}

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'wins', desc: true },
  ])

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return <p className="text-gray-500">Loading club form...</p>
  }

  if (error) {
    return (
      <p className="text-red-500">
        Failed to load club form: {error instanceof Error ? error.message : String(error)}
      </p>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Club Form (Last 5 Games)</h2>
      <p className="text-sm text-gray-500 mb-2">{table.getRowModel().rows.length} clubs</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-2 py-1 font-semibold text-gray-700 whitespace-nowrap ${
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
      <LastUpdated />
    </div>
  )
}
