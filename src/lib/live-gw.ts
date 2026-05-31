import { z } from 'zod'
import { SquadPickSchema } from './squad-adapter'
import type { SquadPick } from './squad-adapter'

// ── Zod schemas ─────────────────────────────────────────────────────────────

export const AutoSubRecordSchema = z.object({
  entry:       z.number().int(),
  element_in:  z.number().int(),
  element_out: z.number().int(),
  event:       z.number().int(),
})

export const LivePicksResponseSchema = z.object({
  active_chip:    z.string().nullable(),
  picks:          z.array(SquadPickSchema),
  automatic_subs: z.array(AutoSubRecordSchema).default([]),
})

export type AutoSubRecord     = z.infer<typeof AutoSubRecordSchema>
export type LivePicksResponse = z.infer<typeof LivePicksResponseSchema>

// ── Domain types ─────────────────────────────────────────────────────────────

export interface LivePlayerStats {
  goals_scored:  number
  assists:       number
  bonus:         number
  clean_sheets:  number
  saves:         number
  minutes:       number
  total_points:  number
  yellow_cards:  number
  red_cards:     number
}

export interface LiveXIPlayer {
  element:         number
  position:        number
  player_name:     string
  team_id:         number
  is_captain:      boolean
  is_vice_captain: boolean
  multiplier:      number
  stats:           LivePlayerStats
  live_points:     number
  is_subbed_out:   boolean
  is_subbed_in:    boolean
}

export interface AutoSubEntry {
  player_out:            string
  player_in:             string
  minutes_played_by_out: number
}

export interface LiveScore {
  total_points:         number
  xi:                   LiveXIPlayer[]
  bench:                LiveXIPlayer[]
  auto_subs:            AutoSubEntry[]
  effective_captain_id: number
  vc_promoted:          boolean
  chip:                 string | null
  is_provisional:       boolean
}

// ── Zero-stats sentinel ───────────────────────────────────────────────────────

const ZERO_STATS: LivePlayerStats = {
  goals_scored: 0,
  assists:      0,
  bonus:        0,
  clean_sheets: 0,
  saves:        0,
  minutes:      0,
  total_points: 0,
  yellow_cards: 0,
  red_cards:    0,
}

// ── Pure function ─────────────────────────────────────────────────────────────

export function computeLiveScore(
  picks: SquadPick[],
  automaticSubs: AutoSubRecord[],
  activeChip: string | null,
  liveStatsMap: Map<number, LivePlayerStats>,
  playerNameMap: Map<number, { web_name: string; team: number }>,
): LiveScore {
  // Step 1: Build base XV
  const baseXV: LiveXIPlayer[] = picks.map(pick => {
    const stats     = liveStatsMap.get(pick.element) ?? { ...ZERO_STATS }
    const nameEntry = playerNameMap.get(pick.element)
    return {
      element:         pick.element,
      position:        pick.position,
      player_name:     nameEntry?.web_name ?? `Player${pick.element}`,
      team_id:         nameEntry?.team ?? 0,
      is_captain:      pick.is_captain,
      is_vice_captain: pick.is_vice_captain,
      multiplier:      1,
      stats,
      live_points:     0,  // computed after multiplier resolution
      is_subbed_out:   false,
      is_subbed_in:    false,
    }
  })

  // Step 2: Captain / VC promotion
  const captainPlayer = baseXV.find(p => p.is_captain)
  const vcPlayer      = baseXV.find(p => p.is_vice_captain)

  let effectiveCaptainId = captainPlayer?.element ?? 0
  let vcPromoted         = false

  const tcMultiplier = activeChip === '3xc' ? 3 : 2

  if (captainPlayer && captainPlayer.stats.minutes === 0) {
    if (vcPlayer && vcPlayer.stats.minutes > 0) {
      // VC steps up
      vcPlayer.multiplier = tcMultiplier
      vcPromoted          = true
      effectiveCaptainId  = vcPlayer.element
    } else {
      // Both 0 min — no doubling
      captainPlayer.multiplier = 1
    }
  } else if (captainPlayer) {
    captainPlayer.multiplier = tcMultiplier
  }

  // Step 3: Bench Boost — all 15 in XI, skip autosubs
  if (activeChip === 'bboost') {
    const xi = baseXV.map(p => ({
      ...p,
      live_points: p.stats.total_points * p.multiplier,
    }))
    const totalPoints = xi.reduce((sum, p) => sum + p.live_points, 0)
    return {
      total_points:         totalPoints,
      xi,
      bench:                [],
      auto_subs:            [],
      effective_captain_id: effectiveCaptainId,
      vc_promoted:          vcPromoted,
      chip:                 activeChip,
      is_provisional:       true,
    }
  }

  // Step 4: Autosubs — mark players
  const subbedOutIds = new Set(automaticSubs.map(s => s.element_out))
  const subbedInIds  = new Set(automaticSubs.map(s => s.element_in))

  for (const p of baseXV) {
    if (subbedOutIds.has(p.element)) p.is_subbed_out = true
    if (subbedInIds.has(p.element))  p.is_subbed_in  = true
  }

  const xi: LiveXIPlayer[]    = []
  const bench: LiveXIPlayer[] = []

  for (const p of baseXV) {
    const isStarter = p.position <= 11
    const withPoints = { ...p, live_points: p.stats.total_points * p.multiplier }
    if (p.is_subbed_out) {
      bench.push(withPoints)
    } else if (p.is_subbed_in) {
      xi.push(withPoints)
    } else if (isStarter) {
      xi.push(withPoints)
    } else {
      bench.push(withPoints)
    }
  }

  // Step 5: Build autosub log
  const autoSubEntries: AutoSubEntry[] = automaticSubs.map(sub => {
    const outPlayer = baseXV.find(p => p.element === sub.element_out)
    const inPlayer  = baseXV.find(p => p.element === sub.element_in)
    return {
      player_out:            outPlayer?.player_name ?? `Player${sub.element_out}`,
      player_in:             inPlayer?.player_name  ?? `Player${sub.element_in}`,
      minutes_played_by_out: outPlayer?.stats.minutes ?? 0,
    }
  })

  // Step 6: Total = sum of XI live_points
  const totalPoints = xi.reduce((sum, p) => sum + p.live_points, 0)

  return {
    total_points:         totalPoints,
    xi:                   xi.sort((a, b) => a.position - b.position),
    bench:                bench.sort((a, b) => a.position - b.position),
    auto_subs:            autoSubEntries,
    effective_captain_id: effectiveCaptainId,
    vc_promoted:          vcPromoted,
    chip:                 activeChip,
    is_provisional:       true,
  }
}
