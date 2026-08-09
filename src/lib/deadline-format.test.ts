import { describe, it, expect } from 'vitest'
import { formatDeadlineCountdown } from './deadline-format'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatDeadlineCountdown', () => {
  it('multi-day with seconds', () => {
    expect(formatDeadlineCountdown(21 * DAY + 23 * HOUR + 33 * MIN + 7 * SEC, true)).toBe('21d 23:33:07')
  })
  it('multi-day without seconds', () => {
    expect(formatDeadlineCountdown(21 * DAY + 23 * HOUR + 33 * MIN + 7 * SEC, false)).toBe('21d 23:33')
  })
  it('exactly 24h keeps a 1d prefix', () => {
    expect(formatDeadlineCountdown(DAY, true)).toBe('1d 00:00:00')
  })
  it('just under 24h drops the day part', () => {
    expect(formatDeadlineCountdown(23 * HOUR + 59 * MIN + 59 * SEC, true)).toBe('23:59:59')
    expect(formatDeadlineCountdown(23 * HOUR + 59 * MIN + 59 * SEC, false)).toBe('23:59')
  })
  it('zero-pads single-digit hours, minutes and seconds', () => {
    expect(formatDeadlineCountdown(2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC, true)).toBe('2d 03:04:05')
  })
  it('floors non-positive input to zeros (day part dropped)', () => {
    expect(formatDeadlineCountdown(0, true)).toBe('00:00:00')
    expect(formatDeadlineCountdown(-5000, false)).toBe('00:00')
  })
})
