---
gsd_state_version: 1.0
milestone: v1.20
milestone_name: Fixes & Decision Quality
status: planning
stopped_at: ~
last_updated: "2026-05-14T00:00:00.000Z"
last_activity: 2026-05-14 -- Milestone v1.20 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14 — v1.19 complete, planning v1.20)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.20 Fixes & Decision Quality — 9 requirements (6 bugs + 3 features), phases 110+

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-14 — Milestone v1.20 started

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**Previous milestone (v1.18) velocity:**

- 4 phases (102–105), all complete
- Shipped 2026-05-14 (1 day)
- 69 files changed, +10,321 / −1,123 lines

**Previous milestone (v1.17) velocity:**

- 5 phases (97–101), all complete
- Shipped 2026-05-12

**Previous milestone (v1.16) velocity:**

- 9 phases (88–96), all complete
- Shipped 2026-05-11 (2 days)

**Previous milestone (v1.14) velocity:**

- 4 phases (82–85), all complete
- Shipped 2026-05-09 (2 days)

## Accumulated Context

### Decisions

- [v1.19-roadmap] 4 phases (106-109): WR cleanup first, then CACHE before NLP-BATCH so the prompt cache is live when the daily batch job amplifies call volume, MC-CAL last because it is independent of the AI-insight track and reuses the v1.18 calibration surface.
- [v1.19-roadmap] Phase 106 (WR-01/02/03/04) sequenced first as a warm-up: four small, mechanical, isolated cleanups (≤10 LOC each) — clears the v1.16 carry-forward backlog and keeps the higher-value AI work in clean later phases.
- [v1.19-roadmap] Phase 107 (CACHE-01 + CACHE-02) sequenced before Phase 108 so the daily batch pre-generation job (Phase 108) inherits cache-read pricing on every call after the first within the 5-minute window — keeps NLP-BATCH cost predictable from day one.
- [v1.19-roadmap] Phase 107 pitfall flagged at planning time: Anthropic prompt caching requires the prompt prefix to be byte-identical and ≥1024 tokens. Phase 105 system prompt is ~80 tokens (per Phase 105 phase notes), so caching may be a no-op until the prompt is padded. Confirm prompt token count during `/gsd-plan-phase 107` before assuming the cost saving lands.
- [v1.19-roadmap] Phase 108 (NLP-BATCH-01/02/03) limits batch coverage to top-20 players by `xPts_1gw` after status filter (`status == 'a'`); ties broken by `selected_by_percent` desc; hard cap is 20. Gated by `INSIGHT_BATCH_ENABLED` env var so cost is controllable independently of the daily pipeline. Anthropic Console monthly spending cap from Phase 105 remains the defence-in-depth ceiling.
- [v1.19-roadmap] Phase 108 produces zero UI work — existing two-tier cache from Phase 105 reads Blob transparently. NLP-BATCH-03 is satisfied by the existing read path; no React/TS changes required.
- [v1.19-roadmap] Phase 109 (MC-CAL-01 + MC-CAL-02) is independent of the AI-insight track and reuses the v1.18 calibration surface (`pipeline/accuracy.py` + `CalibrationHealthIndicator`). Unblocked by Phase 102 making `MC_ENABLED=True` live so `haul_prob` is populated for every player.
- [v1.19-roadmap] Phase 109 graceful-degradation rule: when ≥80% of the population has MC fields, `calibration_mode` is `'mc'`; missing-MC players fall back to the analytical proxy per-player. Threshold reuses the Phase 103 position-pool guard pattern for consistency.

### Pending Todos

- Phase 107 spike: confirm `/api/player-insight` system-prompt token count exceeds the 1024-token Anthropic cache minimum before assuming `cache_control: ephemeral` produces cost savings; pad with stable structural framing if not.
- Phase 108 spike: confirm Vercel Blob `put` with `addRandomSuffix: false` overwrite semantics in deployed Python runtime (anthropic python sdk + vercel_blob package) — same question as Phase 105 spike but from the pipeline side.
- Phase 108 prerequisite: `INSIGHT_BATCH_ENABLED` env var must be defaulted to `false` in production until the first successful batch run is verified — defence-in-depth against unintended cost.
- Phase 109 verification: after first daily pipeline run with Phase 109 merged, confirm `calibration_mode` field appears in `accuracy_backtest.json.summary` and `CalibrationHealthIndicator` renders the mode label distinctly.

### Blockers/Concerns

- None active for v1.19 entry. All four phases depend only on v1.18 surfaces which are now live in production.

## Deferred Items

### Pre-existing deferred items (carried into v1.19 planning)

| ID | Description | Phase | Target |
|----|-------------|-------|--------|
| BACK-02 | Transfer regret backtester (Python port of suggestTransfers required) | — | v1.20+ |
| RANK-SPARK | `rank_trajectory` sparkline in GemTable (data exists in MergedPlayer) | — | v1.20+ (visual design decision needed) |
| TRT-06 | ChipToggle UI in RouteTreeTab — chipMode hardcoded null | 60 | v1.20+ |
| TRT-02 | "Hits" column label cosmetic mismatch (shows totalTransfers, not totalHits) | 60 | v1.20+ |
| VERIFY-60 | Phase 60 VERIFICATION.md not created — UAT recorded in STATE.md only | 60 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 CaptainPicksPanel rewrite | 57 | backlog |
| Phase 48 hover card | non-functional in production until pipeline re-run produces appearance_pts in merged_players.json cache | 48 | backlog |

### Resolved during v1.19 planning

- WR-01, WR-02, WR-03, WR-04 — moved out of "carry-forward backlog" into Phase 106 (no longer deferred)
- NLP-BATCH (full backlog item) — split into NLP-BATCH-01/02/03 and assigned to Phase 108 (no longer deferred)
- MC-CAL (full backlog item) — split into MC-CAL-01/02 and assigned to Phase 109 (no longer deferred)
- PROMPT-CACHE (full backlog item) — split into CACHE-01/02 and assigned to Phase 107 (no longer deferred)

### Acknowledged at v1.18 milestone close (2026-05-14)

Items acknowledged and deferred at milestone close on 2026-05-14:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 61 (4 pending scenarios) | partial |
| uat_gap | Phase 62 (1 pending scenario) | partial |
| uat_gap | Phase 63 (2 pending scenarios) | partial |
| uat_gap | Phase 64 (4 pending scenarios) | partial |
| uat_gap | Phase 73 (2 pending scenarios) | partial |
| uat_gap | Phase 76 (3 pending scenarios) | partial |
| uat_gap | Phase 77 (2 pending scenarios) | partial |
| uat_gap | Phase 78 (4 pending scenarios) | partial |
| uat_gap | Phase 80 (5 pending scenarios) | partial |
| uat_gap | Phases 81, 88, 99–105 (0–3 scenarios each) | partial |
| verification_gap | Phases 47–105 (26 phases, human_needed) | human_needed |

Known deferred items at close: 47 (see above)

## Session Continuity

Last session: 2026-05-14
Stopped at: v1.19 milestone archived and tagged
Next command: `/clear` then `/gsd-new-milestone` to plan v1.20
