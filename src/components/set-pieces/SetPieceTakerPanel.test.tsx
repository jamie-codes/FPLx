// @vitest-environment jsdom
// Phase 81 (SHD-01): SetPieceTakerPanel integration tests — ghost watermark crest per team card.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock hooks BEFORE importing the component (Vitest hoisting requirement)
const mockUseSetPieces = vi.fn()
vi.mock('@/lib/hooks/useSetPieces', () => ({
  useSetPieces: () => mockUseSetPieces(),
}))
const mockUsePlayers = vi.fn()
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => mockUsePlayers(),
}))

import { SetPieceTakerPanel } from './SetPieceTakerPanel'

const arsTeam = {
  team_id: 1,
  team_short_name: 'ARS',
  penalty_taker: { name: 'Saka', changed: false },
  fk_taker: { name: 'Odegaard', changed: false },
  corner_taker: { name: 'Saka', changed: false },
}

beforeEach(() => {
  mockUseSetPieces.mockReset()
  mockUsePlayers.mockReturnValue({ data: [], isLoading: false, error: null })
})

describe('SetPieceTakerPanel — SHD-01 ghost watermark', () => {
  it('SHD-01: card has relative and overflow-hidden classes', () => {
    mockUseSetPieces.mockReturnValue({
      data: { teams: [arsTeam], change_count: 0 },
      isLoading: false,
      error: null,
    })
    const { container } = render(<SetPieceTakerPanel />)
    const card = container.querySelector('.grid > div')!
    expect(card).not.toBeNull()
    expect(card.className).toMatch(/relative/)
    expect(card.className).toMatch(/overflow-hidden/)
  })

  it('SHD-01: ghost <img> renders with aria-hidden, opacity-10, pointer-events-none, absolute, alt=""', () => {
    mockUseSetPieces.mockReturnValue({
      data: { teams: [arsTeam], change_count: 0 },
      isLoading: false,
      error: null,
    })
    const { container } = render(<SetPieceTakerPanel />)
    const card = container.querySelector('.grid > div')!
    const ghost = card.querySelector('img[aria-hidden="true"]')
    expect(ghost).not.toBeNull()
    expect(ghost!.getAttribute('alt')).toBe('')
    expect(ghost!.className).toMatch(/opacity-10/)
    expect(ghost!.className).toMatch(/pointer-events-none/)
    expect(ghost!.className).toMatch(/absolute/)
    expect(ghost!.className).toMatch(/bottom-0/)
    expect(ghost!.className).toMatch(/right-0/)
    expect(ghost!.className).toMatch(/w-14/)
    expect(ghost!.className).toMatch(/h-14/)
  })

  it('SHD-01: unknown team renders NO ghost element (showFallback suppresses ghost)', () => {
    const unknownTeam = { ...arsTeam, team_short_name: 'XYZ' }
    mockUseSetPieces.mockReturnValue({
      data: { teams: [unknownTeam], change_count: 0 },
      isLoading: false,
      error: null,
    })
    const { container } = render(<SetPieceTakerPanel />)
    const card = container.querySelector('.grid > div')!
    expect(card.querySelector('img')).toBeNull()
    // Also verify no fallback swatch is rendered at the ghost position
    expect(card.querySelector('.rounded-full')).toBeNull()
  })
})
