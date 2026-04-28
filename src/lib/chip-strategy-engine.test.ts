// Phase 34: chip-strategy-engine — pure function unit tests + Wave 0 stub
// Wave 0: stub created by Plan 01 to satisfy Nyquist rule.
// Plan 01 Task 3 fills in real test cases.
import { describe, it } from 'vitest'

describe('Phase 34: chip-strategy-engine', () => {
  describe('buildClubFormMap', () => {
    it.todo('returns Map keyed by team_id with upcoming_fixtures arrays')
  })
  describe('computeBBScore (CHIP-01)', () => {
    it.todo('returns 5 GWEaseScore entries for the next 5 GWs')
    it.todo('uses attacking_difficulty inverted to ease (ease = 1 - attacking_difficulty)')
    it.todo('falls back to BGW_NEUTRAL_EASE when a bench player has no fixture for the target GW')
    it.todo('marks the highest-ease GW as the recommended best GW')
  })
  describe('computeTCScore (CHIP-02)', () => {
    it.todo('selects top-3 candidates by xPts_90th_1gw, excluding GKs and injured players')
    it.todo('falls back to xPts_1gw then proj_pts_1gw when xPts_90th_1gw is undefined')
    it.todo('scores each GW by the best candidate\'s fixture ease that week')
  })
  describe('computeFHResult (CHIP-03)', () => {
    it.todo('returns 15 players obeying formation: 2 GK + 3-5 DEF + 2-5 MID + 1-3 FWD')
    it.todo('respects 3-player team cap')
    it.todo('respects budget = bankBalance + sum(sellPrices ?? now_cost)')
    it.todo('selects the GW where weighted top-11 xPts is maximised as bestGw')
  })
})
