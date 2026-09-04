import type { Page } from '@playwright/test'

/**
 * Minimal API stubs for the layout specs.
 *
 * Two reasons this exists rather than letting the specs hit the real routes:
 *
 * 1. Hermetic. The API routes read pipeline/cache/*.json, which is gitignored
 *    apart from a handful of small files — so on a clean checkout (CI, a fresh
 *    clone) /api/players 500s and the tabs render error states.
 * 2. Deterministic. Even locally the guard was measuring whatever stale cache
 *    happened to be on disk. An overflow audit should measure the same content
 *    every run, and it should measure CONTENT — a tab showing "failed to load"
 *    has nothing wide in it to overflow.
 *
 * Deliberately small: enough rows for a table to have a body, not a fixture of
 * the whole league.
 */

const TEAMS = ['ARS', 'MCI', 'LIV', 'MUN', 'CHE', 'NEW', 'AVL', 'BRE'] as const

function player(id: number) {
  const team = TEAMS[id % TEAMS.length]
  const elementType = ((id % 4) + 1) as 1 | 2 | 3 | 4
  return {
    id, code: 100000 + id, web_name: `Player${id}`, team: (id % TEAMS.length) + 1,
    team_short_name: team, team_code: 1, element_type: elementType,
    now_cost: 45 + (id % 60), selected_by_percent: `${(id % 40) + 1}.0`,
    form: '3.0', status: 'a', minutes: 900, starts: 10, total_points: 40 + id,
    goals_scored: id % 5, assists: id % 3, expected_goals: 1.5, expected_assists: 0.9,
    defensive_contribution: null, clearances_blocks_interceptions: null,
    direct_freekicks_order: null, penalties_order: null,
    corners_and_indirect_freekicks_order: null, penalties_text: '',
    direct_freekicks_text: '', corners_and_indirect_freekicks_text: '',
    news: '', news_added: '', chance_of_playing_next_round: null,
    cost_change_event: 0, cost_change_start: 0, understat_id: null,
    xg_per90: 0.3, xa_per90: 0.2, minutes_per90: 88, form_pts_per90: 3,
    pts_last3gw: 9, pts_last5gw: 15, pts_gw_count: 5, photo_url: null,
    fixtures: [1, 2, 3, 4, 5].map(gw => ({
      opponent_team: TEAMS[(id + gw) % TEAMS.length], is_home: gw % 2 === 0,
      event_id: gw, difficulty_score: ((id + gw) % 5) / 5,
      difficulty_tier: 'medium', attacking_difficulty: 0.5, defensive_difficulty: 0.5,
    })),
    xPts_1gw: 2 + (id % 6), xPts_3gw: 12, xPts_5gw: 20,
    xmins: 85, start_prob: 0.9, mins_risk: 'nailed',
  }
}

const PLAYERS = Array.from({ length: 40 }, (_, i) => player(i + 1))

const CALIBRATION_BUCKETS = [0.05, 0.15, 0.25, 0.35, 0.45].map((mid, i) => ({
  bucket_mid: mid, predicted_rate: mid, actual_rate: mid + (i % 2 ? 0.03 : -0.02), sample_n: 100 + i,
}))

// summary.gws drives the GW rows the audit settles on; the other summary keys
// are the model flags the header reads.
const GW_ROWS = [1, 2].map(gw => ({
  gw, haulter_count: 12 + gw, xpts_flagged: 4, xpts_blended_flagged: 3,
  xpts_hit_rate: 0.28, xpts_blended_hit_rate: 0.21,
  mid_tier_count: 20, mid_tier_flagged: 5,
  mid_tier_hit_rate: 0.25, mid_tier_blended_hit_rate: 0.23,
}))

const ACCURACY = {
  generated_at: '2026-09-01T00:00:00Z',
  gws_covered: [1, 2],
  summary: {
    xpts_hit_rate: 0.19, xpts_blended_hit_rate: 0.19,
    form_signal_enabled: false, xmins_v2_enabled: false,
    bonus_predictor_enabled: false, blend_alpha_used: 0.4,
    mid_tier_hit_rate: 0.22, mid_tier_blended_hit_rate: 0.23,
    gws: GW_ROWS,
  },
  haulters: [],
  players: [],
  versions: [],
  calibration: { by_position: { all: CALIBRATION_BUCKETS } },
}

/** Route the endpoints the audited tabs read. Unrouted endpoints fall through
 *  to the dev server, where an empty response is a legitimate state to measure. */
export async function stubApi(page: Page) {
  await page.route('**/api/players', r => r.fulfill({ json: PLAYERS }))
  await page.route('**/api/accuracy', r => r.fulfill({ json: ACCURACY }))
  await page.route('**/api/club-form', r => r.fulfill({ json: [] }))
  await page.route('**/api/last-updated', r => r.fulfill({ json: { generated_at: '2026-09-01T00:00:00Z' } }))
}
