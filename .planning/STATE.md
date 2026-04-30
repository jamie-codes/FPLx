---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Squad Optimiser
status: in_progress
last_updated: "2026-04-30T00:00:00Z"
last_activity: "2026-04-30 -- Phase 42 execution started (2 plans)"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30 — v1.6 started)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.6 Squad Optimiser — Phase 42 executing

## Current Position

Phase: 42 of 46 (xPts Accuracy Improvements)
Plan: Wave 1 — Plan 42-01 executing
Status: In progress (0/2 plans complete)
Last activity: 2026-04-30 — Phase 42 execution started: 2 plans in 2 waves (Wave 1: form signal + blend; Wave 2: backtest gate + mid-tier + proj_pts cleanup)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 4 (v1.5 — Phases 36-38)
- Average duration: ~30 min (based on v1.2/v1.3/v1.4 history)
- Total execution time: ~2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 36 | 1 | - | - |
| 37 | 1 | - | - |
| 38 | 2 | ~10 min | ~5 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.5 complete]: All 6 phases shipped; proj_pts removed (xPts 16.7% vs 9.0% hit rate); 3-section nav in place
- [v1.6 scope]: ACC phases ship before OPT engine — ensures optimiser uses improved xPts from the start
- [v1.6 scope]: NAV-01 (Squad sub-tabs) ships in Phase 43 alongside the OptimiserPanel that requires it
- [v1.6 scope]: CHIP modes (Phase 46) depend on TFR budget tracking (Phase 45) — not standalone
- [Research]: No new npm/pip deps needed; best-11 = C(15,11)=1,365 subsets, pure TS enumeration <1ms
- [Research]: Wildcard/Free Hit chip modes extend optimiseLineup with chipMode param; never fork the engine
- [Research]: Budget arithmetic: always integer tenths; use selling_price (not now_cost) in transfer-aware mode

### Pending Todos

None.

### Blockers/Concerns

None. DGW xPts aggregation confirmed correct (2026-04-30): `_xpts_ngw` in `pipeline/merge.py` groups fixtures by `event_id` and sums xPts over all fixtures within each GW — DGW players naturally score higher. No pipeline fix needed before Phase 43.

## Session Continuity

Last session: 2026-04-30
Stopped at: Roadmap written for v1.6 (Phases 42-46); ready to plan Phase 42
Resume file: None
