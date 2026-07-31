// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { pickGemTiles } from './GemWatchCard'

// Minimal ScoredPlayer stand-ins — pickGemTiles only reads id + gem_score.
const P = (id: number, gem: number) => ({ id, gem_score: gem }) as unknown as Parameters<typeof pickGemTiles>[0][number]

describe('pickGemTiles', () => {
  const scored = [P(1, 0.4), P(2, 0.9), P(3, 0.6), P(4, 0.5), P(5, 0.8), P(6, 0.2)]

  it('prefers watchlisted players, ranked by gem, capped at 4', () => {
    const t = pickGemTiles(scored, [1, 3, 6])
    expect(t.map((p) => p.id)).toEqual([3, 1, 6]) // 0.6, 0.4, 0.2
  })

  it('falls back to the top-4 gems overall when the watchlist is empty', () => {
    const t = pickGemTiles(scored, [])
    expect(t.map((p) => p.id)).toEqual([2, 5, 3, 4]) // 0.9, 0.8, 0.6, 0.5
  })

  it('never returns more than 4 tiles', () => {
    expect(pickGemTiles(scored, [1, 2, 3, 4, 5, 6]).length).toBe(4)
  })
})
