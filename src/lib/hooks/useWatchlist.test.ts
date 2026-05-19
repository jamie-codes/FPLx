// @vitest-environment jsdom
// Phase 127 WATCH-01: Contract tests for useWatchlist hook.
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'

beforeEach(() => {
  localStorage.clear()
})

describe('useWatchlist', () => {
  it('initialises empty when localStorage has no key', () => {
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.watchlistIds).toEqual([])
  })

  it('initialises from existing array in localStorage', () => {
    localStorage.setItem('fplx_watchlist', JSON.stringify([1, 2, 3]))
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.watchlistIds).toEqual([1, 2, 3])
  })

  it('returns empty array on malformed JSON in localStorage', () => {
    localStorage.setItem('fplx_watchlist', 'not-valid-json')
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.watchlistIds).toEqual([])
  })

  it('returns empty array when localStorage has a non-array JSON value', () => {
    localStorage.setItem('fplx_watchlist', '"not an array"')
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.watchlistIds).toEqual([])
  })

  it('filters non-number entries from localStorage', () => {
    localStorage.setItem('fplx_watchlist', JSON.stringify([1, 'two', null, 3, true]))
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.watchlistIds).toEqual([1, 3])
  })

  it('toggle adds id when absent', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.toggleWatchlist(42))
    expect(result.current.watchlistIds).toContain(42)
  })

  it('toggle removes id when present', () => {
    localStorage.setItem('fplx_watchlist', JSON.stringify([42]))
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.toggleWatchlist(42))
    expect(result.current.watchlistIds).not.toContain(42)
  })

  it('toggle persists updated array to localStorage', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.toggleWatchlist(99))
    const stored = JSON.parse(localStorage.getItem('fplx_watchlist') ?? '[]')
    expect(stored).toContain(99)
  })
})
