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
import { createColumns, XPtsCell } from './columns'

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

const FULL_COMPONENTS = {
  appearance_pts: 1.8,
  goal_pts: 1.2,
  assist_pts: 0.5,
  cs_pts: 1.5,
  bonus_pts: 0.5,
}

describe('Phase 48 XPT-01 — XPtsCell hover card', () => {
  it('renders hover card panel with all 5 component row labels when components provided', () => {
    const { getByText } = render(
      <XPtsCell value={5.5} ceiling={false} components={FULL_COMPONENTS} window={1} />
    )
    expect(getByText('Appearance')).toBeTruthy()
    expect(getByText('Goals')).toBeTruthy()
    expect(getByText('Assists')).toBeTruthy()
    expect(getByText('Clean sheet')).toBeTruthy()
    expect(getByText('Bonus')).toBeTruthy()
    expect(getByText('Total')).toBeTruthy()
  })

  it('hover card shows correct numeric values — Total is computed sum of components', () => {
    const { getByText } = render(
      <XPtsCell value={5.5} ceiling={false} components={FULL_COMPONENTS} window={1} />
    )
    // Appearance row value
    expect(getByText('1.80')).toBeTruthy()
    // Total = 1.8 + 1.2 + 0.5 + 1.5 + 0.5 = 5.50
    expect(getByText('5.50')).toBeTruthy()
  })

  it('renders no hover card when components is undefined (BGW null guard — D-06)', () => {
    const { container } = render(
      <XPtsCell value={0} ceiling={undefined} components={undefined} window={1} />
    )
    // No breakdown labels present
    expect(container.textContent).not.toContain('Appearance')
    expect(container.textContent).not.toContain('Goals')
  })

  it('renders MinsRiskBadge inside card when minsRisk is rotation_risk (D-02)', () => {
    const { container } = render(
      <XPtsCell
        value={5.5}
        ceiling={false}
        components={FULL_COMPONENTS}
        minsRisk="rotation_risk"
        window={1}
      />
    )
    // MinsRiskBadge renders a span with rotation_risk label text "Rotation risk"
    expect(container.textContent).toContain('Rotation risk')
  })
})

describe('Phase 41 ACC-05: last_gw_actual_pts column', () => {
  it('createColumns(noop) without gwN still works (back-compat) and includes last_gw_actual_pts', () => {
    const cols = createColumns(() => {})
    const found = cols.find((c: { id?: string; accessorKey?: string }) =>
      c.id === 'last_gw_actual_pts' || c.accessorKey === 'last_gw_actual_pts'
    )
    expect(found).toBeTruthy()
  })

  it('createColumns(noop, 32) renders the header text "GW32 Pts"', () => {
    const cols = createColumns(() => {}, 32)
    const found = cols.find((c: { id?: string; accessorKey?: string }) =>
      c.id === 'last_gw_actual_pts' || c.accessorKey === 'last_gw_actual_pts'
    ) as unknown as { header: () => React.ReactElement }
    const headerEl = found.header()
    const { container } = render(headerEl)
    expect(container.textContent).toContain('GW32 Pts')
  })

  it('cell renderer returns em-dash for null and rounded integer for a number', () => {
    const cols = createColumns(() => {}, 32)
    const found = cols.find((c: { id?: string; accessorKey?: string }) =>
      c.id === 'last_gw_actual_pts' || c.accessorKey === 'last_gw_actual_pts'
    ) as unknown as { cell: (info: { getValue: () => number | null | undefined }) => React.ReactElement | string }
    const dashEl = found.cell({ getValue: () => null })
    const { container: dashC } = render(<>{dashEl}</>)
    expect(dashC.textContent).toContain('—')
    const numEl = found.cell({ getValue: () => 7.6 })
    const { container: numC } = render(<>{numEl}</>)
    expect(numC.textContent?.trim()).toBe('8')
  })
})

// Phase 61 MC-02 — XPtsCell hover-card MC row rendering (Blank%, Haul%, Floor, Ceiling)
// RED until 061-03 extends XPtsCell with blankProb/haulProb/p10Pts/p90Pts props.
describe('XPtsCell — Phase 61 MC-02 hover card MC rows', () => {
  it('renders MC rows when blankProb/haulProb/p10Pts/p90Pts present and window===1', () => {
    render(
      <XPtsCell
        value={5.5}
        ceiling={false}
        components={FULL_COMPONENTS}
        window={1}
        blankProb={0.23}
        haulProb={0.41}
        p10Pts={3.2}
        p90Pts={11.8}
      />
    )
    // Labels (D-12: short labels `Blank%` / `Haul%` / `Floor` / `Ceiling`)
    expect(screen.getByText('Blank%')).toBeTruthy()
    expect(screen.getByText('Haul%')).toBeTruthy()
    expect(screen.getByText('Floor')).toBeTruthy()
    expect(screen.getByText('Ceiling')).toBeTruthy()
    // Values (D-14: integer percent for blank/haul; 1 decimal for floor/ceiling)
    expect(screen.getByText('23%')).toBeTruthy()
    expect(screen.getByText('41%')).toBeTruthy()
    expect(screen.getByText('3.2')).toBeTruthy()
    expect(screen.getByText('11.8')).toBeTruthy()
  })

  it('omits MC rows when window===3 (multi-GW window suppresses breakdown card entirely)', () => {
    render(
      <XPtsCell
        value={15.0}
        ceiling={false}
        components={FULL_COMPONENTS}
        window={3}
        blankProb={0.10}
        haulProb={0.50}
        p10Pts={5.0}
        p90Pts={20.0}
      />
    )
    expect(screen.queryByText('Blank%')).toBeNull()
    expect(screen.queryByText('Haul%')).toBeNull()
    expect(screen.queryByText('Floor')).toBeNull()
    expect(screen.queryByText('Ceiling')).toBeNull()
  })

  it('omits MC rows when window===5', () => {
    render(
      <XPtsCell
        value={25.0}
        ceiling={false}
        components={FULL_COMPONENTS}
        window={5}
        blankProb={0.10}
        haulProb={0.50}
        p10Pts={5.0}
        p90Pts={30.0}
      />
    )
    expect(screen.queryByText('Blank%')).toBeNull()
    expect(screen.queryByText('Haul%')).toBeNull()
    expect(screen.queryByText('Floor')).toBeNull()
    expect(screen.queryByText('Ceiling')).toBeNull()
  })
})
