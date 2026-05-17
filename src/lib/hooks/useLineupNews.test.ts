// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lineupNewsSelect } from './useLineupNews'
import type { LineupNews, LineupNewsPlayer, SourceHealth } from '../types'

// Factory helpers
function makeSourceHealth(): SourceHealth {
  return { ok: true, last_success: null, last_error: null }
}

function makeLineupNewsPlayer(id: number, overrides: Partial<LineupNewsPlayer> = {}): LineupNewsPlayer {
  return {
    id,
    availability_factor: 1.0,
    status_label: 'confirmed_start',
    news_headline: null,
    news_source: null,
    scraped_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeLineupNews(scrapedAt: string, players: LineupNewsPlayer[]): LineupNews {
  return {
    scraped_at: scrapedAt,
    players,
    source_health: {
      fpl: makeSourceHealth(),
      premierleague: makeSourceHealth(),
      skysports: makeSourceHealth(),
      bbc: makeSourceHealth(),
    },
  }
}

describe('lineupNewsSelect — 48h staleness select transform', () => {
  it('returns a Map with one entry per player when scraped_at is now (fresh)', () => {
    const player1 = makeLineupNewsPlayer(10)
    const player2 = makeLineupNewsPlayer(20)
    const data = makeLineupNews(new Date().toISOString(), [player1, player2])

    const result = lineupNewsSelect(data)

    expect(result).toBeInstanceOf(Map)
    expect(result?.size).toBe(2)
    expect(result?.has(10)).toBe(true)
    expect(result?.has(20)).toBe(true)
  })

  it('returns undefined when scraped_at is older than 48h (e.g. 49h ago)', () => {
    const staleTime = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString()
    const player1 = makeLineupNewsPlayer(10)
    const data = makeLineupNews(staleTime, [player1])

    const result = lineupNewsSelect(data)

    expect(result).toBeUndefined()
  })

  it('returns a Map when scraped_at is exactly 48h ago (strict-greater-than boundary)', () => {
    // Exactly 48h ago — age is NOT > 48h, so select returns a Map
    const boundaryTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const player1 = makeLineupNewsPlayer(10)
    const data = makeLineupNews(boundaryTime, [player1])

    const result = lineupNewsSelect(data)

    expect(result).toBeInstanceOf(Map)
    expect(result?.size).toBe(1)
  })

  it('returned Map keys equal player.id values and values are the original LineupNewsPlayer objects', () => {
    const player1 = makeLineupNewsPlayer(42, { status_label: 'doubted', availability_factor: 0.5 })
    const player2 = makeLineupNewsPlayer(99, { status_label: 'confirmed_absent', availability_factor: 0.0 })
    const data = makeLineupNews(new Date().toISOString(), [player1, player2])

    const result = lineupNewsSelect(data)

    expect(result).toBeInstanceOf(Map)
    expect(result?.get(42)).toBe(player1)   // reference identity
    expect(result?.get(99)).toBe(player2)   // reference identity
    expect(result?.get(0)).toBeUndefined()  // non-existent key
  })
})
