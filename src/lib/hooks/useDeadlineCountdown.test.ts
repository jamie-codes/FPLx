// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the underlying query hook so no QueryClient/provider is needed.
const useNextDeadlineMock = vi.fn()
vi.mock('./useNextDeadline', () => ({ useNextDeadline: () => useNextDeadlineMock() }))

import { useDeadlineCountdown } from './useDeadlineCountdown'

describe('useDeadlineCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    useNextDeadlineMock.mockReset()
  })

  it('returns null when there is no deadline data', () => {
    useNextDeadlineMock.mockReturnValue({ data: null })
    const { result } = renderHook(() => useDeadlineCountdown())
    expect(result.current).toBeNull()
  })

  it('returns id and ms-remaining for a future deadline', () => {
    useNextDeadlineMock.mockReturnValue({
      data: { id: 3, deadline_time: '2026-08-01T01:00:00Z' }, // +1h
    })
    const { result } = renderHook(() => useDeadlineCountdown())
    expect(result.current).toEqual({ id: 3, ms: 60 * 60 * 1000 })
  })

  it('decreases ms on each 1s tick', () => {
    useNextDeadlineMock.mockReturnValue({
      data: { id: 3, deadline_time: '2026-08-01T01:00:00Z' },
    })
    const { result } = renderHook(() => useDeadlineCountdown())
    const before = result.current!.ms
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current!.ms).toBe(before - 1000)
  })

  it('returns null when deadline_time is unparseable', () => {
    useNextDeadlineMock.mockReturnValue({ data: { id: 3, deadline_time: 'not-a-date' } })
    const { result } = renderHook(() => useDeadlineCountdown())
    expect(result.current).toBeNull()
  })
})
