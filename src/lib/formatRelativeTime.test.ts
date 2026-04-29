// Phase 38: formatRelativeTime — pure utility unit tests
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

const NOW = new Date('2026-04-29T12:00:00Z').getTime()

const isoAtDeltaMs = (deltaMs: number) => new Date(NOW - deltaMs).toISOString()

describe('formatRelativeTime', () => {
  it("returns 'just now' when diff is 0 ms", () => {
    expect(formatRelativeTime(isoAtDeltaMs(0), NOW)).toBe('just now')
  })

  it("returns 'just now' when diff is 30 seconds", () => {
    expect(formatRelativeTime(isoAtDeltaMs(30_000), NOW)).toBe('just now')
  })

  it("returns 'just now' when diff is 59 seconds", () => {
    expect(formatRelativeTime(isoAtDeltaMs(59_000), NOW)).toBe('just now')
  })

  it("returns '1 min ago' when diff is exactly 60 seconds", () => {
    expect(formatRelativeTime(isoAtDeltaMs(60_000), NOW)).toBe('1 min ago')
  })

  it("returns '5 min ago' when diff is 5 minutes", () => {
    expect(formatRelativeTime(isoAtDeltaMs(5 * 60_000), NOW)).toBe('5 min ago')
  })

  it("returns '59 min ago' when diff is 59 minutes", () => {
    expect(formatRelativeTime(isoAtDeltaMs(59 * 60_000), NOW)).toBe('59 min ago')
  })

  it("returns '1 hour ago' when diff is exactly 60 minutes (singular)", () => {
    expect(formatRelativeTime(isoAtDeltaMs(60 * 60_000), NOW)).toBe('1 hour ago')
  })

  it("returns '3 hours ago' when diff is 3 hours (plural)", () => {
    expect(formatRelativeTime(isoAtDeltaMs(3 * 3_600_000), NOW)).toBe('3 hours ago')
  })

  it("returns '47 hours ago' when diff is 47 hours", () => {
    expect(formatRelativeTime(isoAtDeltaMs(47 * 3_600_000), NOW)).toBe('47 hours ago')
  })

  it("returns '2 days ago' when diff is exactly 48 hours (boundary)", () => {
    expect(formatRelativeTime(isoAtDeltaMs(48 * 3_600_000), NOW)).toBe('2 days ago')
  })

  it("returns '24 hours ago' at exactly 24h (hours band runs through 47h)", () => {
    expect(formatRelativeTime(isoAtDeltaMs(24 * 3_600_000), NOW)).toBe('24 hours ago')
  })

  it("returns '7 days ago' when diff is 7 days", () => {
    expect(formatRelativeTime(isoAtDeltaMs(7 * 86_400_000), NOW)).toBe('7 days ago')
  })
})

describe('formatRelativeTime (default nowMs)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("defaults nowMs to Date.now() when omitted", () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    expect(formatRelativeTime('2026-04-29T11:00:00Z')).toBe('1 hour ago')
  })
})
