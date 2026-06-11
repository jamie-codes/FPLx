// @vitest-environment jsdom
// Off-season test in a separate file because vi.mock is module-level.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: [], isLoading: false, error: null }),
}))
vi.mock('@/lib/hooks/useAccuracy', () => ({
  useAccuracy: () => ({ data: { summary: {} } }),
}))

// Import AFTER mocks
import { WeeklyPicksTab } from './WeeklyPicksTab'

describe('WeeklyPicksTab off-season — PICK-01', () => {
  it('shows empty state when all xPts are zero/undefined', () => {
    render(<WeeklyPicksTab />)
    expect(screen.getByText(/picks return when the season starts/i)).toBeTruthy()
  })
})
