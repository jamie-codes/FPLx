// @vitest-environment jsdom
// Phase 81 (SHD-03): useTeamBadge hook unit tests.
// Pure useState hook — no fetch, no QueryClient wrapper required.
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTeamBadge } from './useTeamBadge'

describe('useTeamBadge', () => {
  it('returns valid src for known shortName (ARS → t3.png)', () => {
    const { result } = renderHook(() => useTeamBadge('ARS'))
    expect(result.current.src).toBe('https://resources.premierleague.com/premierleague/badges/t3.png')
    expect(result.current.showFallback).toBe(false)
    expect(result.current.fallbackColour).toBe('#EF0107')
    expect(result.current.initial).toBe('A')
  })

  it('returns null src and showFallback=true for unknown shortName', () => {
    const { result } = renderHook(() => useTeamBadge('XYZ'))
    expect(result.current.src).toBeNull()
    expect(result.current.showFallback).toBe(true)
    expect(result.current.fallbackColour).toBe('#71717A')
    expect(result.current.initial).toBe('X')
  })

  it('onError flips showFallback from false to true', () => {
    const { result } = renderHook(() => useTeamBadge('ARS'))
    expect(result.current.showFallback).toBe(false)
    act(() => { result.current.onError() })
    expect(result.current.showFallback).toBe(true)
  })

  it('initial is the first character of shortName', () => {
    const { result } = renderHook(() => useTeamBadge('LIV'))
    expect(result.current.initial).toBe('L')
  })

  it('fallbackColour comes from getTeamColour primary', () => {
    const { result } = renderHook(() => useTeamBadge('MCI'))
    expect(result.current.fallbackColour).toBe('#6CABDD')
  })
})
