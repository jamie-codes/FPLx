// @vitest-environment jsdom
// Phase 39 CMP-01..CMP-06 — PlayerComparisonModal failing test stubs (Wave 0 RED)
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ScoredPlayer } from '@/lib/types'

// jsdom does not implement HTMLDialogElement.showModal() — polyfill before rendering
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  }
})

// Fixture data — two complete ScoredPlayer mock objects with all fields populated
const PLAYER_A = {
  // Identity
  id: 1,
  web_name: 'Salah',
  team: 10,
  team_short_name: 'LIV',
  element_type: 3,
  // FPL core
  now_cost: 130,
  selected_by_percent: '12.3',
  form: '8.0',
  status: 'a',
  minutes: 2700,
  starts: 30,
  total_points: 200,
  goals_scored: 18,
  assists: 10,
  expected_goals: 15.2,
  expected_assists: 8.6,
  pts_last3gw: 24,
  pts_last5gw: 38,
  pts_gw_count: 5,
  defensive_contribution: null,
  clearances_blocks_interceptions: null,
  direct_freekicks_order: 1,
  penalties_order: 1,
  corners_and_indirect_freekicks_order: null,
  penalties_text: 'Penalty taker',
  direct_freekicks_text: 'FK taker',
  corners_and_indirect_freekicks_text: '',
  news: '',
  cost_change_event: 1,
  cost_change_start: 5,
  understat_id: 1250,
  xg_per90: 0.71,
  xa_per90: 0.55,
  minutes_per90: 90,
  form_pts_per90: 6.8,
  // Fixtures — using correct FixtureEntry fields
  fixtures: [
    { opponent_team: 'BUR', is_home: true, event_id: 35, difficulty_score: 0.2, difficulty_tier: 'easy' },
    { opponent_team: 'EVE', is_home: false, event_id: 36, difficulty_score: 0.5, difficulty_tier: 'medium' },
    { opponent_team: 'WHU', is_home: true, event_id: 37, difficulty_score: 0.2, difficulty_tier: 'easy' },
    { opponent_team: 'NEW', is_home: false, event_id: 38, difficulty_score: 0.7, difficulty_tier: 'hard' },
    { opponent_team: 'BHA', is_home: true, event_id: 39, difficulty_score: 0.5, difficulty_tier: 'medium' },
  ],
  xmins: 90,
  start_prob: 0.98,
  mins_risk: 'nailed',
  xPts_1gw: 6.4,
  xPts_3gw: 18.1,
  xPts_5gw: 29.6,
  xPts_ceiling_1gw: true,
  xPts_ceiling_3gw: false,
  xPts_ceiling_5gw: false,
  xPts_components_1gw: { goal_pts: 3.2, assist_pts: 1.1, cs_pts: 0.5, bonus_pts: 1.6, appearance_pts: 1.96 },
  regression_signal: 'buy',
  actual_vs_xg_delta: -1.2,
  differential_flag: 'diff',
  xPts_90th_1gw: 11.2,
  // ScoredPlayer scores
  gem_score: 0.82,
  fdr_score: 0.65,
  form_score: 0.78,
  xg_score: 0.71,
  xa_score: 0.55,
  ownership_score: 0.30,
  minutes_score: 0.95,
  set_piece_score: 0.90,
} as unknown as ScoredPlayer

const PLAYER_B = {
  // Identity
  id: 2,
  web_name: 'Haaland',
  team: 11,
  team_short_name: 'MCI',
  element_type: 4,
  // FPL core
  now_cost: 155,
  selected_by_percent: '52.6',
  form: '9.5',
  status: 'a',
  minutes: 2850,
  starts: 32,
  total_points: 240,
  goals_scored: 28,
  assists: 5,
  expected_goals: 25.8,
  expected_assists: 3.9,
  pts_last3gw: 28,
  pts_last5gw: 45,
  pts_gw_count: 5,
  defensive_contribution: null,
  clearances_blocks_interceptions: null,
  direct_freekicks_order: null,
  penalties_order: 1,
  corners_and_indirect_freekicks_order: null,
  penalties_text: 'Penalty taker',
  direct_freekicks_text: '',
  corners_and_indirect_freekicks_text: '',
  news: '',
  cost_change_event: 2,
  cost_change_start: 10,
  understat_id: 1300,
  xg_per90: 0.92,
  xa_per90: 0.30,
  minutes_per90: 88,
  form_pts_per90: 7.5,
  // Fixtures — using correct FixtureEntry fields
  fixtures: [
    { opponent_team: 'AVL', is_home: false, event_id: 35, difficulty_score: 0.5, difficulty_tier: 'medium' },
    { opponent_team: 'WOL', is_home: true, event_id: 36, difficulty_score: 0.2, difficulty_tier: 'easy' },
    { opponent_team: 'FUL', is_home: false, event_id: 37, difficulty_score: 0.5, difficulty_tier: 'medium' },
    { opponent_team: 'BOU', is_home: true, event_id: 38, difficulty_score: 0.2, difficulty_tier: 'easy' },
    { opponent_team: 'CHE', is_home: false, event_id: 39, difficulty_score: 0.7, difficulty_tier: 'hard' },
  ],
  xmins: 88,
  start_prob: 0.97,
  mins_risk: 'likely_start',
  xPts_1gw: 7.1,
  xPts_3gw: 20.4,
  xPts_5gw: 33.0,
  xPts_ceiling_1gw: true,
  xPts_ceiling_3gw: false,
  xPts_ceiling_5gw: false,
  xPts_components_1gw: { goal_pts: 4.5, assist_pts: 0.6, cs_pts: 0.0, bonus_pts: 2.0, appearance_pts: 1.94 },
  regression_signal: 'sell',
  actual_vs_xg_delta: 2.1,
  differential_flag: 'trap',
  xPts_90th_1gw: 12.8,
  // ScoredPlayer scores
  gem_score: 0.88,
  fdr_score: 0.55,
  form_score: 0.85,
  xg_score: 0.92,
  xa_score: 0.30,
  ownership_score: 0.10,
  minutes_score: 0.98,
  set_piece_score: 0.40,
} as unknown as ScoredPlayer

const MOCK_PLAYERS_RAW = [PLAYER_A, PLAYER_B]
const MOCK_SCORED_PLAYERS = [PLAYER_A, PLAYER_B]

// Mock usePlayers and computeAllGemScores — the modal fetches scoredPlayers internally
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: MOCK_PLAYERS_RAW, isLoading: false, error: null }),
}))
vi.mock('@/lib/gem-score', () => ({
  computeAllGemScores: () => MOCK_SCORED_PLAYERS,
}))

import { PlayerComparisonModal } from '@/components/gem-table/PlayerComparisonModal'

describe('PlayerComparisonModal — Phase 39 (CMP-01..CMP-06)', () => {
  it('renders modal in open state with playerA name visible (CMP-01)', () => {
    render(<PlayerComparisonModal open={true} playerA={PLAYER_A} onClose={() => {}} />)
    expect(screen.getByText('Compare Players')).toBeTruthy()
    expect(screen.getByText('Salah')).toBeTruthy()
  })

  it('search input filters scoredPlayers and selecting a result populates Player B (CMP-02)', () => {
    render(<PlayerComparisonModal open={true} playerA={PLAYER_A} onClose={() => {}} />)
    const search = screen.getByPlaceholderText(/search for a player/i) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'Haa' } })
    const haalandResult = screen.getByRole('button', { name: /Haaland/i })
    fireEvent.click(haalandResult)
    // After selection, Haaland should appear in the right column
    expect(screen.getAllByText('Haaland').length).toBeGreaterThan(0)
  })

  it('xPts section renders 1gw/3gw/5gw and 90th-percentile values for both players (CMP-03)', () => {
    render(<PlayerComparisonModal open={true} playerA={PLAYER_A} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search for a player/i), { target: { value: 'Haa' } })
    fireEvent.click(screen.getByRole('button', { name: /Haaland/i }))
    expect(screen.getByText('xPts Projection')).toBeTruthy()
    expect(screen.getByText('1 GW')).toBeTruthy()
    expect(screen.getByText('3 GW')).toBeTruthy()
    expect(screen.getByText('5 GW')).toBeTruthy()
    expect(screen.getByText(/Ceiling/i)).toBeTruthy()
    expect(screen.getByText('6.4')).toBeTruthy()   // PLAYER_A xPts_1gw
    expect(screen.getByText('7.1')).toBeTruthy()   // PLAYER_B xPts_1gw
    expect(screen.getByText('11.2')).toBeTruthy()  // PLAYER_A xPts_90th_1gw
    expect(screen.getByText('12.8')).toBeTruthy()  // PLAYER_B xPts_90th_1gw
  })

  it('Gem section renders composite + 7 component scores as 0-100 integers for both players (CMP-04)', () => {
    render(<PlayerComparisonModal open={true} playerA={PLAYER_A} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search for a player/i), { target: { value: 'Haa' } })
    fireEvent.click(screen.getByRole('button', { name: /Haaland/i }))
    expect(screen.getByText('Gem Scores')).toBeTruthy()
    // Eight rows: Gem, FDR, Form, xG, xA, Ownership, Minutes, Set Piece
    for (const label of ['Gem', 'FDR', 'Form', 'xG', 'xA', 'Ownership', 'Minutes', 'Set Piece']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    // PLAYER_A.gem_score 0.82 → '82'
    expect(screen.getAllByText('82').length).toBeGreaterThan(0)
    // PLAYER_B.gem_score 0.88 → '88'
    expect(screen.getAllByText('88').length).toBeGreaterThan(0)
  })

  it('Fixtures section renders FixtureBadges for both players (CMP-05)', () => {
    render(<PlayerComparisonModal open={true} playerA={PLAYER_A} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search for a player/i), { target: { value: 'Haa' } })
    fireEvent.click(screen.getByRole('button', { name: /Haaland/i }))
    expect(screen.getByText('Next Fixtures')).toBeTruthy()
    // Five fixtures × two players: BUR (PLAYER_A fixture) and AVL (PLAYER_B fixture)
    expect(screen.getAllByText(/BUR/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AVL/i).length).toBeGreaterThan(0)
  })

  it('Signals section renders BUY/SELL, DIFF/TRAP, and rotation-risk badges for both players (CMP-06)', () => {
    render(<PlayerComparisonModal open={true} playerA={PLAYER_A} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search for a player/i), { target: { value: 'Haa' } })
    fireEvent.click(screen.getByRole('button', { name: /Haaland/i }))
    expect(screen.getByText('Signals')).toBeTruthy()
    expect(screen.getByText(/BUY/i)).toBeTruthy()    // PLAYER_A regression_signal
    expect(screen.getByText(/SELL/i)).toBeTruthy()   // PLAYER_B regression_signal
    expect(screen.getByText(/DIFF/i)).toBeTruthy()   // PLAYER_A differential_flag
    expect(screen.getByText(/TRAP/i)).toBeTruthy()   // PLAYER_B differential_flag
  })
})
