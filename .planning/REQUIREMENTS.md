# Requirements: FPL Analyst v1.19

**Defined:** 2026-05-14
**Core Value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## v1.19 Requirements

### AI Insight Batch Delivery

- [x] **NLP-BATCH-01**: Pipeline pre-generates insights for the top 20 players by `xPts_1gw` after each daily run and writes them to Vercel Blob (`player_insights/gw{N}/element_{id}.json`) — Validated in Phase 108
- [x] **NLP-BATCH-02**: Batch generation is gated by `INSIGHT_BATCH_ENABLED` env var so cost can be controlled independently of the daily pipeline — Validated in Phase 108
- [x] **NLP-BATCH-03**: UI reads Blob-cached insights transparently — on-demand generation still fires on cache miss (existing two-tier cache handles this; no UI change required) — Validated in Phase 108

### MC-Enabled Calibration

- [x] **MC-CAL-01**: Calibration pipeline uses MC `haul_prob` (P(pts ≥ 10) from 10k sims) as `predicted_rate`, replacing the analytical xPts decile-rank proxy — gated by existing `mc_enabled` flag in `accuracy_backtest.json` — Validated in Phase 109
- [x] **MC-CAL-02**: `CalibrationHealthIndicator` surfaces MC-based calibration evidence with a label distinguishing MC mode from the analytical fallback — Validated in Phase 109

### NLP-02 Prompt Caching

- [x] **CACHE-01**: `/api/player-insight` adds `cache_control: {"type": "ephemeral"}` to the system prompt message block in the Anthropic API call — Validated in Phase 107
- [x] **CACHE-02**: API response `usage.cache_creation_input_tokens` and `cache_read_input_tokens` are logged server-side so cache hit rate is observable in Vercel logs — Validated in Phase 107

### Code Quality Cleanup

- [x] **WR-01**: Remove duplicate transition classes on Load Squad button in `DecisionSummaryTab.tsx` — Validated in Phase 106
- [x] **WR-02**: `decision-severity.ts` captain card returns `LOW` (not `MEDIUM`) when `candidates.length < 2` — Validated in Phase 106
- [x] **WR-03**: Fix MobileNav test description — update "4 pills" description to reflect the correct 5-pill count — Validated in Phase 106 (no-op: already resolved by Phase 97)
- [x] **WR-04**: Add Acc pill test case to `MobileNav.test.tsx` — Validated in Phase 106

## Future Requirements

### NLP Improvements (deferred)

- **NLP-CONV-01**: NLP-02 conversation mode — follow-up questions on player insights (requires WebSocket or streaming response)
- **NLP-GW-01**: Post-GW LLM narrative — "here's what the model got right and wrong last week"

### Chip Intelligence (deferred)

- **TC-01**: Triple captain decision engine — structured TC timing comparison (extends `computeTCScore`)
- **BB-01**: Bench boost readiness score — total bench xPts + start probability gate (extends `computeBBScore`)
- **FH-01**: Free hit squad builder from full 700-player pool (budget: 100m, 3-per-club cap)
- **WC-01**: Wildcard structure builder — compare 2-3 squad structures over 5/8/15 GW horizon

## Out of Scope

| Feature | Reason |
|---------|--------|
| Streaming insights | `@anthropic-ai/sdk` SSE parsing fails on Edge; Node.js non-streaming is stable and sufficient |
| NLP for all players | Cost explosion risk — batch only covers top 20; on-demand covers the rest |
| Automated chip timing | Chip visibility in plan is in-scope; auto-timing remains deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WR-01 | Phase 106 | Complete |
| WR-02 | Phase 106 | Complete |
| WR-03 | Phase 106 | Complete |
| WR-04 | Phase 106 | Complete |
| CACHE-01 | Phase 107 | Complete |
| CACHE-02 | Phase 107 | Complete |
| NLP-BATCH-01 | Phase 108 | Complete |
| NLP-BATCH-02 | Phase 108 | Complete |
| NLP-BATCH-03 | Phase 108 | Complete |
| MC-CAL-01 | Phase 109 | Complete |
| MC-CAL-02 | Phase 109 | Complete |

**Coverage:**
- v1.19 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0 ✓

**Phase distribution:**
- Phase 106 (Code Quality Cleanup): 4 requirements (WR-01, WR-02, WR-03, WR-04)
- Phase 107 (NLP-02 Prompt Caching): 2 requirements (CACHE-01, CACHE-02)
- Phase 108 (Batch AI Insight Pre-Generation): 3 requirements (NLP-BATCH-01, NLP-BATCH-02, NLP-BATCH-03)
- Phase 109 (MC-Enabled Calibration): 2 requirements (MC-CAL-01, MC-CAL-02)

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after roadmap creation — 11/11 mapped to Phases 106-109*
