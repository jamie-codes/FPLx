// WC-01: pure anchor-squad builder.
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { MergedPlayer, OptimiserHorizon, PlannerHorizon, ChipSquadPlayer } from './types'
// Used by implementation (Task 2):
import { HORIZON_FIELD, optimiseLineup } from './optimise-lineup'
import { computeGwXpts } from './gw-xpts'
import { nextGameweekId } from './blank-gameweek'
import type { SquadPick } from './squad-adapter'

// Redeclared locally — not exported from chip-modes.ts (codebase pattern).
const MIN_SLOTS: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
const MAX_SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }

/** Does this player's club play in the next gameweek?
 *
 * The next gameweek is the earliest event id anyone still has a fixture for.
 * With no fixture data at all, everyone is eligible — absence of data is not
 * evidence of a blank (WC-02). */
function hasUpcomingFixture(player: MergedPlayer, allPlayers: MergedPlayer[]): boolean {
  let earliest: number | null = null
  for (const p of allPlayers) {
    for (const f of p.fixtures ?? []) {
      if (earliest === null || f.event_id < earliest) earliest = f.event_id
    }
  }
  if (earliest === null) return true
  return (player.fixtures ?? []).some(f => f.event_id === earliest)
}

export interface CaptainCandidate {
  id: number
  web_name: string
  xPts_1gw: number
  ceiling: number  // xPts_90th_1gw ?? xPts_1gw ?? 0
}

export interface AnchorConflict {
  playerId: number
  reason: 'not_found' | 'unavailable' | 'team_cap' | 'position_cap' | 'over_budget'
}

export interface AnchoredSquadResult {
  squad: ChipSquadPlayer[]
  bestXI: number[]
  formation: string
  budgetUsed: number
  budgetRemaining: number
  xPts1gw: number
  xPts3gw: number
  xPts5gw: number
  captainCandidates: CaptainCandidate[]
  anchorConflicts: AnchorConflict[]
  /** WC-03: best-XI xPts across the selected window [startGw, +horizon-1].
   *  Equals xPts1gw/3gw/5gw when no startGw was given. */
  windowXPts: number
  /** The gameweek the squad was actually built for. */
  startGw: number | null
  /** How many bench-fodder slots were reserved (WC-03). */
  benchFodderUsed: number
  /** WC-04: window xPts across ALL 15 — what a bench boost actually scores. */
  squadXPts: number
}

export interface BuildSquadOptions {
  /** Build for THIS gameweek rather than the next one (WC-03). Scoring then
   *  sums computeGwXpts over [startGw, startGw+horizon-1], which also makes
   *  horizons of 2 and 4 exact instead of rounding to the 1/3/5 fields. */
  startGw?: number
  /** Deliberately fill this many slots with the cheapest players who still
   *  PLAY, concentrating budget in the XI (WC-03). 0 = off. */
  benchFodderCount?: number
  /** WC-04: optimise for ALL 15 rather than the best XI. On a bench boost
   *  every player scores, so leaving weak bodies on the bench — which the XI
   *  objective is happy to do — is exactly the wrong squad. Ignores
   *  benchFodderCount, which buys non-scoring bodies by design. */
  benchBoost?: boolean
  /** The gameweek the boost is actually played, when it differs from the one
   *  being built for (wildcard GW4 -> boost GW5). Every player must have a
   *  fixture then, or they score nothing on the week all 15 count. */
  benchBoostGw?: number
}

/** Minimum expected minutes for a player to count as usable bench fodder.
 * The point of fodder is a cheap body who actually appears — a zero-minute
 * filler is why an autosub never fires. */
const MIN_FODDER_XMINS = 30

export function buildAnchoredSquad(
  anchors: number[],
  players: MergedPlayer[],
  budget: number,
  // PlannerHorizon (1-5): window scoring honours all five exactly. The legacy
  // no-startGw path still has to collapse to the precomputed 1/3/5 fields.
  horizon: PlannerHorizon | OptimiserHorizon,
  options: BuildSquadOptions = {},
): AnchoredSquadResult | null {
  const legacyHorizon: OptimiserHorizon = horizon <= 1 ? 1 : horizon <= 3 ? 3 : 5
  const field = HORIZON_FIELD[legacyHorizon]
  const { startGw, benchBoost = false, benchBoostGw } = options
  // Fodder and a bench boost are contradictory: one buys bodies that will not
  // play, the other scores all 15. Boost wins.
  const benchFodderCount = benchBoost ? 0 : (options.benchFodderCount ?? 0)

  // WC-03: window scoring. With a startGw the squad is scored on
  // [startGw, startGw+horizon-1] via per-GW xPts; without one it keeps using
  // the precomputed horizon field (which always starts at the next GW).
  const windowGws = startGw !== undefined
    ? Array.from({ length: horizon }, (_, i) => startGw + i)
    : null
  const scoreOf = (p: MergedPlayer): number =>
    windowGws
      ? windowGws.reduce((sum, gw) => sum + computeGwXpts(p, gw), 0)
      : ((p[field] as number | undefined) ?? 0)
  /** The gameweek a player must have a fixture in to be selectable. */
  const eligibilityGw = startGw ?? nextGameweekId(players)
  const boostGw = benchBoost ? (benchBoostGw ?? startGw ?? null) : null
  const playsInWindow = (p: MergedPlayer): boolean => {
    const fixtures = p.fixtures ?? []
    if (eligibilityGw !== null && !fixtures.some(f => f.event_id === eligibilityGw)) return false
    // On a bench boost every one of the 15 scores, so a blank in the boost
    // week disqualifies a player even if they play the week being built for.
    if (boostGw !== null && !fixtures.some(f => f.event_id === boostGw)) return false
    return true
  }
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const anchorConflicts: AnchorConflict[] = []
  const squad: ChipSquadPlayer[] = []
  const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCount = new Map<number, number>()
  let runningCost = 0
  const seatedIds = new Set<number>()

  // Step 1: Validate and pre-seat anchor players in order.
  for (const anchorId of anchors) {
    if (seatedIds.has(anchorId)) continue  // skip duplicate anchor IDs
    const player = playerMap.get(anchorId)
    if (!player) {
      anchorConflicts.push({ playerId: anchorId, reason: 'not_found' })
      continue
    }
    if (player.status !== 'a') {
      anchorConflicts.push({ playerId: anchorId, reason: 'unavailable' })
      continue
    }
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) {
      anchorConflicts.push({ playerId: anchorId, reason: 'position_cap' })
      continue
    }
    if ((teamCount.get(player.team) ?? 0) >= 3) {
      anchorConflicts.push({ playerId: anchorId, reason: 'team_cap' })
      continue
    }
    if (runningCost + player.now_cost > budget) {
      anchorConflicts.push({ playerId: anchorId, reason: 'over_budget' })
      continue
    }
    squad.push({
      id: player.id,
      web_name: player.web_name,
      element_type: pos as 1 | 2 | 3 | 4,
      team: player.team,
      now_cost: player.now_cost,
      xPts: (player[field] as number | undefined) ?? 0,
    })
    filledSlots[pos] = (filledSlots[pos] ?? 0) + 1
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
    seatedIds.add(anchorId)
  }

  // Step 2: Greedy fill.
  //
  // WC-02 (2026-09-01): eligibility used to require `xPts_1gw !== 0` as a BGW
  // proxy. That excluded every cheap enabler — a £4.0m player with no minutes
  // yet projects exactly 0 — which are precisely the players needed to fit 15
  // into the budget. Combined with the budget-blind fill below it meant the
  // builder returned null on a normal pool, i.e. every page load. A blank
  // gameweek is a fixture question, so ask the fixtures.
  const eligible = players
    .filter(p => p.status === 'a' && !seatedIds.has(p.id) && playsInWindow(p))
    .sort((a, b) => {
      const diff = scoreOf(b) - scoreOf(a)
      // Tie-break: lower cost wins (better budget utilisation, mirrors buildOptimalSquad).
      return diff !== 0 ? diff : a.now_cost - b.now_cost
    })

  // WC-03 bench fodder: seat the N cheapest players who ACTUALLY play before
  // the value fill, so the budget they free is available to the XI. The
  // xmins bar is the point — a £4.0m body who never appears is why an autosub
  // never fires, which is the failure this option exists to avoid.
  let benchFodderUsed = 0
  if (benchFodderCount > 0) {
    const fodder = eligible
      .filter(p => (p.xmins ?? 0) >= MIN_FODDER_XMINS)
      .slice()
      .sort((a, b) => a.now_cost - b.now_cost || scoreOf(b) - scoreOf(a))
    for (const player of fodder) {
      if (benchFodderUsed >= benchFodderCount) break
      if (squad.length >= 15) break
      const pos = player.element_type
      if (seatedIds.has(player.id)) continue
      if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue
      if ((teamCount.get(player.team) ?? 0) >= 3) continue
      if (runningCost + player.now_cost > budget) continue
      squad.push({
        id: player.id,
        web_name: player.web_name,
        element_type: pos as 1 | 2 | 3 | 4,
        team: player.team,
        now_cost: player.now_cost,
        xPts: scoreOf(player),
      })
      filledSlots[pos] = (filledSlots[pos] ?? 0) + 1
      teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
      runningCost += player.now_cost
      seatedIds.add(player.id)
      benchFodderUsed++
    }
  }

  // Cheapest eligible prices per position, ascending. Reserving `k x cheapest`
  // is too optimistic when only ONE player sits at that price — the fill then
  // overspends on premiums and strands itself unable to complete the squad
  // (which is how a realistic pool returned null). Reserve the k cheapest
  // DISTINCT players instead.
  const costsByPos = new Map<number, MergedPlayer[]>()
  for (const p of eligible) {
    const list = costsByPos.get(p.element_type) ?? []
    list.push(p)
    costsByPos.set(p.element_type, list)
  }
  for (const list of costsByPos.values()) list.sort((a, b) => a.now_cost - b.now_cost)

  /** Minimum spend still required to fill every remaining slot, excluding
   *  `skipPos` by one seat (the player being considered). */
  const reserveNeeded = (skipPos: number, skipId: number): number => {
    let need = 0
    for (const pos of [1, 2, 3, 4] as const) {
      let remaining = MAX_SLOTS[pos] - (filledSlots[pos] ?? 0)
      if (pos === skipPos) remaining -= 1
      if (remaining <= 0) continue
      let taken = 0
      for (const cand of costsByPos.get(pos) ?? []) {
        if (taken >= remaining) break
        if (cand.id === skipId || seatedIds.has(cand.id)) continue
        need += cand.now_cost
        taken++
      }
      // Not enough bodies left to fill the position at any price.
      if (taken < remaining) return Number.POSITIVE_INFINITY
    }
    return need
  }

  for (const player of eligible) {
    if (squad.length >= 15) break
    if (seatedIds.has(player.id)) continue      // anchor or bench fodder
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCount.get(player.team) ?? 0) >= 3) continue
    if (runningCost + player.now_cost > budget) continue
    // Don't spend into a corner: keep enough for the slots still to fill.
    if (runningCost + player.now_cost + reserveNeeded(pos, player.id) > budget) continue
    squad.push({
      id: player.id,
      web_name: player.web_name,
      element_type: pos as 1 | 2 | 3 | 4,
      team: player.team,
      now_cost: player.now_cost,
      xPts: scoreOf(player),
    })
    filledSlots[pos] = (filledSlots[pos] ?? 0) + 1
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
    seatedIds.add(player.id)
  }

  // Step 3: Validate formation minimums.
  if (squad.length < 15) return null
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledSlots[pos] ?? 0) < MIN_SLOTS[pos]) return null
  }

  // Step 4: Derive best XI via optimiseLineup.
  const syntheticPicks: SquadPick[] = squad.map((p, i) => ({
    element: p.id,
    position: i + 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
  }))
  const squadPlayersFull = squad
    .map(p => playerMap.get(p.id))
    .filter((p): p is MergedPlayer => p !== undefined)
  const lineupResult = optimiseLineup(syntheticPicks, squadPlayersFull, legacyHorizon)
  if (!lineupResult) return null

  const { starters: bestXI, formation } = lineupResult

  // Step 5: xPts totals for XI only (?? 0 fallback for optional fields).
  const xPts1gw = bestXI.reduce(
    (sum, id) => sum + (playerMap.get(id)?.xPts_1gw ?? 0), 0,
  )
  const xPts3gw = bestXI.reduce(
    (sum, id) => sum + ((playerMap.get(id)?.xPts_3gw as number | undefined) ?? 0), 0,
  )
  const xPts5gw = bestXI.reduce(
    (sum, id) => sum + ((playerMap.get(id)?.xPts_5gw as number | undefined) ?? 0), 0,
  )

  // Step 6: Top-3 captain candidates from XI by ceiling descending.
  const captainCandidates: CaptainCandidate[] = bestXI
    .map(id => playerMap.get(id))
    .filter((p): p is MergedPlayer => p !== undefined)
    .map(p => ({
      id: p.id,
      web_name: p.web_name,
      xPts_1gw: p.xPts_1gw ?? 0,
      ceiling: p.xPts_90th_1gw ?? p.xPts_1gw ?? 0,
    }))
    .sort((a, b) => b.ceiling - a.ceiling)
    .slice(0, 3)

  return {
    squad,
    bestXI,
    formation,
    budgetUsed: runningCost,
    budgetRemaining: budget - runningCost,
    xPts1gw,
    xPts3gw,
    xPts5gw,
    captainCandidates,
    anchorConflicts,
    // WC-03: what the squad was actually optimised for. Falls back to the
    // matching legacy total when no startGw was chosen, so the two agree.
    windowXPts: windowGws
      ? bestXI.reduce((sum, id) => {
          const p = playerMap.get(id)
          return sum + (p ? windowGws.reduce((s, gw) => s + computeGwXpts(p, gw), 0) : 0)
        }, 0)
      : (legacyHorizon === 1 ? xPts1gw : legacyHorizon === 3 ? xPts3gw : xPts5gw),
    startGw: startGw ?? null,
    benchFodderUsed,
    squadXPts: squad.reduce((sum, p) => {
      const full = playerMap.get(p.id)
      if (!full) return sum
      return sum + (windowGws
        ? windowGws.reduce((s2, gw) => s2 + computeGwXpts(full, gw), 0)
        : ((full[field] as number | undefined) ?? 0))
    }, 0),
  }
}
