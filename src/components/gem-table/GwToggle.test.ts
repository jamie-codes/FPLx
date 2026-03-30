import { describe, it, expect } from 'vitest'
import { getColumnVisibility } from '@/components/gem-table/GwToggle'

describe('getColumnVisibility', () => {
  it('returns proj_pts_1gw: true for horizon 1', () => {
    expect(getColumnVisibility(1)).toEqual({
      proj_pts_1gw: true,
      proj_pts_3gw: false,
      proj_pts_5gw: false,
    })
  })

  it('returns proj_pts_3gw: true for horizon 3', () => {
    expect(getColumnVisibility(3)).toEqual({
      proj_pts_1gw: false,
      proj_pts_3gw: true,
      proj_pts_5gw: false,
    })
  })

  it('returns proj_pts_5gw: true for horizon 5', () => {
    expect(getColumnVisibility(5)).toEqual({
      proj_pts_1gw: false,
      proj_pts_3gw: false,
      proj_pts_5gw: true,
    })
  })
})
