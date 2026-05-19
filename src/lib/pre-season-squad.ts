// Phase 126 (NSP-02): pure greedy 15-player pre-season squad builder.
// Phase 127 (GREEDY-02): diagnoseBuildPreSeasonSquad reason-code classifier.
// No 'use client', no React, no side effects. @vitest-environment node tests.
import type { PreSeasonPlayer, PreSeasonSquad } from './types'

// Position quotas (mirrors chip-modes.ts lines 15-16; redeclared locally per D-07 pattern).
// Do NOT import from chip-modes.ts — that module has different eligibility logic.
const MIN_SLOTS: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
const MAX_SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }

/**
 * buildPreSeasonSquad: greedy 15-player squad from the full player pool (NSP-02).
 *
 * Eligibility: scoreMap.has(p.id) — NOT status === 'a' (off-season status unreliable, D-02/Pitfall 3).
 * Sort: scoreMap.get(p.id) descending; tie-break: lower now_cost wins.
 * Slot constraints: MIN_SLOTS / MAX_SLOTS per position.
 * Team cap: max teamCap (default 3) players per FPL club.
 * Budget guard: runningCost + player.now_cost <= budget.
 *
 * Returns null when fewer than 15 eligible players can be selected, or any MIN_SLOTS position is unmet.
 */
export function buildPreSeasonSquad(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,
  budget = 1000,
  teamCap = 3,
): PreSeasonSquad | null {
  // Eligibility: present in scoreMap only (D-02 — no status check)
  const eligible = players.filter(p => scoreMap.has(p.id))

  // Sort: score desc; tie-break: cheaper wins (better budget utilisation)
  const sorted = [...eligible].sort((a, b) => {
    const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
    return diff !== 0 ? diff : a.now_cost - b.now_cost
  })

  const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCount = new Map<number, number>()
  const squad: PreSeasonPlayer[] = []
  let runningCost = 0

  for (const player of sorted) {
    if (squad.length >= 15) break
    const pos = player.element_type
    if ((filledSlots[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCount.get(player.team) ?? 0) >= teamCap) continue
    if (runningCost + player.now_cost > budget) continue
    squad.push(player)
    filledSlots[pos]++
    teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
  }

  // Return null if squad is incomplete or any MIN_SLOTS position unmet
  if (squad.length < 15) return null
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledSlots[pos] ?? 0) < MIN_SLOTS[pos]) return null
  }

  // Derive starters (11) and bench (4) via greedy formation selection.
  // 1. Pick starter GK: the GK with higher score (scoreMap value)
  const gks = squad.filter(p => p.element_type === 1)
  const outfield = squad.filter(p => p.element_type !== 1)

  // Sort GKs by score desc; first GK is starter, second is bench
  const gksSorted = [...gks].sort(
    (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0),
  )
  const starterGk = gksSorted[0]
  const benchGk = gksSorted[1]

  // 2. Fill 10 outfield starter slots greedily by score desc, respecting:
  //    min 3 DEF, min 2 MID, min 1 FWD (and at most 5 of each outfield position)
  const outfieldSorted = [...outfield].sort(
    (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0),
  )

  const OUTFIELD_MIN: Record<number, number> = { 2: 3, 3: 2, 4: 1 }
  const OUTFIELD_MAX: Record<number, number> = { 2: 5, 3: 5, 4: 3 }
  const starterOutfield: PreSeasonPlayer[] = []
  const outfieldFilled: Record<number, number> = { 2: 0, 3: 0, 4: 0 }

  // First pass: fill minimums
  for (const pos of [2, 3, 4] as const) {
    const forPos = outfieldSorted.filter(
      p => p.element_type === pos && !starterOutfield.includes(p),
    )
    const toAdd = forPos.slice(0, OUTFIELD_MIN[pos])
    for (const p of toAdd) {
      starterOutfield.push(p)
      outfieldFilled[pos]++
    }
  }

  // Second pass: fill remaining slots (up to 10 total) by score desc
  const remaining = outfieldSorted.filter(p => !starterOutfield.includes(p))
  for (const p of remaining) {
    if (starterOutfield.length >= 10) break
    const pos = p.element_type
    if ((outfieldFilled[pos] ?? 0) >= OUTFIELD_MAX[pos]) continue
    starterOutfield.push(p)
    outfieldFilled[pos]++
  }

  const starters = [starterGk, ...starterOutfield]
  const starterIds = new Set(starters.map(p => p.id))

  // Bench: remaining players (squad minus starters); GK first, then by score desc
  const benchOutfield = squad
    .filter(p => !starterIds.has(p.id) && p.element_type !== 1)
    .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
  const bench = [benchGk, ...benchOutfield]

  // Formation string: "{DEF_starters}-{MID_starters}-{FWD_starters}"
  const defCount = starters.filter(p => p.element_type === 2).length
  const midCount = starters.filter(p => p.element_type === 3).length
  const fwdCount = starters.filter(p => p.element_type === 4).length
  const formation = `${defCount}-${midCount}-${fwdCount}`

  return {
    starters,
    bench,
    formation,
    budgetUsed: runningCost,
  }
}

/**
 * diagnoseBuildPreSeasonSquad: returns a reason code explaining why buildPreSeasonSquad
 * would fail, or null when a valid 15-player squad is producible (GREEDY-02).
 *
 * Reason-code precedence (D-02):
 *   1. 'no_eligible_players' — filtered eligible list is empty
 *   2. 'unmet_min_slots'    — after greedy fill, any MIN_SLOTS position is unmet
 *   3. 'incomplete_squad'   — squad.length < 15 but min slots would be met at higher budget
 *   null                    — a valid 15-player squad is producible at this budget
 */
export function diagnoseBuildPreSeasonSquad(
  players: PreSeasonPlayer[],
  scoreMap: Map<number, number>,
  budget = 1000,
  teamCap = 3,
): { reason: 'incomplete_squad' | 'unmet_min_slots' | 'no_eligible_players' } | null {
  // Eligibility: same as buildPreSeasonSquad (present in scoreMap)
  const eligible = players.filter(p => scoreMap.has(p.id))

  // Reason 1: no eligible players at all
  if (eligible.length === 0) {
    return { reason: 'no_eligible_players' }
  }

  // Run greedy fill to determine actual filled slot counts (ignoring budget to detect unmet_min_slots)
  const sorted = [...eligible].sort((a, b) => {
    const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
    return diff !== 0 ? diff : a.now_cost - b.now_cost
  })

  // First pass: greedy WITHOUT budget constraint to detect unmet_min_slots
  const filledNoBudget: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCountNoBudget = new Map<number, number>()
  let countNoBudget = 0
  for (const player of sorted) {
    if (countNoBudget >= 15) break
    const pos = player.element_type
    if ((filledNoBudget[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCountNoBudget.get(player.team) ?? 0) >= teamCap) continue
    filledNoBudget[pos]++
    teamCountNoBudget.set(player.team, (teamCountNoBudget.get(player.team) ?? 0) + 1)
    countNoBudget++
  }

  // Reason 2: if even without budget constraint, min slots cannot be met
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledNoBudget[pos] ?? 0) < MIN_SLOTS[pos]) {
      return { reason: 'unmet_min_slots' }
    }
  }

  // Second pass: greedy WITH budget constraint
  const filledWithBudget: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const teamCountWithBudget = new Map<number, number>()
  const squad: PreSeasonPlayer[] = []
  let runningCost = 0
  for (const player of sorted) {
    if (squad.length >= 15) break
    const pos = player.element_type
    if ((filledWithBudget[pos] ?? 0) >= MAX_SLOTS[pos]) continue
    if ((teamCountWithBudget.get(player.team) ?? 0) >= teamCap) continue
    if (runningCost + player.now_cost > budget) continue
    squad.push(player)
    filledWithBudget[pos]++
    teamCountWithBudget.set(player.team, (teamCountWithBudget.get(player.team) ?? 0) + 1)
    runningCost += player.now_cost
  }

  // Reason 3: budget too tight — min slots would be met at higher budgets but not here
  if (squad.length < 15) {
    return { reason: 'incomplete_squad' }
  }

  // All 15 selected; verify min slots (belt-and-braces; greedy normally ensures this)
  for (const pos of [1, 2, 3, 4] as const) {
    if ((filledWithBudget[pos] ?? 0) < MIN_SLOTS[pos]) {
      return { reason: 'unmet_min_slots' }
    }
  }

  return null
}
