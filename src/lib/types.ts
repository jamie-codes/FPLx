// Position codes used by FPL API: 1=GK, 2=DEF, 3=MID, 4=FWD
export type PositionCode = 1 | 2 | 3 | 4

// FPL player status codes
export type PlayerStatus = 'a' | 'd' | 'i' | 's' | 'u' | 'n'

// Validated FPL element (after Zod parsing, only consumed fields)
export interface FPLElement {
  id: number
  web_name: string
  team: number
  element_type: PositionCode
  now_cost: number                          // tenths of GBP 1m (e.g. 65 = GBP 6.5m)
  selected_by_percent: string               // "12.5" — FPL returns as string
  form: string                              // "6.3" — FPL returns as string
  status: PlayerStatus                      // a=available, d=doubtful, i=injured, s=suspended, u=unavailable, n=not available
  minutes: number
  starts: number
  defensive_contribution: number | null     // 2025/26 field — nullable per PPS-01
  defensive_contribution_per_90: number | null  // season aggregate per 90 mins
  clearances_blocks_interceptions: number | null  // 2025/26 field — nullable per PPS-01
  direct_freekicks_order: number | null     // Set piece taker order per PPS-01. 1 = primary taker, null = not a taker.
  penalties_order: number | null            // Penalty taker order per PPS-01. 1 = primary taker, null = not a taker.
  corners_and_indirect_freekicks_order: number | null  // Corner taker order per PPS-01. 1 = primary taker, null = not a taker.
  news: string                              // injury/availability news text per PPS-04
  // Price trend fields (VAL-03)
  cost_change_event: number                 // tenths of GBP 1m, this GW (0 = no change)
  cost_change_start: number                 // tenths of GBP 1m, since season start
}

// Validated FPL team
export interface FPLTeam {
  id: number
  name: string
  short_name: string
  code: number
}

// Validated FPL gameweek event
export interface FPLEvent {
  id: number
  is_current: boolean
  is_next: boolean
  finished: boolean
}

// Full bootstrap-static response (validated)
export interface FPLBootstrap {
  elements: FPLElement[]
  teams: FPLTeam[]
  events: FPLEvent[]
}

// Player ID map entry: bridges FPL <-> Understat
export interface PlayerIdMapEntry {
  fpl_id: number
  fpl_web_name: string
  understat_id: number | null               // null for promoted-team players with no Understat history (per D-02)
  understat_name: string | null             // null when understat_id is null
}

// Player ID map: keyed by FPL id as string
export type PlayerIdMap = Record<string, PlayerIdMapEntry>

// Pipeline metadata written alongside cached data
export interface PipelineMetadata {
  last_updated: string                      // ISO 8601 timestamp
  stale: boolean                            // true when serving previous day's cache after pipeline failure (per D-06)
  source: 'blob' | 'local'                  // where data was read from
}

// Difficulty tier for fixture visualization (D-05)
export type DifficultyTier = 'easy' | 'medium' | 'hard'

// Single upcoming fixture entry per player (D-03, D-04)
export interface FixtureEntry {
  opponent_team: string          // Short name e.g. "ARS"
  is_home: boolean               // True if player's team is home (D-04)
  event_id: number               // Gameweek number
  difficulty_score: number       // 0.0 (easiest) to 1.0 (hardest), from rolling xGA (D-02)
  difficulty_tier: DifficultyTier // Visual tier (D-05)
}

// Minutes risk classification (Phase 7 — MINS-01)
export type MinsRisk = 'nailed' | 'likely_start' | 'rotation_risk' | 'cameo' | 'injured'

// Merged player from pipeline (D-06): FPL fields + Understat + form + fixtures
export interface MergedPlayer {
  // FPL core fields (from Phase 1 FPLElement)
  id: number
  web_name: string
  team: number
  team_short_name: string
  element_type: PositionCode
  now_cost: number
  selected_by_percent: string
  form: string
  status: PlayerStatus
  minutes: number
  starts: number
  total_points: number
  defensive_contribution: number | null
  clearances_blocks_interceptions: number | null
  direct_freekicks_order: number | null
  penalties_order: number | null
  corners_and_indirect_freekicks_order: number | null
  news: string
  // Price trend fields (VAL-03)
  cost_change_event: number                 // tenths of GBP 1m, this GW (0 = no change)
  cost_change_start: number                 // tenths of GBP 1m, since season start
  // Understat fields (null for unmatched promoted-team players per Pitfall 12)
  understat_id: number | null
  xg_per90: number | null
  xa_per90: number | null
  // Form fields (D-01: last 5 GW window, per-90 normalised)
  minutes_per90: number
  form_pts_per90: number
  // Upcoming fixtures (D-03: next 5)
  fixtures: FixtureEntry[]
  // Projected points (Phase 7 — PROJ-01/02/03) — absolute FPL pts, never normalised 0-1
  proj_pts_1gw: number        // expected pts next 1 GW (ep_next * availability)
  proj_pts_3gw: number        // expected pts next 3 GWs (ppg-based, DGW-aware sum)
  proj_pts_5gw: number        // expected pts next 5 GWs (ppg-based, DGW-aware sum)
  // Minutes risk (Phase 7 — MINS-01)
  xmins: number               // expected minutes per GW (0-90)
  start_prob: number          // probability of starting next match (0.0-1.0)
  mins_risk: MinsRisk         // rotation risk classification
}

// DefCon per-player stats (Phase 4) — populated from pipeline/cache/defcon_stats.json
export interface DefConPlayer {
  id: number
  web_name: string
  element_type: PositionCode       // 2=DEF, 3=MID, 4=FWD
  team: number
  team_short_name: string
  threshold: number                // 10 for DEF, 12 for MID/FWD
  hit_rate: number                 // 0.0-1.0
  hits: number                     // games meeting threshold
  games_played: number             // games with minutes > 0
  avg_per90: number                // defensive_contribution_per_90 from bootstrap
  distance_to_threshold: number    // threshold - avg_per90 (negative = above)
  fixture_correlation: {
    insufficient_data: boolean
    easy_hit_rate?: number
    hard_hit_rate?: number
    easy_n?: number
    hard_n?: number
  }
}

// Scored player with Gem composite and dimension scores (Phase 3)
export interface ScoredPlayer extends MergedPlayer {
  gem_score: number           // 0.0-1.0 normalised composite
  fdr_score: number           // fixture difficulty (inverted: easy fixtures = high score)
  form_score: number          // per-90 form points
  xg_score: number | null     // xG/90 (null when xg_per90 is null)
  xa_score: number | null     // xA/90 (null when xa_per90 is null)
  ownership_score: number     // inverse ownership % (low owned = high score)
  minutes_score: number       // minutes reliability
  set_piece_score: number     // set piece role (penalty/FK/corner taker)
}

// Club form fixture (upcoming, per club)
export interface ClubFormFixture {
  opponent_team: string          // short_name e.g. "ARS"
  is_home: boolean
  event_id: number
  difficulty_score: number
  difficulty_tier: DifficultyTier
}

// Club form stats over rolling 5-game window (FFA-03)
export interface ClubForm {
  team_id: number
  team_name: string
  team_short_name: string
  wins: number
  draws: number
  losses: number
  goals_scored: number
  goals_conceded: number
  upcoming_fixtures: ClubFormFixture[]   // next 5
}
