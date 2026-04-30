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

// Single upcoming fixture entry per player (D-03, D-04; FDR++ DATA-01)
export interface FixtureEntry {
  opponent_team: string          // Short name e.g. "ARS"
  is_home: boolean               // True if player's team is home (D-04)
  event_id: number               // Gameweek number
  difficulty_score: number       // 0.0 (easiest) to 1.0 (hardest), from rolling xGA (D-02)
  difficulty_tier: DifficultyTier // Visual tier (D-05)
  attacking_difficulty?: number  // Phase 27 DATA-01 D-01 — same value as difficulty_score (additive). Optional during pipeline rollout.
  defensive_difficulty?: number  // Phase 27 DATA-01 D-02 — from 3-game goals-scored rolling window. NOT inverted: high opp goals = HIGH difficulty for opp DEF.
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
  // FPL scoring fields (used by DQ-01 xG proxy in gem-score.ts)
  goals_scored: number
  assists: number
  // FPL StatsBomb season totals (Phase 32 TGT-02, D-09).
  // Source: bootstrap elements.expected_goals / expected_assists (string decimals,
  // converted to float in pipeline/merge.py). Used by src/lib/xgi.ts.
  expected_goals: number
  expected_assists: number
  // Historical points (VG-01 — from element-summary history)
  pts_last3gw: number        // sum of points over last 3 GWs (partial if fewer GWs available)
  pts_last5gw: number        // sum of points over last 5 GWs (partial if fewer GWs available)
  pts_gw_count: number       // number of GWs of history available (for partial window asterisk)
  defensive_contribution: number | null
  clearances_blocks_interceptions: number | null
  direct_freekicks_order: number | null
  penalties_order: number | null
  corners_and_indirect_freekicks_order: number | null
  penalties_text: string
  direct_freekicks_text: string
  corners_and_indirect_freekicks_text: string
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
  // xPts engine (Phase 28 DATA-02, XPTS-01, XPTS-02 — D-01..D-09).
  // Optional during pipeline rollout — same convention as Phase 27 attacking_difficulty.
  xPts_1gw?: number           // expected pts next 1 GW (Poisson goals/assists, Bernoulli CS, flat bonus)
  xPts_3gw?: number           // expected pts next 3 GWs (DGW-aware sum)
  xPts_5gw?: number           // expected pts next 5 GWs (DGW-aware sum)
  xPts_ceiling_1gw?: boolean  // true = top-tercile sigma in 1 GW window (high-ceiling)
  xPts_ceiling_3gw?: boolean  // true = top-tercile sigma in 3 GW window
  xPts_ceiling_5gw?: boolean  // true = top-tercile sigma in 5 GW window
  xPts_components_1gw?: {     // breakdown for 1 GW only (tooltip data); null for BGW
    goal_pts: number
    assist_pts: number
    cs_pts: number
    bonus_pts: number
  } | null
  // Regression signal (Phase 29 DATA-03, REG-01, REG-02).
  // Optional — absent when signal cannot be computed (player has <900 min in 5-GW window,
  // no history, or pipeline fetch failed per D-03 graceful fallback).
  // D-01/D-02 deviation: computed from FPL element-summary expected_goals/expected_assists,
  // not soccerdata/understat_per_match.json (see 29-RESEARCH.md Critical Finding).
  regression_signal?: 'buy' | 'sell' | null
  actual_vs_xg_delta?: number | null
  // Differential flag (Phase 30 TMPL-01, TMPL-02).
  // Optional — absent when neither DIFF nor TRAP condition met (D-05 graceful fallback).
  // 'diff': above-median xPts_1gw for position, ownership < 5%, status === 'a' (D-03).
  // 'trap': below-median xPts_1gw for position, ownership > 15% (D-04 — status-agnostic per D-12).
  differential_flag?: 'diff' | 'trap' | null
  // Captaincy ceiling (Phase 31 CAP-03 D-11). 90th-percentile xPts (xPts_1gw + 1.28*sigma_1gw)
  // computed in pipeline; persisted per-player to enable future GemTable sort.
  xPts_90th_1gw?: number
  // ACC-05 (Phase 41 D-11): last GW actual points, joined into the player row by /api/players
  // from accuracy_backtest.json. Optional — null when player has no backtest entry; absent
  // before Phase 40 pipeline has run. NOT computed by pipeline/merge.py.
  last_gw_actual_pts?: number | null
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

// Phase 41 ACC-02/03/04 — accuracy backtest shape from pipeline/cache/accuracy_backtest.json
// Field naming matches the JSON exactly (lowercase snake_case for xpts_*/proj_pts_*).
export interface AccuracyGwSummary {
  gw: number
  haulter_count: number
  xpts_flagged: number
  xpts_hit_rate: number   // 0.0-1.0
}

export interface AccuracySummary {
  xpts_hit_rate: number
  gws: AccuracyGwSummary[]
}

export interface AccuracyHaulter {
  gw: number
  player_id: number
  player_name: string
  actual_pts: number
  xpts_predicted: number
  xpts_rank: number
  xpts_flagged: boolean
}

export interface AccuracyPlayerGw {
  gw: number
  actual_pts: number
  xpts_predicted: number
  xpts_delta: number          // actual - predicted; negative = over-prediction
}

export interface AccuracyPlayer {
  player_id: number
  player_name: string
  team: string
  gws: AccuracyPlayerGw[]
}

export interface AccuracyBacktest {
  generated_at: string
  gws_covered: number[]       // [32, 31, 30, 29, 28] — most recent first
  summary: AccuracySummary
  haulters: AccuracyHaulter[]
  players: AccuracyPlayer[]
}

// Club form fixture (upcoming, per club) — populated by computeClubForm
export interface ClubFormFixture {
  opponent_team: string
  is_home: boolean
  event_id: number
  difficulty_score: number
  difficulty_tier: DifficultyTier
  attacking_difficulty: number   // Phase 27 — required (computed locally)
  defensive_difficulty: number   // Phase 27 — required
}

// Club form stats over rolling 5-game window (FFA-03; Phase 27 FIX-01)
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
  // Phase 27 FIX-01 — per-team ease aggregates over upcoming windows.
  // Convention: 1.0 = easiest, 0.0 = hardest (inverted from *_difficulty).
  // null when team has zero fixtures in the window (BGW handling).
  attacking_ease_1gw: number | null
  attacking_ease_3gw: number | null
  attacking_ease_5gw: number | null
  defensive_ease_1gw: number | null
  defensive_ease_3gw: number | null
  defensive_ease_5gw: number | null
}

// ---------------------------------------------------------------------------
// Planner types (Phase 21+)
// ---------------------------------------------------------------------------

export type PlannerHorizon = 1 | 2 | 3 | 4 | 5

export type PlannerChip = 'wildcard' | 'freehit' | 'bboost' | '3xc' | null

/** Free transfer state at a given gameweek */
export interface FTState {
  available: number    // FTs available to use this GW (1 or 2)
  banked: number       // FTs banked (0 or 1)
}

/** One gameweek step in the multi-GW plan */
export interface GWStep {
  gw: number                  // gameweek number
  chip: PlannerChip
  transfersIn: number[]       // player IDs being brought in
  transfersOut: number[]      // player IDs being sold
  freeTransfersAvailable: number
  hitCost: number             // 0 or negative (multiples of -4)
}

/** Top-level planner state (Phase 22+ will populate planSteps) */
export interface PlannerState {
  horizon: PlannerHorizon
  planSteps: GWStep[]         // length === horizon; empty in Phase 21
}

/** Scored transfer candidate within a plan step */
export interface ScoredTransfer {
  sellId: number
  buyId: number
  gwScore: number         // proj_pts_1gw delta for this GW (buy - sell) * fixtureCount
  lookAheadScore: number  // discounted GW+1 delta
  totalScore: number      // gwScore + lookAheadScore
  hitCost: number         // 0 or -4
  netGain: number         // totalScore + hitCost
  affordable: boolean
}

/** Extended GW step with engine output */
export interface PlanStep extends GWStep {
  scoredTransfers: ScoredTransfer[]  // top candidates considered
  squadAfter: number[]               // player IDs in squad after this step
  /** player ID -> FPL squad position (1-11 starting, 12-15 bench) */
  positionsAfter: Record<number, number>
  unconfirmedFixtures: boolean       // true if no fixture data exists for this GW
  /** WC/FH: total projected pts gain across all chip transfers (replaces scoredTransfers gain) */
  chipGain?: number
  /** BB: expected bench pts; 3xc: expected extra captain pts (added on top of transfer gain) */
  bbValue?: number
}

/** Complete plan result from generatePlan */
export interface PlanResult {
  steps: PlanStep[]
  readonly originalSteps: PlanStep[]  // frozen at generation time, never mutated
  horizon: PlannerHorizon
  startingGw: number                 // first GW in the plan
}

// Set-piece changes data (SP-01/SP-02)
export interface SetPieceTaker {
  id: number | null
  name: string
  changed: boolean
  now_cost?: number
  selected_by_percent?: string
  fixtures?: FixtureEntry[]
  roles?: string[]  // all primary roles this player holds for their team
}

export interface SetPieceTeam {
  team_id: number
  team_short_name: string
  penalty_taker: SetPieceTaker
  fk_taker: SetPieceTaker
  corner_taker: SetPieceTaker
}

export interface SetPieceChanges {
  has_changes: boolean
  change_count: number
  teams: SetPieceTeam[]
}

// Captain picks data (Phase 31 CAP-03/CAP-04 — pipeline writes pipeline/cache/captain_picks.json)
export interface CaptainPick {
  id: number
  name: string
  team: string                 // team_short_name (e.g. "ARS")
  position: string             // GK | DEF | MID | FWD
  now_cost: number             // tenths of £m (91 = £9.1m)
  xPts_1gw: number
  xPts_90th_1gw: number        // xPts_1gw + 1.28 * sigma_1gw (D-05)
  selected_by_percent: string  // FPL returns string ("12.4")
  eo_threshold_used?: number   // present only on eo_adjusted when a threshold (25.0 or 35.0) succeeded
}

export interface CaptainPicks {
  generated_at: string
  gameweek: number | null
  ceiling: CaptainPick | null
  eo_adjusted: CaptainPick | null
}

// Insights data (Phase 33 INS-01/INS-02/INS-03/INS-04 — pipeline writes pipeline/cache/insights.json)
// The pipeline emits a flat array of Insight (no wrapper object — D-12 + RESEARCH §A1).
// Tier badge (HIGH/MEDIUM/LOW) is derived client-side from confidence_pct (D-04).
export interface Insight {
  id: string                                              // stable pattern key (e.g. 'def_cs_home_vs_away')
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string                                       // human-readable, specific, non-trivial
  confidence_pct: number                                  // 0-100 (rounded to 1 d.p. by pipeline)
  sample_n: number                                        // numerator (how many times pattern held true)
  sample_total: number                                    // denominator (>= 10 enforced by pipeline D-03)
}
