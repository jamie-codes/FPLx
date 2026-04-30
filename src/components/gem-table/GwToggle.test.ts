import { describe, it, expect } from 'vitest'
import { getColumnVisibility, MOBILE_HIDDEN_COLUMNS } from '@/components/gem-table/GwToggle'

describe('getColumnVisibility', () => {
  it('returns xPts_1gw: true for horizon 1', () => {
    expect(getColumnVisibility(1)).toEqual(expect.objectContaining({
      xPts_1gw: true,
      xPts_3gw: false,
      xPts_5gw: false,
    }))
    // Key-swap guard (WR-04): old proj_pts keys must not be present in gwVisibility
    expect(getColumnVisibility(1)).not.toHaveProperty('proj_pts_1gw')
    expect(getColumnVisibility(1)).not.toHaveProperty('proj_pts_3gw')
    expect(getColumnVisibility(1)).not.toHaveProperty('proj_pts_5gw')
  })

  it('returns xPts_3gw: true for horizon 3', () => {
    expect(getColumnVisibility(3)).toEqual(expect.objectContaining({
      xPts_1gw: false,
      xPts_3gw: true,
      xPts_5gw: false,
    }))
    // Key-swap guard (WR-04): old proj_pts keys must not be present in gwVisibility
    expect(getColumnVisibility(3)).not.toHaveProperty('proj_pts_1gw')
    expect(getColumnVisibility(3)).not.toHaveProperty('proj_pts_3gw')
    expect(getColumnVisibility(3)).not.toHaveProperty('proj_pts_5gw')
  })

  it('returns xPts_5gw: true for horizon 5', () => {
    expect(getColumnVisibility(5)).toEqual(expect.objectContaining({
      xPts_1gw: false,
      xPts_3gw: false,
      xPts_5gw: true,
    }))
    // Key-swap guard (WR-04): old proj_pts keys must not be present in gwVisibility
    expect(getColumnVisibility(5)).not.toHaveProperty('proj_pts_1gw')
    expect(getColumnVisibility(5)).not.toHaveProperty('proj_pts_3gw')
    expect(getColumnVisibility(5)).not.toHaveProperty('proj_pts_5gw')
  })
})

describe('getColumnVisibility mobile', () => {
  it('hides non-priority columns when isMobile is true', () => {
    // isMobile = true hides 15 non-priority columns
    const isMobile = true
    const result = getColumnVisibility(1, isMobile)
    expect(result.team_short_name).toBe(false)
    expect(result.now_cost).toBe(false)
    expect(result.fdr_score).toBe(false)
    expect(result.form_score).toBe(false)
    expect(result.xg_per90).toBe(false)
    expect(result.xa_per90).toBe(false)
    expect(result.xg_score).toBe(false)
    expect(result.xa_score).toBe(false)
    expect(result.ownership_score).toBe(false)
    expect(result.minutes_score).toBe(false)
    expect(result.set_piece_score).toBe(false)
    expect(result.selected_by_percent).toBe(false)
    expect(result.status).toBe(false)
    expect(result.trend).toBe(false)
    expect(result.fixtures).toBe(false)
  })

  it('keeps active xPts column visible on mobile — isMobile overridden by gwVisibility spread', () => {
    // isMobile = true but active xPts must remain visible via gwVisibility spread order
    const isMobile = true
    const result1 = getColumnVisibility(1, isMobile)
    expect(result1.xPts_1gw).toBe(true)
    expect(result1.xPts_3gw).toBe(false)

    const result3 = getColumnVisibility(3, isMobile)
    expect(result3.xPts_3gw).toBe(true)
    expect(result3.xPts_1gw).toBe(false)
    expect(result3.xPts_5gw).toBe(false)

    const result5 = getColumnVisibility(5, isMobile)
    expect(result5.xPts_5gw).toBe(true)
    expect(result5.xPts_1gw).toBe(false)
  })

  it('does not hide priority columns on mobile — isMobile does not affect web_name/gem_score/element_type/mins_risk', () => {
    // isMobile only hides MOBILE_HIDDEN_COLUMNS; priority columns are not in that map
    const isMobile = true
    const result = getColumnVisibility(1, isMobile)
    expect(result.web_name).toBeUndefined()
    expect(result.gem_score).toBeUndefined()
    expect(result.element_type).toBeUndefined()
    expect(result.mins_risk).toBeUndefined()
  })
})

describe('getColumnVisibility presets', () => {
  it('compact preset hides all non-priority columns for horizon 1', () => {
    const result = getColumnVisibility(1, false, 'compact')
    // Active xPts column visible (gwVisibility wins)
    expect(result.xPts_1gw).toBe(true)
    expect(result.xPts_3gw).toBe(false)
    expect(result.xPts_5gw).toBe(false)
    // Compact hides these columns
    expect(result.team_short_name).toBe(false)
    expect(result.now_cost).toBe(false)
    expect(result.regression_signal).toBe(false)
    expect(result.differential_flag).toBe(false)
    expect(result.trend).toBe(false)
    expect(result.fixtures).toBe(false)
    expect(result.selected_by_percent).toBe(false)
    expect(result.status).toBe(false)
    // Priority columns not in map — TanStack treats undefined as visible
    expect(result.web_name).toBeUndefined()
    expect(result.element_type).toBeUndefined()
    expect(result.gem_score).toBeUndefined()
    expect(result.mins_risk).toBeUndefined()
  })

  it('compact preset for horizon 3 — xPts_3gw wins over any preset entry', () => {
    const result = getColumnVisibility(3, false, 'compact')
    expect(result.xPts_3gw).toBe(true)
    expect(result.xPts_1gw).toBe(false)
    expect(result.xPts_5gw).toBe(false)
  })

  it('default preset hides 9 sub-score columns', () => {
    const result = getColumnVisibility(1, false, 'default')
    expect(result.fdr_score).toBe(false)
    expect(result.form_score).toBe(false)
    expect(result.xg_per90).toBe(false)
    expect(result.xa_per90).toBe(false)
    expect(result.xg_score).toBe(false)
    expect(result.xa_score).toBe(false)
    expect(result.ownership_score).toBe(false)
    expect(result.minutes_score).toBe(false)
    expect(result.set_piece_score).toBe(false)
    // Active xPts column visible (gwVisibility wins)
    expect(result.xPts_1gw).toBe(true)
  })

  it('analysis preset hides 7 sub-score columns but keeps xg_per90 and xa_per90 visible', () => {
    const result = getColumnVisibility(1, false, 'analysis')
    expect(result.fdr_score).toBe(false)
    expect(result.form_score).toBe(false)
    expect(result.xg_score).toBe(false)
    expect(result.xa_score).toBe(false)
    expect(result.ownership_score).toBe(false)
    expect(result.minutes_score).toBe(false)
    expect(result.set_piece_score).toBe(false)
    // xg_per90 and xa_per90 are NOT in analysis map — visible by default (undefined)
    expect(result.xg_per90).toBeUndefined()
    expect(result.xa_per90).toBeUndefined()
  })

  it('preset is ignored on mobile — MOBILE_HIDDEN_COLUMNS path taken regardless of preset', () => {
    const result = getColumnVisibility(1, true, 'compact')
    // MOBILE_HIDDEN_COLUMNS path: these should be false
    expect(result.team_short_name).toBe(false)
    expect(result.now_cost).toBe(false)
    expect(result.status).toBe(false)
    expect(result.regression_signal).toBe(false)
    // Active xPts column visible via gwVisibility spread
    expect(result.xPts_1gw).toBe(true)
  })

  it('no third arg defaults to default preset — existing call shape unchanged', () => {
    const result = getColumnVisibility(1)
    expect(result).toEqual(expect.objectContaining({
      xPts_1gw: true,
      xPts_3gw: false,
      xPts_5gw: false,
    }))
    expect(result).not.toHaveProperty('proj_pts_1gw')
    expect(result).not.toHaveProperty('proj_pts_3gw')
    expect(result).not.toHaveProperty('proj_pts_5gw')
  })
})

describe('Phase 41 ACC-05: last_gw_actual_pts column visibility', () => {
  it('hides last_gw_actual_pts in compact preset', () => {
    const v = getColumnVisibility(1, false, 'compact')
    expect(v.last_gw_actual_pts).toBe(false)
  })

  it('does NOT set last_gw_actual_pts in default preset (absent = visible)', () => {
    const v = getColumnVisibility(1, false, 'default')
    expect(v.last_gw_actual_pts).toBeUndefined()
  })

  it('does NOT set last_gw_actual_pts in analysis preset (absent = visible)', () => {
    const v = getColumnVisibility(1, false, 'analysis')
    expect(v.last_gw_actual_pts).toBeUndefined()
  })

  it('does NOT gate last_gw_actual_pts by GW horizon (still absent on horizon=3)', () => {
    const v = getColumnVisibility(3, false, 'default')
    expect(v.last_gw_actual_pts).toBeUndefined()
  })

  it('mobile path is unchanged — last_gw_actual_pts not in MOBILE_HIDDEN_COLUMNS', () => {
    const v = getColumnVisibility(1, true, 'default')
    expect(v.last_gw_actual_pts).toBeUndefined()
  })
})
