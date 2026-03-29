import { describe, it, expect } from 'vitest'
import { isCheapGem, isLowOwned } from '@/lib/value-gems'

describe('isCheapGem', () => {
  it('returns true at exactly 6.0m (now_cost=60)', () => {
    expect(isCheapGem({ now_cost: 60 })).toBe(true)
  })
  it('returns false just above 6.0m (now_cost=61)', () => {
    expect(isCheapGem({ now_cost: 61 })).toBe(false)
  })
  it('returns true below threshold (now_cost=45)', () => {
    expect(isCheapGem({ now_cost: 45 })).toBe(true)
  })
  it('returns false for premium player (now_cost=120)', () => {
    expect(isCheapGem({ now_cost: 120 })).toBe(false)
  })
})

describe('isLowOwned', () => {
  it('returns false at exactly 10% (not strictly less than)', () => {
    expect(isLowOwned({ selected_by_percent: '10.0' })).toBe(false)
  })
  it('returns true just below 10% (9.9)', () => {
    expect(isLowOwned({ selected_by_percent: '9.9' })).toBe(true)
  })
  it('returns true for very low ownership (0.1)', () => {
    expect(isLowOwned({ selected_by_percent: '0.1' })).toBe(true)
  })
  it('returns false for high ownership (25.3)', () => {
    expect(isLowOwned({ selected_by_percent: '25.3' })).toBe(false)
  })
})
