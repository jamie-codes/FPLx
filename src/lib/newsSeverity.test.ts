// Phase 88 SCRAPER-01: computeNewsSeverity — pure utility unit tests
import { describe, it, expect } from 'vitest'
import { computeNewsSeverity } from './newsSeverity'

describe('computeNewsSeverity — Phase 88 SCRAPER-01', () => {
  it('returns none when chance is null and news is empty string', () => {
    expect(computeNewsSeverity(null, '')).toBe('none')
  })

  it('returns none when chance is null and news is undefined', () => {
    expect(computeNewsSeverity(null, undefined)).toBe('none')
  })

  it('returns none when chance === 100 and news is empty string', () => {
    expect(computeNewsSeverity(100, '')).toBe('none')
  })

  it('returns none when chance === 100 and news is whitespace-only string', () => {
    expect(computeNewsSeverity(100, '   ')).toBe('none')
  })

  it('returns zinc when chance === 100 and news is non-empty', () => {
    expect(computeNewsSeverity(100, 'Returned from international duty')).toBe('zinc')
  })

  it('returns zinc when chance === null and news is non-empty', () => {
    expect(computeNewsSeverity(null, 'Knock')).toBe('zinc')
  })

  it('returns zinc when chance is undefined and news is non-empty', () => {
    expect(computeNewsSeverity(undefined, 'Knock')).toBe('zinc')
  })

  it('returns amber when chance === 75 with non-empty news', () => {
    expect(computeNewsSeverity(75, 'Knock - 75% chance')).toBe('amber')
  })

  it('returns amber when chance === 75 with empty news', () => {
    expect(computeNewsSeverity(75, '')).toBe('amber')
  })

  it('returns red when chance === 50', () => {
    expect(computeNewsSeverity(50, 'Hamstring')).toBe('red')
  })

  it('returns red when chance === 25', () => {
    expect(computeNewsSeverity(25, 'Calf')).toBe('red')
  })

  it('returns red when chance === 0', () => {
    expect(computeNewsSeverity(0, 'Out indefinitely')).toBe('red')
  })
})
