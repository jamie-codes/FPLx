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
import { MOBILE_HIDDEN_COLUMNS } from './GwToggle'

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

// Phase 102 MC-01: XPtsCell hover card now uses MCDistributionBar (replaces Phase 61 Blank%/Haul%/Floor/Ceiling text rows).
describe('XPtsCell — Phase 102 MC-01 hover card MCDistributionBar', () => {
  it('renders MCDistributionBar when blankProb/haulProb/p10Pts/p90Pts present and window===1', () => {
    const { container } = render(
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
    // P10 / P90 labels rendered by MCDistributionBar
    expect(screen.getByText('3.2')).toBeTruthy()
    expect(screen.getByText('11.8')).toBeTruthy()
    // aria-label on the track
    const track = container.querySelector('[role="img"][aria-label="MC range: 3.2 to 11.8 pts"]')
    expect(track).not.toBeNull()
    // Haul% amber row (haulProb=0.41 >= 0.40)
    expect(screen.getByText(/Haul 41%/)).toBeTruthy()
    // Removed labels MUST NOT render any more
    expect(screen.queryByText('Blank%')).toBeNull()
    expect(screen.queryByText('Haul%')).toBeNull()
    expect(screen.queryByText('Floor')).toBeNull()
    expect(screen.queryByText('Ceiling')).toBeNull()
  })

  it('does not render Haul% row when haulProb < 0.40', () => {
    render(
      <XPtsCell
        value={5.5}
        ceiling={false}
        components={FULL_COMPONENTS}
        window={1}
        blankProb={0.23}
        haulProb={0.30}
        p10Pts={3.2}
        p90Pts={11.8}
      />
    )
    // Bar still renders (P10/P90 labels visible) but no Haul row
    expect(screen.getByText('3.2')).toBeTruthy()
    expect(screen.getByText('11.8')).toBeTruthy()
    expect(screen.queryByText(/Haul/)).toBeNull()
  })

  it('omits MCDistributionBar when window===3 (multi-GW window suppresses MC)', () => {
    const { container } = render(
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
    expect(container.querySelector('[role="img"]')).toBeNull()
    expect(screen.queryByText(/Haul/)).toBeNull()
  })

  it('omits MCDistributionBar when window===5', () => {
    const { container } = render(
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
    expect(container.querySelector('[role="img"]')).toBeNull()
    expect(screen.queryByText(/Haul/)).toBeNull()
  })

  it('omits MCDistributionBar when any of the 4 MC props is undefined (gate-off degradation)', () => {
    const { container } = render(
      <XPtsCell
        value={5.5}
        ceiling={false}
        components={FULL_COMPONENTS}
        window={1}
        blankProb={0.23}
        haulProb={undefined}
        p10Pts={3.2}
        p90Pts={11.8}
      />
    )
    expect(container.querySelector('[role="img"]')).toBeNull()
  })
})

// ─── Phase 76 RTP-02 — routes_to_points column ────────────────────────────────
describe('Phase 76 RTP-02 — routes_to_points column', () => {
  it('column header label is "Routes"', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find(c => (c as any).accessorKey === 'routes_to_points') as any
    expect(col).toBeTruthy()
    // Header in TanStack Table accessor columns is the value returned by H('Routes', '...');
    // H returns either a string or a render function depending on impl — render-and-assert.
    const headerVal = typeof col.header === 'function'
      ? col.header({ column: { id: 'routes_to_points' } } as any)
      : col.header
    const { container } = render(<>{headerVal}</>)
    expect(container.textContent).toContain('Routes')
  })

  it('cell renders RoutePillsCell (not integer) for a known player with routes', () => {
    // ROUTES-01: cell now shows pills via RoutePillsCell, not the raw integer.
    // Supply the player in allPlayers so routeFlagsMap contains their entry.
    const playerWithPK = {
      ...PLAYER_A,
      id: 1,
      team: 1,
      routes_to_points: 4,
      penalties_order: 1,
      direct_freekicks_order: null,
      corners_and_indirect_freekicks_order: null,
      xg_per90: null,
      xa_per90: null,
    } as unknown as ScoredPlayer
    const cols = createColumns(vi.fn(), null, false, [playerWithPK])
    const col = cols.find(c => (c as any).accessorKey === 'routes_to_points') as any
    const cellNode = col.cell({
      getValue: () => 4,
      row: { original: playerWithPK },
    })
    render(<>{cellNode}</>)
    // PK pill rendered (not the literal "4")
    expect(screen.getByTitle('Penalty taker')).toBeTruthy()
  })

  it('cell renders em-dash when routes_to_points is undefined', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find(c => (c as any).accessorKey === 'routes_to_points') as any
    const cellNode = col.cell({
      getValue: () => undefined,
      row: { original: { ...PLAYER_A } },
    })
    render(<>{cellNode}</>)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('column is hidden on mobile via MOBILE_HIDDEN_COLUMNS', () => {
    // The convention is `key: false` ⇒ hidden on mobile. Check the literal mapping.
    expect(MOBILE_HIDDEN_COLUMNS.routes_to_points).toBe(false)
  })
})

describe('ROUTES-01 — Routes cell renders RoutePillsCell pills', () => {
  it('renders PK pill when player has penalties_order === 1', () => {
    const penTaker = {
      id: 42,
      team: 1,
      penalties_order: 1,
      direct_freekicks_order: null,
      corners_and_indirect_freekicks_order: null,
      xg_per90: null,
      xa_per90: null,
    } as unknown as ScoredPlayer

    const cols = createColumns(() => {}, null, false, [penTaker])
    // Routes column is the one whose accessorKey is 'routes_to_points'
    const routesCol = cols.find(
      (c: any) => c.accessorKey === 'routes_to_points'
    ) as { cell: (ctx: any) => React.ReactNode } | undefined

    expect(routesCol).toBeTruthy()
    const node = routesCol!.cell({
      getValue: () => 1,
      row: { original: penTaker },
    })
    render(<>{node}</>)
    expect(screen.getByTitle('Penalty taker')).toBeTruthy()
  })
})

describe('BPS-01: Bonus EV column', () => {
  it('bonus_ev column renders value to 2 decimal places', () => {
    const player = {
      ...PLAYER_A,
      bonus_ev: 0.85,
      bonus_source: 'learned' as const,
    }
    const cols = createColumns(() => {})
    const bonusCol = cols.find((c: { id?: string; accessorKey?: string }) =>
      (c as { accessorKey?: string }).accessorKey === 'bonus_ev'
    ) as unknown as {
      cell: (info: {
        getValue: () => number | null
        row: { original: typeof player }
      }) => React.ReactElement
    }
    expect(bonusCol).toBeTruthy()
    const { container } = render(
      <>{bonusCol.cell({ getValue: () => 0.85, row: { original: player } })}</>
    )
    expect(container.textContent).toBe('0.85')
  })

  it('column is hidden on mobile via MOBILE_HIDDEN_COLUMNS', () => {
    expect(MOBILE_HIDDEN_COLUMNS.bonus_ev).toBe(false)
  })
})

describe('FLOOR-01: Cons% column', () => {
  it('cons_rate=0.75 renders "75%" with text-emerald-400', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'cons_rate') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ getValue: () => 0.75, row: { original: { ...PLAYER_A, cons_rate: 0.75 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('75%')
    expect(span?.className).toContain('text-emerald-400')
  })

  it('cons_rate=0.50 renders "50%" with text-zinc-100', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'cons_rate') as any
    const { container } = render(
      <>{col.cell({ getValue: () => 0.50, row: { original: { ...PLAYER_A, cons_rate: 0.50 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('50%')
    expect(span?.className).toContain('text-zinc-100')
  })

  it('cons_rate=0.30 renders "30%" with text-zinc-500', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'cons_rate') as any
    const { container } = render(
      <>{col.cell({ getValue: () => 0.30, row: { original: { ...PLAYER_A, cons_rate: 0.30 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('30%')
    expect(span?.className).toContain('text-zinc-500')
  })

  it('cons_rate=null renders em-dash', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'cons_rate') as any
    const { container } = render(
      <>{col.cell({ getValue: () => null, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toContain('—')
  })

  it('cons_rate and p10_pts columns hidden on mobile via MOBILE_HIDDEN_COLUMNS', () => {
    expect(MOBILE_HIDDEN_COLUMNS.cons_rate).toBe(false)
    expect(MOBILE_HIDDEN_COLUMNS.p10_pts).toBe(false)
  })
})

describe('FLOOR-01: Floor column (p10_pts)', () => {
  it('p10_pts=4.8 renders "4.8"', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'p10_pts') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ getValue: () => 4.8, row: { original: { ...PLAYER_A, p10_pts: 4.8 } } })}</>
    )
    expect(container.textContent).toBe('4.8')
  })

  it('p10_pts=null renders em-dash', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'p10_pts') as any
    const { container } = render(
      <>{col.cell({ getValue: () => null, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toContain('—')
  })
})

describe('STREAK-01: Streak column', () => {
  it('streak=5 renders "5" with text-emerald-400', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'streak') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ getValue: () => 5, row: { original: { ...PLAYER_A, streak: 5 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('5')
    expect(span?.className).toContain('text-emerald-400')
  })

  it('streak=1 renders "1" with text-zinc-100', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'streak') as any
    const { container } = render(
      <>{col.cell({ getValue: () => 1, row: { original: { ...PLAYER_A, streak: 1 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('1')
    expect(span?.className).toContain('text-zinc-100')
  })

  it('streak=0 renders "0" with text-zinc-500', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'streak') as any
    const { container } = render(
      <>{col.cell({ getValue: () => 0, row: { original: { ...PLAYER_A, streak: 0 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('0')
    expect(span?.className).toContain('text-zinc-500')
  })

  it('streak=null renders em-dash', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'streak') as any
    const { container } = render(
      <>{col.cell({ getValue: () => null, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toContain('—')
  })
})

describe('STREAK-01: ΔForm column', () => {
  it('form_delta=2.5 renders "+2.5" with text-emerald-400', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'form_delta') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ getValue: () => 2.5, row: { original: { ...PLAYER_A, form_delta: 2.5 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('+2.5')
    expect(span?.className).toContain('text-emerald-400')
  })

  it('form_delta=-1.8 renders "-1.8" with text-red-400', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'form_delta') as any
    const { container } = render(
      <>{col.cell({ getValue: () => -1.8, row: { original: { ...PLAYER_A, form_delta: -1.8 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('-1.8')
    expect(span?.className).toContain('text-red-400')
  })

  it('form_delta=0.2 renders "+0.2" with text-zinc-100', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'form_delta') as any
    const { container } = render(
      <>{col.cell({ getValue: () => 0.2, row: { original: { ...PLAYER_A, form_delta: 0.2 } } })}</>
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('+0.2')
    expect(span?.className).toContain('text-zinc-100')
  })

  it('form_delta=null renders em-dash', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'form_delta') as any
    const { container } = render(
      <>{col.cell({ getValue: () => null, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toContain('—')
  })
})

describe('MIN-01: badge column uses sub_risk_label', () => {
  it('mins_risk column renders "Sub risk" badge when sub_risk_label is sub_risk', () => {
    const player = {
      ...PLAYER_A,
      sub_risk_label: 'sub_risk' as const,
    }
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.id === 'mins_risk') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ row: { original: player } })}</>
    )
    expect(container.textContent).toContain('Sub risk')
  })
})

describe('MIN-01: Start% column', () => {
  it('start_prob=0.87 renders "87%"', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'start_prob') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ getValue: () => 0.87, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toBe('87%')
  })

  it('start_prob=0 renders "0%" (not em-dash)', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'start_prob') as any
    const { container } = render(
      <>{col.cell({ getValue: () => 0, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toBe('0%')
  })

  it('start_prob=null renders "—"', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'start_prob') as any
    const { container } = render(
      <>{col.cell({ getValue: () => null, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toContain('—')
  })

  it('start_prob and mins_60_prob hidden on mobile via MOBILE_HIDDEN_COLUMNS', () => {
    expect(MOBILE_HIDDEN_COLUMNS.start_prob).toBe(false)
    expect(MOBILE_HIDDEN_COLUMNS.mins_60_prob).toBe(false)
  })
})

describe('MIN-01: 60+% column', () => {
  it('mins_60_prob=0.72 renders "72%"', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'mins_60_prob') as any
    expect(col).toBeTruthy()
    const { container } = render(
      <>{col.cell({ getValue: () => 0.72, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toBe('72%')
  })

  it('mins_60_prob=null renders "—"', () => {
    const cols = createColumns(vi.fn())
    const col = cols.find((c: any) => c.accessorKey === 'mins_60_prob') as any
    const { container } = render(
      <>{col.cell({ getValue: () => null, row: { original: { ...PLAYER_A } } })}</>
    )
    expect(container.textContent).toContain('—')
  })
})
