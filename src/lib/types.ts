// Position codes used by FPL API: 1=GK, 2=DEF, 3=MID, 4=FWD
export type PositionCode = 1 | 2 | 3 | 4

// FPL player status codes
export type PlayerStatus = 'a' | 'd' | 'i' | 's' | 'u' | 'n'

// Validated FPL element (after Zod parsing, only consumed fields)
export interface FPLElement {
  id: number
  code: number
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
  news_added?: string                       // ISO timestamp when news was set (Phase 88 SCRAPER-01)
  chance_of_playing_next_round?: number | null  // 25/50/75/100 or null (healthy) (Phase 88 SCRAPER-01)
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
  deadline_time: string  // ISO 8601 — Phase 58 D-05
  data_checked: boolean  // Phase 98 D-06: gate for settled GW detection (finished && data_checked)
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
// Phase 52 MIN-01 — probability-derived label (additive; mins_risk preserved unchanged)
export type SubRiskLabel = 'nailed' | 'sub_risk' | 'rotation_risk' | 'cameo' | 'injured'

// Merged player from pipeline (D-06): FPL fields + Understat + form + fixtures
export interface MergedPlayer {
  // FPL core fields (from Phase 1 FPLElement)
  id: number
  code?: number         // stable player photo code (p{code}.png); absent on pre-pipeline cache
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
  news_added?: string                       // ISO timestamp when news was set (Phase 88 SCRAPER-01)
  chance_of_playing_next_round?: number | null  // 25/50/75/100 or null (healthy) (Phase 88 SCRAPER-01)
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
  // Minutes risk (Phase 7 — MINS-01)
  xmins: number               // expected minutes per GW (0-90)
  start_prob: number          // probability of starting next match (0.0-1.0)
  mins_risk: MinsRisk         // rotation risk classification
  mins_60_prob?: number          // Phase 52 MIN-01 — Bernoulli P(>=60 min | starts); optional during pipeline rollout
  sub_risk_label?: SubRiskLabel  // Phase 52 MIN-01 — probability-derived; additive; mins_risk preserved
  // xPts engine (Phase 28 DATA-02, XPTS-01, XPTS-02 — D-01..D-09).
  // Optional during pipeline rollout — same convention as Phase 27 attacking_difficulty.
  xPts_1gw?: number           // expected pts next 1 GW (Poisson goals/assists, Bernoulli CS, flat bonus)
  xPts_3gw?: number           // expected pts next 3 GWs (DGW-aware sum)
  xPts_5gw?: number           // expected pts next 5 GWs (DGW-aware sum)
  xPts_ceiling_1gw?: boolean  // true = top-tercile sigma in 1 GW window (high-ceiling)
  xPts_ceiling_3gw?: boolean  // true = top-tercile sigma in 3 GW window
  xPts_ceiling_5gw?: boolean  // true = top-tercile sigma in 5 GW window
  xPts_components_1gw?: {     // breakdown for 1 GW only (hover card data); null for BGW
    goal_pts: number
    assist_pts: number
    cs_pts: number
    bonus_pts: number
    appearance_pts: number    // Phase 48 XPT-01/XPT-02: start_prob × 2 per fixture
    save_pts?: number         // Phase 83 GK-01 — GK Poisson-floor save EV; pipeline writes 0.0 for non-GK / gate-OFF, >0 for gate-ON GK only
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
  // Phase 61 MC-01/MC-02: Monte Carlo simulation outputs (10,000 sims per player per GW).
  // Written by pipeline/simulate.py after merge_players(). Optional — absent on first
  // pipeline run before simulate.py is deployed. BGW players: blank_prob=1.0, haul_prob=0.0,
  // p10_pts=0.0, p90_pts=0.0. p90_pts also overwrites xPts_90th_1gw (D-05).
  blank_prob?: number     // P(total_pts <= 2) across 10k simulations; 1.0 for BGW
  haul_prob?: number      // P(total_pts >= 10) across 10k simulations; 0.0 for BGW
  p10_pts?: number        // 10th percentile simulated points (floor); 0.0 for BGW
  p90_pts?: number        // 90th percentile simulated points (ceiling); overwrites xPts_90th_1gw
  // Phase 90 MC-01: 5-GW cumulative uncertainty bands and position-relative rank trajectory.
  // Written by pipeline/simulate.py when mc_enabled=true. Absent when mc_enabled=false (D-01).
  // rank_trajectory[i] = percentile rank within same-position pool over GWs 1..i+1 (D-03).
  xPts_5gw_p10?: number       // 10th percentile cumulative 5-GW xPts (floor)
  xPts_5gw_p50?: number       // 50th percentile cumulative 5-GW xPts (≈ xPts_5gw deterministic, within 5%)
  xPts_5gw_p90?: number       // 90th percentile cumulative 5-GW xPts (ceiling)
  rank_trajectory?: number[]  // length-5 position-relative percentile rank [0,1] per GW horizon
  // ACC-05 (Phase 41 D-11): last GW actual points, joined into the player row by /api/players
  // from accuracy_backtest.json. Optional — null when player has no backtest entry; absent
  // before Phase 40 pipeline has run. NOT computed by pipeline/merge.py.
  last_gw_actual_pts?: number | null
  // Form signal (Phase 42 ACC-01): recency-weighted xG+xA per 90 over last 3-5 GWs.
  // Optional/nullable — null when player has fewer than 3 played GWs or fewer than 270 min in window.
  // Source: pipeline/merge.py:_compute_form_signal; written by merge_players when summaries dict is provided.
  form_xgxa_per90?: number | null
  form_xgxa_window_gws?: number       // count of GWs the form signal spans (3-5); 0 when form_xgxa_per90 is null
  // Phase 47 CS-01 (D-08/D-10): clean sheet probability for the next 1 GW fixture.
  // Optional during pipeline rollout (same convention as xPts_1gw). Range: 0.0–1.0.
  // BGW players: cs_prob_1gw = 0 (no fixture, no CS chance).
  // DGW players: combined probability `1 - (1-p1)*(1-p2)` aggregated across the GW group.
  // GK (element_type=1) and DEF (element_type=2) consume this field; MID/FWD show em-dash in UI.
  cs_prob_1gw?: number
  // Phase 76 RTP-01: routes to points (0–5) — count of distinct point-scoring routes held.
  // Routes: pen taker, direct FK taker, corner taker, above-median xG/90 in team,
  // above-median xA/90 in team. Optional during pipeline rollout; absent on pre-Phase-76 cache.
  routes_to_points?: number
  // Phase 80 GWI-01 (D-04): rotation risk flag — true when team has a European/cup
  // fixture within 3 days of an upcoming PL fixture. Computed in run.py post-merge step
  // by _apply_rotation_risk(). Optional during pipeline rollout; UI defaults to false.
  rotation_risk?: boolean
}

// Optimiser horizon (Phase 43 OPT-01..OPT-05) — maps to xPts_1gw / xPts_3gw / xPts_5gw fields
export type OptimiserHorizon = 1 | 3 | 5

// Optimised lineup result (Phase 43 OPT-01..OPT-05) — returned by optimiseLineup pure function
export interface OptimisedLineup {
  starters: number[]    // 11 element IDs
  bench: number[]       // 4 element IDs; bench[0] = non-starting GK
  captainId: number
  vcId: number
  formation: string     // e.g. '4-3-3' (DEF-MID-FWD, GK excluded)
}

// Transfer suggestion (Phase 45 TFR-01..TFR-03) — discriminated union for single
// transfers and 2-transfer combos. Returned by suggestTransfers() in src/lib/suggest-transfers.ts.
// Shape locked by .planning/phases/45-transfer-aware-mode/45-UI-SPEC.md §9.
//
// Engine invariants the UI relies on:
// - xPtsGain > 0 for every suggestion (engine MUST filter non-positive gains).
// - breakEvenGws === null if and only if cost === 0.
// - breakEvenGws >= 1 when present (engine MUST clamp to a minimum of 1).
// - All suggestions are budget-feasible (D-10 hard filter applied upstream).
export type TransferSuggestion =
  | {
      kind: 'single'
      sell: MergedPlayer
      buy: MergedPlayer
      cost: 0 | 4              // 0 = FREE, 4 = -4pt hit
      xPtsGain: number          // always > 0 (filtered by engine)
      xPtsGainPerGw: number     // xPtsGain / horizon
      breakEvenGws: number | null  // ceil(4 / xPtsGainPerGw) when cost > 0; null when FREE
    }
  | {
      kind: 'combo'
      transfers: [
        { sell: MergedPlayer; buy: MergedPlayer },
        { sell: MergedPlayer; buy: MergedPlayer }
      ]
      cost: 0 | 4 | 8          // 0 = FREE (both within ftCount), 4 = one hit, 8 = two simultaneous hits (−8pts)
      xPtsGain: number
      xPtsGainPerGw: number
      breakEvenGws: number | null
    }

// Chip modes (Phase 46 CHIP-01..CHIP-03) — selector state in OptimiserPanel (D-04).
// 'none' = current behaviour; 'wildcard' / 'free-hit' call buildOptimalSquad();
// 'bench-boost' calls optimiseLineup() with modified headline.
export type ChipMode = 'none' | 'wildcard' | 'free-hit' | 'bench-boost'

// Single player in a chip squad result (slimmer than MergedPlayer — only fields needed for ChipSquadView).
export interface ChipSquadPlayer {
  id: number
  web_name: string
  element_type: PositionCode
  team: number
  now_cost: number      // tenths of £1m
  xPts: number          // scored by the active horizon at build time
}

// Result returned by buildOptimalSquad() in src/lib/chip-modes.ts (D-10).
// null returned instead when < 15 eligible players found (D-06).
export interface ChipSquadResult {
  squad: ChipSquadPlayer[]  // all 15 players (XI + bench)
  bestXI: number[]          // 11 element IDs derived from optimiseLineup() call
  formation: string         // e.g. '4-3-3' (outfield only, GK excluded per optimise-lineup.ts convention)
  budgetUsed: number        // tenths of £1m (sum of now_cost of all 15 players)
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
// Field naming matches the JSON exactly (lowercase snake_case for xpts_*).
export interface AccuracyGwSummary {
  gw: number
  haulter_count: number
  xpts_flagged: number
  xpts_hit_rate: number   // 0.0-1.0
  // Phase 42 ACC-02 — blended track (optional; absent on pre-Phase-42 backtest files)
  xpts_blended_flagged?: number
  xpts_blended_hit_rate?: number
  // Phase 42 ACC-04 — mid-tier (6-9 pt) track
  mid_tier_count?: number
  xpts_mid_flagged?: number
  xpts_blended_mid_flagged?: number
  mid_tier_hit_rate?: number
  mid_tier_blended_hit_rate?: number
}

export interface AccuracySummary {
  xpts_hit_rate: number
  gws: AccuracyGwSummary[]
  // Phase 42 ACC-02 / ACC-03 / ACC-04 — optional, present in Phase-42+ backtest files
  xpts_blended_hit_rate?: number
  form_signal_enabled?: boolean      // gate flag controlling next merge_players run
  blend_alpha_used?: number          // alpha used in the blend (default 0.4)
  mid_tier_hit_rate?: number
  mid_tier_blended_hit_rate?: number
  // Phase 52 / 53 / 63 — gate flags written to JSON but missing from earlier type:
  xmins_v2_enabled?: boolean         // Phase 52 D-02 gate (preserved across runs)
  bonus_predictor_enabled?: boolean  // Phase 53 BPS-01 gate (preserved across runs)
  save_predictor_enabled?: boolean   // Phase 83 GK-01 gate (preserved across runs)
  news_flag_enabled?: boolean        // Phase 88 SCRAPER-01 gate (default true; kill switch)
  mc_enabled?: boolean               // Phase 90 MC-01: 5-GW MC simulation gate (default false)
  calibration_mode?: 'mc' | 'analytical'  // Phase 109 MC-CAL-01: written by pipeline; reads as 'mc' when MC_ENABLED AND coverage >= 80%
}

export interface AccuracyHaulter {
  gw: number
  player_id: number
  player_name: string
  actual_pts: number
  xpts_predicted: number
  xpts_rank: number
  xpts_flagged: boolean
  // Phase 42 ACC-02 — optional blended fields
  xpts_blended_predicted?: number
  xpts_blended_rank?: number
  xpts_blended_flagged?: boolean
}

export interface AccuracyPlayerGw {
  gw: number
  actual_pts: number
  xpts_predicted: number
  xpts_delta: number          // actual - predicted; negative = over-prediction
  // Phase 42 ACC-02 — optional blended fields
  xpts_blended_predicted?: number
  xpts_blended_delta?: number
  // Phase 76 ACC2-01 — true when model put this player in predicted top-N for this GW
  // (mirrors xpts_flagged on AccuracyHaulter; sourced from xpts_rank <= TOP_N_PREDICTED in pipeline/accuracy.py)
  xpts_flagged?: boolean
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
  // Phase 63 — optional for backward compat with legacy cache pre-dating VER-01/CAL-01:
  versions?: VersionRecord[]
  calibration?: CalibrationData
}

// ============================================================================
// Phase 82: Data Health Dashboard (DH-01/02/03)
// ============================================================================

export type SanityCheckId =
  | 'player_count'
  | 'missing_player_delta'
  | 'understat_null_pct'
  | 'pipeline_stale'

export type SanityCheckStatus = 'ok' | 'warn' | 'error'

export interface SanityCheck {
  id: SanityCheckId
  status: SanityCheckStatus
  value: number | boolean
  threshold: string
}

export interface DataHealth {
  generated_at: string                      // ISO 8601 UTC
  timestamps: Record<string, string>        // artifact name -> ISO UTC
  total_player_count: number
  prev_player_count: number | null          // null on first run (D-16)
  missing_player_delta: number              // absolute delta (Pitfall 3)
  understat_id_null_count: number
  fpl_proxy_fallback_count: number
  xg_per90_null_count: number
  sanity_checks: SanityCheck[]
  history?: HistoryEntry[]                  // Phase 92 DH-04 — optional; absent on legacy cache (pre-Phase-92)
}

export interface HistoryEntry {
  timestamp: string                         // ISO-8601 UTC
  overall_status: 'ok' | 'warning' | 'error'
}

// ============================================================================
// Phase 63: Model Versioning & Calibration Charts (VER-01/VER-02/CAL-01/CAL-02)
// ============================================================================

export interface VersionGateFlags {
  xmins_v2_enabled: boolean
  bonus_predictor_enabled: boolean
  form_signal_enabled: boolean
  save_predictor_enabled: boolean
  mc_enabled: boolean          // Phase 90 MC-01: 5-GW MC simulation gate
}

export interface VersionRecord {
  formula_version: string
  recorded_at: string    // ISO timestamp from datetime.now(timezone.utc).isoformat()
  hit_rate: number       // 0..1 (rounded to 4 decimals by accuracy.py)
  gate_flags: VersionGateFlags
  sample_gws?: number   // Phase 116 VER-01: count of finished GWs contributing to hit_rate; optional for backward compat — UI defaults ?? 0
}

export interface CalibrationBucket {
  bucket_mid: number       // 0.05..0.95 (decile midpoint)
  predicted_rate: number   // analytical: equals bucket_mid; MC mode (Phase 109): mean(haul_prob) per bucket
  actual_rate: number      // observed haul rate (actual_pts >= 10) for this bucket
  sample_n: number         // observation count; only buckets with n >= 5 are included
  // Phase 91 CAL-01 (D-06): optional for legacy-cache compat — Phase 63 caches lack these fields.
  predicted_mean?: number  // mean xpts_predicted within decile (rounded 2dp by pipeline)
  actual_mean?: number     // mean actual_pts within decile (rounded 2dp by pipeline)
}

export interface CalibrationData {
  by_position: {
    all: CalibrationBucket[]
    '1': CalibrationBucket[]    // 1 = GK
    '2': CalibrationBucket[]    // 2 = DEF
    '3': CalibrationBucket[]    // 3 = MID
    '4': CalibrationBucket[]    // 4 = FWD
  }
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
  upcoming_fixtures: ClubFormFixture[]   // next 32
  current_gw_played: ClubFormFixture[]   // Phase 111 FIX-01 — finished fixtures from active GW only
  // Phase 27 FIX-01 — per-team ease aggregates over upcoming windows.
  // Convention: 1.0 = easiest, 0.0 = hardest (inverted from *_difficulty).
  // null when team has zero fixtures in the window (BGW handling).
  attacking_ease_1gw: number | null
  attacking_ease_3gw: number | null
  attacking_ease_5gw: number | null
  defensive_ease_1gw: number | null
  defensive_ease_3gw: number | null
  defensive_ease_5gw: number | null
  // Phase 47 SWG-01..SWG-03 (D-03/D-04/D-05): fixture swing computation.
  // past_ease_3gw is computed from the most recent 3 finished fixtures using the same
  // meanEase() helper used for the upcoming windows; null when fewer than 3 finished
  // fixtures with attacking_difficulty exist (early season). The swing deltas use
  // attacking ease (D-04) and are null when either side of the subtraction is null.
  past_ease_3gw: number | null
  swing_1gw: number | null   // attacking_ease_1gw - past_ease_3gw
  swing_3gw: number | null   // attacking_ease_3gw - past_ease_3gw
  swing_5gw: number | null   // attacking_ease_5gw - past_ease_3gw
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
  gwScore: number         // xPts_1gw delta for this GW (buy - sell) * fixtureCount
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

// Set-piece changes data (SP-01/SP-02; SPQ-03 sp_quality fields added in Phase 85)
export interface SetPieceTaker {
  id: number | null
  name: string
  changed: boolean
  now_cost?: number
  selected_by_percent?: string
  fixtures?: FixtureEntry[]
  roles?: string[]  // all primary roles this player holds for their team
  // SPQ-03 (Phase 85 D-03): sp_quality fields merged from sp_quality.json by /api/set-pieces.
  // All optional — omitted entirely when sp_quality.json is missing or taker has no entry.
  corner_danger_score?: number | null
  fk_danger_score?: number | null
  delivery_quality_rank?: number | null
  sp_sample_n?: number | null
  sp_tier?: 'Elite' | 'Good' | 'Weak' | null
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

// Price change predictions (Phase 54 PRC-01 — pipeline/cache/price_changes.json)
export type PriceDirection = 'rise' | 'fall' | 'stable'

export interface PriceChangePrediction {
  player_id: number
  name: string             // web_name from bootstrap
  team: string             // team_short_name (e.g. "ARS")
  now_cost: number         // tenths of £1m (e.g. 91 = £9.1m)
  direction: PriceDirection
  confidence_pct: number   // 0–100; clamp(cumulative_net / threshold, 0, 1) × 100
  eta_days: number         // 0 = "Tonight"; max(0, threshold - net) / avg_velocity
  cumulative_net: number   // raw cumulative net transfers since last price change
  selected_by_percent: string  // FPL string e.g. "12.5"
}

export interface PriceChanges {
  generated_at: string     // ISO 8601 timestamp
  current_gw: number       // bootstrap['events']['current']['id'] or 0
  snapshot_days: number    // count of distinct ISO dates; < 14 = "early data" (D-06)
  predictions: PriceChangePrediction[]  // empty array on cold start (D-05)
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

// Phase 96 BACK-01: Captain decision backtester types.
// Sources of truth:
//   .planning/phases/96-captain-decision-backtester/96-CONTEXT.md §D-06, D-08, D-09, D-10
//   .planning/phases/96-captain-decision-backtester/096-PATTERNS.md §src/lib/types.ts

/**
 * Per-GW captain snapshot payload (captain_picks_gw{N}.json on Blob).
 * D-09: reuses the existing CaptainPicks schema verbatim.
 */
export type CaptainPickSnapshot = CaptainPicks

/**
 * One entry in the regret timeline — one per GW (D-10 allows pre-deployment rows
 * where hasSnapshot is false; SC-5 allows unauthenticated rows where userCaptainPts is null).
 */
export interface RegretEntry {
  gw: number
  // User's actual captain (from FPL picks API — null when unauthenticated or 404)
  userCaptainId: number | null
  userCaptainName: string | null
  userCaptainPts: number | null       // raw player points (regret formula doubles this)
  // Model's ceiling pick (from captain_picks_gw{N}.json — null when no snapshot exists)
  modelCeilingId: number | null
  modelCeilingName: string | null
  modelCeilingPts: number | null      // raw player points (regret formula doubles this)
  // D-10: false = pre-deployment GW (no captain_picks_gw{N}.json in Blob)
  hasSnapshot: boolean
  // D-06: signed regret in captain points = ceiling_pts*2 − user_capt_pts*2
  //   regret > 0 → model was better (user lost points)
  //   regret < 0 → user beat the model
  //   regret === 0 → tied
  //   regret === null → at least one side unavailable
  regret: number | null
}

// Phase 113 BACK-02: Transfer regret backtester types.

export interface SlimPlayer {
  id: number
  element_type: 1 | 2 | 3 | 4
  web_name: string
  team: number
  now_cost: number
  selected_by_percent: string
  xPts_1gw?: number
  xPts_3gw?: number
  xPts_5gw?: number
}

export interface TransferRegretEntry {
  gw: number
  hasSnapshot: boolean            // false = no merged_players_slim_gw{N}.json for this GW
  // Engine recommendation (from suggestTransfers post-hoc)
  engineSell: string[] | null     // web_name(s); null when no snapshot
  engineBuy: string[] | null
  engineSellPts: number[] | null  // actual pts for engine OUT player(s)
  engineBuyPts: number[] | null
  // User's actual transfer (from FPL event_transfers)
  isHold: boolean                 // true = user made no transfer this GW
  userSell: string[] | null       // null when isHold or unavailable
  userBuy: string[] | null
  userSellPts: number[] | null
  userBuyPts: number[] | null
  // Signed delta (D-06/D-07); null when no snapshot or actual pts unavailable
  delta: number | null
}

/**
 * Full response shape from GET /api/decision-history?teamId={id}.
 * entries are ordered GW ascending and include pre-deployment rows (D-10).
 */
export interface DecisionHistory {
  teamId: number
  gwsWithData: number           // count of GWs where regret is non-null
  entries: RegretEntry[]
  transferEntries?: TransferRegretEntry[]  // Phase 113 BACK-02 extension
}

/**
 * Phase 100 HIST-02: one chip ROI entry. BB / TC / FH only — Wildcard excluded (D-04).
 * Comparison metric: gwPoints − seasonAvgPoints (D-05).
 */
export interface ChipRoiEntry {
  chipName: 'bboost' | '3xc' | 'freehit'
  event: number             // gameweek the chip was played
  gwPoints: number          // actual GW score in the chip GW
  seasonAvgPoints: number   // manager's season average GW score (D-05)
  delta: number             // gwPoints − seasonAvgPoints (positive = chip paid off)
}

/**
 * Phase 100 HIST-03: one hit transfer break-even record.
 * Break-even (D-07): cumulative points from `event` GW inclusive through GW 38;
 * a hit broke even if `elementInPts > elementOutPts + 4`. Hit GWs identified by
 * `event_transfers_cost > 0` cross-referenced with `/entry/{id}/transfers/` (D-08).
 * Per-player `/element-summary/{id}/` failures fold to null fields (partial-failure
 * pattern from decision-history route).
 */
export interface HitTrackingEntry {
  event: number                  // gameweek the hit was taken
  elementIn: number              // FPL element ID of player bought
  elementOut: number             // FPL element ID of player sold
  elementInName: string | null   // bootstrap web_name; null if element-summary fetch failed
  elementOutName: string | null
  elementInPts: number | null    // cumulative pts from event GW onwards; null on fetch failure
  elementOutPts: number | null
  netPts: number | null          // elementInPts − elementOutPts − 4; null if either side null
  brokeEven: boolean | null      // netPts > 0; null if netPts is null
}

/**
 * Phase 100: full response shape from GET /api/season-analytics?teamId={id}.
 * chipRoi ordered by `event` ascending; hitTracking ordered by `event` ascending
 * (multi-hit GWs render one entry per transfer pair — see UI-SPEC §HIST-03).
 */
export interface SeasonAnalytics {
  chipRoi: ChipRoiEntry[]
  hitTracking: HitTrackingEntry[]
}

/**
 * Phase 124 REV-01 / REV-03: one GW entry in the season-review chart and tooltip.
 * D-01: chart primary y-axis is GW points; overall rank in tooltip only.
 * D-02: avgManagerScore sourced from FPL bootstrap events[].average_entry_score.
 * D-03: populated by /api/season-review route from /entry/{teamId}/history/ + bootstrap.
 * D-04: route returns raw history stats only — no captainHits / captainGwsWithData here.
 */
export interface SeasonGwEntry {
  gw: number
  points: number             // user's actual GW score
  avgManagerScore: number    // FPL events[].average_entry_score for this GW
  overallRank: number        // user's overall rank after this GW
  chipPlayed: string | null  // chip slug ('bboost'|'3xc'|'freehit'|'wildcard') or null
}

/**
 * Phase 124 REV-01: full response from GET /api/season-review?teamId={id}.
 * D-01..D-04: see CONTEXT.md decisions.
 * D-04: captain hit rate is derived client-side via computeSeasonSummary on
 *   useDecisionHistory data — NOT included here to avoid 38-GW picks fetch overhead.
 */
export interface SeasonReview {
  totalPoints: number
  finalRank: number          // overall_rank from the last current[] entry
  bestGw: { gw: number; points: number }
  worstGw: { gw: number; points: number }
  transferNetPoints: number  // sum of -(event_transfers_cost) — negative means hits taken
  gwData: SeasonGwEntry[]    // ordered GW1..GW38 (only GWs that have played)
}

// Insights data (Phase 33 INS-01..INS-06 — pipeline writes pipeline/cache/insights.json)
// Extended in Phase 79 (Plan 02): 10 new structured fields + signal_label emitted by pipeline.
// The pipeline emits a flat array of Insight (no wrapper object).

export type SignalLabel =
  | 'Strong signal'
  | 'Watchlist'
  | 'Weak signal'
  | 'Trap risk'
  | 'Regression risk'
  | 'Hidden gem'

export interface Insight {
  // Existing 6 fields (kept for backwards compat — D-03)
  id: string                                              // stable pattern key (e.g. 'def_cs_home_vs_away')
  category: 'defensive' | 'attacking' | 'player' | 'captaincy'
  statement: string                                       // human-readable, specific, non-trivial
  confidence_pct: number                                  // 0-100 (rounded to 1 d.p. by pipeline)
  sample_n: number                                        // numerator (how many times pattern held true)
  sample_total: number                                    // denominator (>= 10 enforced by pipeline D-03)
  // New structured fields (D-01, Phase 79)
  title: string                                           // short card heading (e.g. "Home Clean Sheet Advantage")
  metric_value: number                                    // headline number (float, 0-100)
  metric_label: string                                    // axis/unit label (e.g. "CS rate at home")
  takeaway: string                                        // plain-English meaning sentence
  action_hint: string                                     // verb-led ≤7-word recommendation
  benchmark_value: number                                 // reference line for progress bar (float, 0-100)
  gw_coverage: string                                     // e.g. "GW1–34"
  player_ids: number[]                                    // FPL player IDs (empty list if not player-specific)
  team_ids: number[]                                      // FPL team IDs (empty list if not team-specific)
  player_names: string[]                                  // web_name per player_id — embedded by pipeline
  team_names: string[]                                    // short_name per team_id — embedded by pipeline
  // Signal label (D-04/D-05) — emitted by pipeline, not derived client-side
  signal_label: SignalLabel
}

// Phase 80 (GWI-02..GWI-04) — GW-specific intelligence cards
// Source: pipeline/gw_intel.py compute_gw_intel() output schema
// The pipeline emits a wrapper object: { cards: GWInsight[], team_stakes: [...], generated_at: string }

export type TableStakesLabel =
  | 'title battle'
  | 'European chase'
  | 'relegation battle'
  | 'nothing-to-play-for'

export interface PositionOpportunityCard {
  type: 'position_opportunity'
  id: string
  gw_label: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  narrative: string
}

export interface RotationRiskCard {
  type: 'rotation_risk'
  id: string
  gw_label: string
  team_id: number
  team_short_name: string
  competition: string
  table_stakes_label: TableStakesLabel | null
}

export interface DGWBGWCard {
  type: 'dgw_bgw'
  id: string
  gw_label: string
  team_id: number
  team_short_name: string
  is_dgw: boolean
}

export interface FixtureRunCard {
  type: 'fixture_run'
  id: string
  gw_label: string
  player_id: number
  web_name: string
  narrative: string
  gw_xpts: number[]
  gw_numbers: number[]
  is_dgw: boolean[]
}

export type GWInsight =
  | PositionOpportunityCard
  | RotationRiskCard
  | DGWBGWCard
  | FixtureRunCard

export interface GWIntelResponse {
  cards: GWInsight[]
  team_stakes: Array<{ team_id: number; team_short_name: string; label: TableStakesLabel }>
  generated_at: string
}

// Phase 58 (ML-01..ML-08) — Mini-League Rival Tracker.
// Source: .planning/phases/058-mini-league-rival-tracker/058-CONTEXT.md §decisions D-03, D-07, D-12
//         .planning/phases/058-mini-league-rival-tracker/058-RESEARCH.md §Architecture Patterns

/**
 * One pick from a rival's GW lineup. Mirrors SquadPick but is namespaced for clarity:
 * the rival picks endpoint returns the same shape as `entry/{id}/event/{gw}/picks/`.
 * Stored on RivalEntry.picks as the raw pick list (15 entries: 11 starters + 4 bench).
 */
export interface RivalPick {
  element: number          // FPL player ID
  position: number         // 1..15 (lineup slot)
  multiplier: number       // 0=bench, 1=starter, 2=captain, 3=triple captain
  is_captain: boolean
  is_vice_captain: boolean
}

/**
 * One rival manager and their hydrated GW data.
 *
 * Fields:
 * - entryId: FPL `entry` ID (manager's team ID).
 * - entryName: team name (FPL `entry_name`).
 * - playerName: real-name (FPL `player_name`).
 * - rank: rival's rank within the mini-league (1-indexed).
 * - rankGap: rival.rank - userRank. Negative = user is ranked higher (better);
 *            positive = user is ranked lower (worse). Mirrors UI-SPEC.md sign convention
 *            ("+N green = user ahead"); the UI flips sign for display.
 * - picks: the 15-pick array from the GW picks endpoint (raw shape).
 * - captainPlayerId: post-deadline only — the FPL element ID of the rival's captain.
 *                    `null` when current event's deadline_time is in the future
 *                    (D-05 deadline gate applied inside `useRivals`).
 * - chipsRemaining: derived from history — array of unplayed chip names from
 *                    ['bboost','3xc','freehit','wildcard'].
 */
export interface RivalEntry {
  entryId: number
  entryName: string
  playerName: string
  rank: number
  rankGap: number
  picks: RivalPick[]
  captainPlayerId: number | null
  chipsRemaining: string[]
}

/**
 * Result returned by the `useRivals` hook.
 * - rivals: up to MAX_RIVALS (20) entries, in standings rank order.
 * - leagueTruncated: true when the league had > 20 entries and we capped (ML-08).
 *                    Triggers the "Showing first 20 rivals…" note in the UI.
 */
export interface RivalLeagueResult {
  rivals: RivalEntry[]
  leagueTruncated: boolean
}

// Phase 67 NLP-01/NLP-02 — LLM prose summary types
export interface ProseSummary {
  prose: string
  gw: number
  generated_at: string  // ISO 8601 UTC
}

export interface ProseRefreshPayload {
  gw: number
  captains: ReadonlyArray<{ name: string; team: string; xPts_1gw: number | null }>
  transfer: { sell: string; buy: string; delta: number } | null
  chip: { code: 'bboost' | '3xc' | 'freehit' | 'wildcard' | null; bestGw: number | null }
  risks: ReadonlyArray<{ name: string; label: string }>
}

// Phase 105 NLP-02 — Per-player LLM insight types
// PlayerInsightRequest: POST body sent to /api/player-insight
export interface PlayerInsightRequest {
  gw: number
  player: {
    id: number
    web_name: string
    element_type: PositionCode
    haul_prob?: number   // MC field — present when mc_enabled=true in pipeline
    blank_prob?: number  // MC field — present when mc_enabled=true in pipeline
    p10_pts?: number     // MC field — present when mc_enabled=true in pipeline
    p90_pts?: number     // MC field — present when mc_enabled=true in pipeline
  }
  rejection_reasons: string[]
  fragility: { tier: 'robust' | 'fragile' | 'knife_edge'; reasons: string[] }
  lifecycle_label?: string  // optional — absent when lifecycle not computed
}

// PlayerInsightResponse: JSON body returned by POST /api/player-insight on success
export interface PlayerInsightResponse {
  prose: string
  player_id: number
  gw: number
  generated_at: string  // ISO 8601 UTC
}

// Phase 73 PGW-01 / PGW-02: Post-GW Review (D-05..D-08 in 073-CONTEXT.md)
// Phase 98 PGW-01: best bench player surfaced as info row (D-08, D-09 in 098-CONTEXT.md)
// Returned by GET /api/gw-review?teamId=&gw= ; consumed by useGwReview + GwReviewTab.
export interface GwReview {
  gw: number                       // Settled gameweek number (matches the ?gw= query param)
  your_score: number               // entry_history.points - your GW score
  bench_pts_left: number           // entry_history.points_on_bench - D-05; do NOT recompute from individual picks
  captain_name: string             // web_name of pick where is_captain === true
  optimal_captain_name: string     // web_name of pick with highest total_points among starting XI (position <= 11)
  captain_delta: number            // (optimal_captain_pts * 2) - (your_captain_pts * your_captain_multiplier); clamped >= 0 (D-06)
  top_scorer_name: string          // web_name of pick with highest total_points among starting XI (position <= 11)
  top_scorer_pts: number           // that pick's total_points
  average_score: number            // FPL average - from gw_review_gw{N}.json (D-08); labelled "FPL average", NOT "top-10k"
  best_bench_player_name: string   // Phase 98 D-09 / PGW-01: web_name of highest-scoring bench pick (position > 11); '—' when bench is empty
  best_bench_player_pts: number    // Phase 98 D-09 / PGW-01: that pick's total_points; 0 when bench is empty
  // Phase 99 PGW-03: benchmark comparison + template player misses
  benchmark_score: number            // dream-team total pts; falls back to average_score when endpoint fails
  benchmark_label: string            // 'Dream team' | 'FPL average' (degraded fallback)
  missed_players: { name: string; pts: number }[]  // ≤3 dream-team players not in squad; [] when none
}

// ============================================================================
// Phase 117: Lineup News Artifact (SCRP-01..SCRP-06, INFRA-01..INFRA-02)
// ============================================================================

export type LineupNewsSource = 'fpl' | 'premierleague' | 'skysports' | 'bbc' | null

export type StatusLabel = 'confirmed_start' | 'doubted' | 'confirmed_absent' | 'unknown'

export interface LineupNewsPlayer {
  id: number
  availability_factor: 1.0 | 0.75 | 0.5 | 0.25 | 0.0 | null  // null = unknown status
  status_label: StatusLabel
  news_headline: string | null    // null when no web scraper match found
  news_source: LineupNewsSource   // null when no web scraper match found
  scraped_at: string              // ISO 8601 UTC
}

export interface SourceHealth {
  ok: boolean
  last_success: string | null     // ISO 8601 UTC or null
  last_error: string | null       // error message truncated to 200 chars
}

export interface LineupNews {
  scraped_at: string              // ISO 8601 UTC — pipeline run timestamp
  players: LineupNewsPlayer[]
  source_health: {
    fpl: SourceHealth
    premierleague: SourceHealth
    skysports: SourceHealth
    bbc: SourceHealth
  }
}

// Phase 123: Transfer News Artifact (SCR-01..SCR-05, WIN-03)
// ============================================================================

export type TransferClass =
  | 'confirmed_signing'
  | 'rumour'
  | 'injury_return'
  | 'rotation_signal'
  | 'general'

export interface TransferNewsArticle {
  title: string
  summary: string | null
  url: string
  published: string | null          // ISO 8601 or null if feed doesn't provide
  source: 'skysports' | 'bbc'
  classification: TransferClass
  element_id: number | null         // null = unmatched player or no player mentioned
  scraped_at: string                // ISO 8601 UTC
}

export interface TransferNewsFeed {
  scraped_at: string                // ISO 8601 UTC — pipeline run timestamp
  articles: TransferNewsArticle[]
  source_health: {
    skysports: SourceHealth         // reuses SourceHealth defined at line 1016
    bbc: SourceHealth
  }
}
