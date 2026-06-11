// PICK-01: pure selection/ranking helpers for the Weekly Picks tab.
// Ranking is by mean xPts — exp04 (2026-06) showed nothing beats it.
import type { MergedPlayer, FixtureEntry } from './types'

export type PicksHorizon = '1gw' | '3gw'

export function xptsFor(p: MergedPlayer, horizon: PicksHorizon): number {
  return (horizon === '1gw' ? p.xPts_1gw : p.xPts_3gw) ?? 0
}

/** Top-n by xPts for the horizon. status 'u' (left the league) excluded;
 * doubtful/injured stay listed (xmins already discounts them) with a ⚠ in the UI. */
export function rankPicks(players: MergedPlayer[], horizon: PicksHorizon, n = 10): MergedPlayer[] {
  return players
    .filter((p) => p.status !== 'u')
    .sort((a, b) => xptsFor(b, horizon) - xptsFor(a, horizon))
    .slice(0, n)
}

/** Highest-xPts players under the ownership threshold ("under the radar"). */
export function underTheRadar(players: MergedPlayer[], maxOwnership = 10, n = 5): MergedPlayer[] {
  return players
    .filter((p) => p.status !== 'u' && Number(p.selected_by_percent) < maxOwnership)
    .sort((a, b) => xptsFor(b, '1gw') - xptsFor(a, '1gw'))
    .slice(0, n)
}

/** Off-season pipeline output has no positive xPts — show an empty state, not zeros. */
export function isOffSeason(players: MergedPlayer[]): boolean {
  return players.every((p) => (p.xPts_1gw ?? 0) <= 0)
}

/** First n DISTINCT gameweeks' fixtures (a DGW keeps both entries).
 * FixtureBadges renders everything it is given — callers slice with this. */
export function nextEventsFixtures(fixtures: FixtureEntry[], nEvents: number): FixtureEntry[] {
  const eventIds = [...new Set(fixtures.map((f) => f.event_id))]
    .sort((a, b) => a - b)
    .slice(0, nEvents)
  return fixtures.filter((f) => eventIds.includes(f.event_id))
}

/** 0.194 -> "~1 in 5" */
export function haulCaptureLabel(v: number | null | undefined): string {
  if (!v || v <= 0) return '—'
  return `~1 in ${Math.round(1 / v)}`
}
