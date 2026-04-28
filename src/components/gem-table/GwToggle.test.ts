import { describe, it, expect } from 'vitest'
import { getColumnVisibility, MOBILE_HIDDEN_COLUMNS } from '@/components/gem-table/GwToggle'

describe('getColumnVisibility', () => {
  it('returns xPts_1gw: true for horizon 1', () => {
    expect(getColumnVisibility(1)).toEqual({
      xPts_1gw: true,
      xPts_3gw: false,
      xPts_5gw: false,
    })
  })

  it('returns xPts_3gw: true for horizon 3', () => {
    expect(getColumnVisibility(3)).toEqual({
      xPts_1gw: false,
      xPts_3gw: true,
      xPts_5gw: false,
    })
  })

  it('returns xPts_5gw: true for horizon 5', () => {
    expect(getColumnVisibility(5)).toEqual({
      xPts_1gw: false,
      xPts_3gw: false,
      xPts_5gw: true,
    })
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
