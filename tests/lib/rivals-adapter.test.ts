// Season-start regression: the 2026/27 FPL API dropped the `id` field from
// leagues-classic standings entries. The schema must accept the live shape —
// requiring unconsumed fields made every rivals load fail with
// "Failed to load rivals" (parse error, not a fetch error).
import { describe, it, expect } from 'vitest'
import { parseLeagueStandings, parseRivalHistory } from '@/lib/rivals-adapter'

// Verbatim field set observed on the live endpoint 2026-08-23 (league 314).
const liveEntry = {
  club_badge_src: null,
  entry: 6726304,
  entry_name: 'Test Team',
  event_total: 107,
  last_rank: 0,
  player_name: 'Test Manager',
  rank: 1,
  rank_sort: 1,
  total: 107,
}

describe('parseLeagueStandings', () => {
  it('accepts 2026/27 standings entries (no `id` field)', () => {
    const parsed = parseLeagueStandings({
      standings: { results: [liveEntry], has_next: false, page: 1 },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.standings.results[0].entry).toBe(6726304)
      expect(parsed.data.standings.results[0].rank).toBe(1)
    }
  })

  it('still accepts legacy entries that carry extra fields like `id`', () => {
    const parsed = parseLeagueStandings({
      standings: { results: [{ ...liveEntry, id: 12345 }] },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects entries missing consumed fields', () => {
    const { entry: _omit, ...noEntry } = liveEntry
    const parsed = parseLeagueStandings({
      standings: { results: [noEntry] },
    })
    expect(parsed.success).toBe(false)
  })
})

describe('parseRivalHistory', () => {
  it('accepts chip entries with only `name` — unconsumed fields must stay optional', () => {
    // Same hardening as standings `id`: only chips[].name is consumed, so a
    // future rename of time/event must not fail the whole parse.
    const parsed = parseRivalHistory({ chips: [{ name: 'wildcard' }] })
    expect(parsed.success).toBe(true)
  })
})
