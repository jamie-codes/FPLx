import type { ScoredPlayer, ClubForm, ClubFormFixture } from './types'
import type { SquadPick } from './squad-adapter'

// ---------------------------------------------------------------------------
// Constants (per CONTEXT.md D-01/D-02/D-05/D-08 and RESEARCH §Common Pitfalls)
// ---------------------------------------------------------------------------

export const BGW_NEUTRAL_EASE = 0.5         // RESEARCH Pitfall 2: BGW fallback
export const TC_CANDIDATE_COUNT = 3         // CONTEXT D-05: top-3 by xPts_90th_1gw
export const FH_HORIZON = 5                 // CONTEXT D-02: 5 GW horizon
export const FH_TEAM_CAP = 3                // FPL rule: max 3 per team
export const FH_DEFAULT_BUDGET_TENTHS = 1000 // £100m fallback when no squad provided

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GWEaseScore {
  gw: number
  ease: number          // 0.0 hardest, 1.0 easiest (1 - attacking_difficulty)
  isBest?: boolean
  isBGW?: boolean
}

export interface FHSquadPlayer {
  id: number
  web_name: string
  element_type: 1 | 2 | 3 | 4
  team: number
  now_cost: number
  xPts_1gw: number
  ease: number          // for the bestGw only
}

export interface FHResult {
  bestGw: number
  scores: GWEaseScore[]            // length FH_HORIZON
  suggestedSquad: FHSquadPlayer[]  // length up to 15
}

// ---------------------------------------------------------------------------
// buildClubFormMap
// ---------------------------------------------------------------------------

/**
 * Build a fast team_id -> upcoming_fixtures lookup from the ClubForm[] payload.
 * Pure function. No side effects.
 */
export function buildClubFormMap(clubForm: ClubForm[]): Map<number, ClubFormFixture[]> {
  return new Map(clubForm.map(cf => [cf.team_id, cf.upcoming_fixtures]))
}

// Internal helper: ease for a team in a given GW; BGW returns BGW_NEUTRAL_EASE.
function easeForTeamGw(
  teamId: number,
  gw: number,
  clubFormMap: Map<number, ClubFormFixture[]>,
): { ease: number; isBGW: boolean } {
  const fixtures = clubFormMap.get(teamId)
  if (!fixtures) return { ease: BGW_NEUTRAL_EASE, isBGW: true }
  const fx = fixtures.find(f => f.event_id === gw)
  if (!fx) return { ease: BGW_NEUTRAL_EASE, isBGW: true }
  return { ease: 1 - fx.attacking_difficulty, isBGW: false }
}

// Internal helper: derive the 5 target GW numbers from clubFormMap.
// Uses the union of event_ids across all teams' upcoming_fixtures, sorts ascending,
// takes the first FH_HORIZON entries. Falls back to [startGw, ..., startGw+4].
function deriveHorizonGws(
  clubFormMap: Map<number, ClubFormFixture[]>,
  startGw: number,
): number[] {
  const gwSet = new Set<number>()
  for (const fixtures of clubFormMap.values()) {
    for (const fx of fixtures) {
      gwSet.add(fx.event_id)
    }
  }
  if (gwSet.size === 0) {
    return Array.from({ length: FH_HORIZON }, (_, i) => startGw + i)
  }
  const sorted = Array.from(gwSet).sort((a, b) => a - b)
  // Take only GWs >= startGw, then return first FH_HORIZON
  const filtered = sorted.filter(gw => gw >= startGw)
  if (filtered.length >= FH_HORIZON) {
    return filtered.slice(0, FH_HORIZON)
  }
  // Fill remaining with sequential GWs
  const result = [...filtered]
  const last = result.length > 0 ? result[result.length - 1] : startGw - 1
  while (result.length < FH_HORIZON) {
    result.push(last + (result.length - filtered.length) + 1)
  }
  return result
}

// ---------------------------------------------------------------------------
// computeBBScore (CHIP-01) — D-04
// ---------------------------------------------------------------------------

/**
 * Score each upcoming GW for Bench Boost based on the manager's actual bench (positions 12-15).
 *
 * ease polarity: ease = 1 - attacking_difficulty (Pitfall 1)
 * BGW: bench player with no fixture for target GW contributes BGW_NEUTRAL_EASE (Pitfall 2)
 * isBest: set on the highest-ease entry; tie-break: earliest GW wins
 *
 * @param benchPicks   SquadPick[] where position >= 12 (caller may pass full picks; positions < 12 are ignored)
 * @param players      Full ScoredPlayer[] pool (used to map player.id -> team)
 * @param clubFormMap  team_id -> upcoming_fixtures[] (use buildClubFormMap)
 * @param startGw      First GW in the horizon
 * @returns 5 GWEaseScore entries (length always FH_HORIZON); isBest=true on highest-ease entry
 */
export function computeBBScore(
  benchPicks: SquadPick[],
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  startGw: number,
): GWEaseScore[] {
  // Defensive zero-data return
  if (players.length === 0 || clubFormMap.size === 0) {
    const gws = Array.from({ length: FH_HORIZON }, (_, i) => startGw + i)
    return gws.map(gw => ({ gw, ease: 0, isBGW: true }))
  }

  const playerMap = new Map<number, ScoredPlayer>(players.map(p => [p.id, p]))
  const horizonGws = deriveHorizonGws(clubFormMap, startGw)

  // Filter to bench picks only (position >= 12)
  const bench = benchPicks.filter(p => p.position >= 12)

  const scores: GWEaseScore[] = horizonGws.map(gw => {
    if (bench.length === 0) {
      return { gw, ease: BGW_NEUTRAL_EASE, isBGW: true }
    }

    let easeSum = 0
    let countedPlayers = 0
    let anyBGW = false

    for (const pick of bench) {
      const player = playerMap.get(pick.element)
      if (!player) {
        // Unknown player: contribute BGW_NEUTRAL_EASE
        easeSum += BGW_NEUTRAL_EASE
        countedPlayers++
        anyBGW = true
        continue
      }
      const { ease, isBGW } = easeForTeamGw(player.team, gw, clubFormMap)
      easeSum += ease
      countedPlayers++
      if (isBGW) anyBGW = true
    }

    const ease = countedPlayers > 0 ? easeSum / countedPlayers : BGW_NEUTRAL_EASE
    return { gw, ease, isBGW: anyBGW ? true : undefined }
  })

  // Mark isBest on highest-ease entry; tie-break: earliest GW wins (use `>` not `>=`)
  let bestIdx = 0
  for (let i = 1; i < scores.length; i++) {
    if (scores[i].ease > scores[bestIdx].ease) {
      bestIdx = i
    }
  }
  scores[bestIdx] = { ...scores[bestIdx], isBest: true }

  return scores
}

// ---------------------------------------------------------------------------
// computeTCScore (CHIP-02) — D-05
// ---------------------------------------------------------------------------

/**
 * Score each upcoming GW for Triple Captain based on the top-3 candidates' fixture ease.
 *
 * Candidates: status === 'a', element_type !== 1, mins_risk !== 'injured'
 * Ranking: xPts_90th_1gw (fallback chain: xPts_1gw -> 0) per Pitfall 3
 * Per-GW score: max ease across TC_CANDIDATE_COUNT candidates (best candidate that week)
 * BGW candidate contributes BGW_NEUTRAL_EASE (Pitfall 2)
 * isBest: set on highest-ease entry; tie-break: earliest GW wins
 *
 * @param players      Full ScoredPlayer[] pool
 * @param clubFormMap  team_id -> upcoming_fixtures[]
 * @param startGw      First GW in the horizon
 */
export function computeTCScore(
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  startGw: number,
): GWEaseScore[] {
  // Defensive zero-data return
  if (players.length === 0 || clubFormMap.size === 0) {
    const gws = Array.from({ length: FH_HORIZON }, (_, i) => startGw + i)
    return gws.map(gw => ({ gw, ease: 0, isBGW: true }))
  }

  const horizonGws = deriveHorizonGws(clubFormMap, startGw)

  // Filter eligible candidates: available, not GK, not injured
  const eligible = players.filter(
    p => p.status === 'a' && p.element_type !== 1 && p.mins_risk !== 'injured',
  )

  // TC fallback chain (Pitfall 3): xPts_90th_1gw ?? xPts_1gw ?? 0
  const rankingKey = (p: ScoredPlayer): number =>
    p.xPts_90th_1gw ?? p.xPts_1gw ?? 0

  // Take top TC_CANDIDATE_COUNT by ranking key (descending)
  const candidates = eligible
    .slice()
    .sort((a, b) => rankingKey(b) - rankingKey(a))
    .slice(0, TC_CANDIDATE_COUNT)

  const scores: GWEaseScore[] = horizonGws.map(gw => {
    if (candidates.length === 0) {
      return { gw, ease: BGW_NEUTRAL_EASE, isBGW: true }
    }

    let maxEase = -Infinity
    let anyBGW = false

    for (const candidate of candidates) {
      const { ease, isBGW } = easeForTeamGw(candidate.team, gw, clubFormMap)
      if (ease > maxEase) maxEase = ease
      if (isBGW) anyBGW = true
    }

    const finalEase = maxEase === -Infinity ? BGW_NEUTRAL_EASE : maxEase
    return { gw, ease: finalEase, isBGW: anyBGW ? true : undefined }
  })

  // Mark isBest on highest-ease entry; tie-break: earliest GW wins
  let bestIdx = 0
  for (let i = 1; i < scores.length; i++) {
    if (scores[i].ease > scores[bestIdx].ease) {
      bestIdx = i
    }
  }
  scores[bestIdx] = { ...scores[bestIdx], isBest: true }

  return scores
}

// ── TC-01: Candidate table ────────────────────────────────────────────────────

export const DGW_TC_MULTIPLIER = 1.3

export interface TCCandidate {
  player: ScoredPlayer
  fixture_label: string       // e.g. "ARS (H)" or "ARS (H) + CHE (A)"
  is_dgw: boolean
  tc_xpts: number             // xPts_1gw × (is_dgw ? 2 : 1)
  ceiling: number             // (xPts_90th_1gw ?? xPts_1gw ?? 0) × (is_dgw ? 2 : 1)
  start_risk: 'low' | 'medium' | 'high'
  tc_rating: number           // tc_xpts × start_prob × (is_dgw ? DGW_TC_MULTIPLIER : 1)
}

function buildFixtureLabel(fixtures: ClubFormFixture[], gw: number): string {
  const gwFx = fixtures.filter(f => f.event_id === gw)
  if (gwFx.length === 0) return 'No fixture'
  return gwFx.map(f => `${f.opponent_team} (${f.is_home ? 'H' : 'A'})`).join(' + ')
}

/**
 * Returns the top-5 TC candidates for startGw, sorted by tc_rating descending.
 * DGW players naturally float to the top due to DGW_TC_MULTIPLIER.
 * GKs and injured players are excluded. Unavailable (status !== 'a') players excluded.
 */
export function computeTCCandidates(
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  startGw: number,
): TCCandidate[] {
  const eligible = players.filter(
    p => p.status === 'a' && p.element_type !== 1 && p.mins_risk !== 'injured',
  )

  const candidates: TCCandidate[] = eligible.map(player => {
    const fixtures = clubFormMap.get(player.team) ?? []
    const gwFx = fixtures.filter(f => f.event_id === startGw)
    const is_dgw = gwFx.length >= 2
    const fixture_label = buildFixtureLabel(fixtures, startGw)
    const mult = is_dgw ? 2 : 1
    const tc_xpts = (player.xPts_1gw ?? 0) * mult
    const ceiling = (player.xPts_90th_1gw ?? player.xPts_1gw ?? 0) * mult
    const start_risk: TCCandidate['start_risk'] =
      player.start_prob >= 0.85 ? 'low'
      : player.start_prob >= 0.65 ? 'medium'
      : 'high'
    const tc_rating = tc_xpts * player.start_prob * (is_dgw ? DGW_TC_MULTIPLIER : 1)
    return { player, fixture_label, is_dgw, tc_xpts, ceiling, start_risk, tc_rating }
  })

  return candidates.sort((a, b) => b.tc_rating - a.tc_rating).slice(0, 5)
}

// ---------------------------------------------------------------------------
// computeFHResult (CHIP-03) — D-06/D-07/D-08
// ---------------------------------------------------------------------------

/**
 * Score each upcoming GW for Free Hit AND return the formation-valid 15-player squad
 * for the recommended GW.
 *
 * Greedy slot-fill enforces: exactly 2 GK, 3-5 DEF, 2-5 MID, 1-3 FWD, total = 15,
 * max FH_TEAM_CAP per FPL team, total now_cost <= budget.
 *
 * Budget: bankBalance + sum(sellPrices?.[id] ?? playerMap.get(id)?.now_cost ?? 0) for
 * currentSquadIds, or FH_DEFAULT_BUDGET_TENTHS when currentSquadIds is undefined (Pitfall 5).
 *
 * Score per GW = sum of weighted xPts of the squad's top-11 (1 GK + 10 best outfield by
 * weighted) where weighted = xPts_1gw * (1 - attacking_difficulty_for_gw).
 * BGW player: weighted = xPts_1gw * BGW_NEUTRAL_EASE (do NOT set to 0 per Pitfall 2 note).
 *
 * bestGw: GW with highest score; tie-break earliest GW wins (use `>` not `>=`).
 *
 * @param bankBalance      tenths of £1m in the bank
 * @param sellPrices       optional Record<playerId, sellPriceTenths> for current squad
 * @param currentSquadIds  optional list of player IDs currently owned (for budget calc)
 * @param startGw          first GW in the horizon (defaults to first event_id in clubFormMap)
 */
export function computeFHResult(
  players: ScoredPlayer[],
  clubFormMap: Map<number, ClubFormFixture[]>,
  bankBalance: number,
  sellPrices?: Record<number, number>,
  currentSquadIds?: number[],
  startGw?: number,
): FHResult {
  const resolvedStartGw = startGw ?? (() => {
    const allGws: number[] = []
    for (const fixtures of clubFormMap.values()) {
      for (const fx of fixtures) allGws.push(fx.event_id)
    }
    return allGws.length > 0 ? Math.min(...allGws) : 1
  })()

  // Defensive zero-data return
  if (players.length === 0 || clubFormMap.size === 0) {
    const gws = Array.from({ length: FH_HORIZON }, (_, i) => resolvedStartGw + i)
    return {
      bestGw: resolvedStartGw,
      scores: gws.map(gw => ({ gw, ease: 0, isBGW: true })),
      suggestedSquad: [],
    }
  }

  const playerMap = new Map<number, ScoredPlayer>(players.map(p => [p.id, p]))
  const horizonGws = deriveHorizonGws(clubFormMap, resolvedStartGw)

  // Compute budget (Pitfall 5)
  const budget: number = currentSquadIds !== undefined
    ? bankBalance + currentSquadIds.reduce(
        (sum, id) => sum + (sellPrices?.[id] ?? playerMap.get(id)?.now_cost ?? 0),
        0,
      )
    : FH_DEFAULT_BUDGET_TENTHS

  // Eligible players: status === 'a'
  const eligible = players.filter(p => p.status === 'a')

  // Per-GW greedy squad + score
  type GwResult = {
    gw: number
    score: number
    squad: FHSquadPlayer[]
  }

  const gwResults: GwResult[] = horizonGws.map(gw => {
    // Compute weighted xPts for each eligible player for this GW
    const withWeighted = eligible.map(p => {
      const { ease, isBGW } = easeForTeamGw(p.team, gw, clubFormMap)
      const xPts = p.xPts_1gw ?? 0
      // BGW: use xPts_1gw * BGW_NEUTRAL_EASE (not 0) so BGW players can still be picked
      const weighted = isBGW ? xPts * BGW_NEUTRAL_EASE : xPts * ease
      return { player: p, weighted, ease }
    })

    // Sort descending by weighted
    withWeighted.sort((a, b) => b.weighted - a.weighted)

    // Slot quotas: min and max per position type
    // element_type: 1=GK, 2=DEF, 3=MID, 4=FWD
    const minSlots: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
    const maxSlots: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
    const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const teamCount = new Map<number, number>()
    const squad: FHSquadPlayer[] = []
    let runningCost = 0

    for (const { player, weighted, ease } of withWeighted) {
      if (squad.length >= 15) break

      const pos = player.element_type
      const currentForPos = filledSlots[pos] ?? 0
      const maxForPos = maxSlots[pos] ?? 0

      // Check position quota
      if (currentForPos >= maxForPos) continue

      // Check team cap (Pitfall 4)
      if ((teamCount.get(player.team) ?? 0) >= FH_TEAM_CAP) continue

      // Check budget
      if (runningCost + player.now_cost > budget) continue

      // Accept this player
      squad.push({
        id: player.id,
        web_name: player.web_name,
        element_type: player.element_type as 1 | 2 | 3 | 4,
        team: player.team,
        now_cost: player.now_cost,
        xPts_1gw: player.xPts_1gw ?? 0,
        ease,
      })
      filledSlots[pos] = currentForPos + 1
      teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
      runningCost += player.now_cost

      // Check if we've hit 15 players
      if (squad.length === 15) break
    }

    // Check if minimum formation met; if not, we still return what we got
    // (defensive: never throw)

    // Compute score: top-11 by weighted (1 GK + 10 best outfield)
    const gkInSquad = squad.filter(p => p.element_type === 1)
    const outfieldInSquad = squad.filter(p => p.element_type !== 1)

    // Get weighted for each squad player
    const weightedMap = new Map(withWeighted.map(({ player, weighted }) => [player.id, weighted]))

    const bestGk = gkInSquad
      .slice()
      .sort((a, b) => (weightedMap.get(b.id) ?? 0) - (weightedMap.get(a.id) ?? 0))
      .slice(0, 1)

    const bestOutfield = outfieldInSquad
      .slice()
      .sort((a, b) => (weightedMap.get(b.id) ?? 0) - (weightedMap.get(a.id) ?? 0))
      .slice(0, 10)

    const top11 = [...bestGk, ...bestOutfield]
    const score = top11.reduce((sum, p) => sum + (weightedMap.get(p.id) ?? 0), 0)

    return { gw, score, squad }
  })

  // Find bestGw: highest score, tie-break earliest GW (use `>` not `>=`)
  let bestIdx = 0
  for (let i = 1; i < gwResults.length; i++) {
    if (gwResults[i].score > gwResults[bestIdx].score) {
      bestIdx = i
    }
  }
  const bestGwResult = gwResults[bestIdx]

  // Build scores array — normalise to [0, 1] so EaseCellBar renders correctly
  const maxScore = Math.max(...gwResults.map(r => r.score), 1)
  const scores: GWEaseScore[] = gwResults.map((r, i) => ({
    gw: r.gw,
    ease: horizonGws.length > 0 ? r.score / maxScore : 0, // 0.0–1.0: best GW = 1.0
    isBest: i === bestIdx ? true : undefined,
  }))

  return {
    bestGw: bestGwResult.gw,
    scores,
    suggestedSquad: bestGwResult.squad,
  }
}
