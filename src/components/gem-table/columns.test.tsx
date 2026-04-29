// @vitest-environment jsdom
// Phase 39 CMP-01 — compare icon in web_name cell
//
// Today `columns.tsx` exports a static `columns` array.
// Plan 03 will replace it with a `createColumns(onCompare)` factory that accepts
// a callback and wires a compare button into the web_name cell renderer.
//
// This test is intentionally RED until Plan 03 ships: the named export
// `createColumns` does not yet exist, so the import below fails at runtime.
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import type { ScoredPlayer } from '@/lib/types'
import { createColumns } from './columns'

const PLAYER_A = {
  id: 1,
  web_name: 'Salah',
  team_short_name: 'LIV',
  element_type: 3,
  gem_score: 0.82,
  // remaining ScoredPlayer fields — defaults via cast
} as unknown as ScoredPlayer

describe('columns — Phase 39 CMP-01 compare icon', () => {
  it('createColumns(onCompare) returns columns whose web_name cell renders a compare button that fires onCompare', () => {
    const onCompare = vi.fn()
    const cols = createColumns(onCompare)
    // Column 0 is web_name (sort-preserving accessor)
    const webNameCol = cols[0] as { id?: string; accessorKey?: string; cell: (ctx: any) => React.ReactNode }
    // Confirm it is the web_name accessor column
    expect(webNameCol.accessorKey === 'web_name' || webNameCol.id === 'web_name').toBe(true)
    // Render the cell with a synthetic row context
    const cellNode = webNameCol.cell({ row: { original: PLAYER_A } })
    render(<>{cellNode}</>)
    // The player name is rendered
    expect(screen.getByText('Salah')).toBeTruthy()
    // The compare button is present with aria-label
    const btn = screen.getByLabelText('Compare Salah')
    expect(btn).toBeTruthy()
    // Clicking it fires onCompare with PLAYER_A
    fireEvent.click(btn)
    expect(onCompare).toHaveBeenCalledWith(PLAYER_A)
  })
})
