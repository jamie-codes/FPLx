---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Competitive Intelligence
status: Phase 59 (Manual Transfer Planner) complete — Phase 60 (Transfer Route Tree) next
stopped_at: ""
last_updated: "2026-05-04T09:11:28Z"
last_activity: 2026-05-04 — Phase 59 complete; all 3 plans executed; MTP-01..MTP-08 verified
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 31
  completed_plans: 31
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03 — v1.9 started)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.9 Competitive Intelligence — Phase 57 complete; Phase 58 (Mini-League Rival Tracker) next

## Current Position

Phase: 60 (Transfer Route Tree) — Not started
Plan: 0 plans created; planning required
Status: Ready to plan
Last activity: 2026-05-04 — Phase 59 complete; all 3 plans executed; MTP-01..MTP-08 human-verified

Progress: 4/5 phases complete [########--] 80%

### v1.9 Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 56 | FT Engine Fix | FTX-01, FTX-02 | ✅ Complete (2026-05-03) |
| 57 | Effective Ownership Mode | EO-01–EO-04 | ✅ Complete (2026-05-03) |
| 58 | Mini-League Rival Tracker | ML-01–ML-08 | ✅ Complete (2026-05-04) |
| 59 | Manual Transfer Planner | MTP-01–MTP-08 | ✅ Complete (2026-05-04) |
| 60 | Transfer Route Tree | TRT-01–TRT-07 | Not started |

### Dependency Order

- Phase 56 (FTX) — standalone pre-condition; no upstream v1.9 deps
- Phase 57 (EO) — independent of 56; can start immediately
- Phase 58 (ML) — independent of 56 and 57; parallel-safe with Phase 57
- Phase 59 (MTP) — requires Phase 56 (FT engine)
- Phase 60 (TRT) — requires Phase 59 (MTP-01 bridge)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 052 | 01 | 5 min | 3 | 3 |
| 052 | 03 | 12 min | 3 | 4 |

**Previous milestone (v1.7) velocity:**

- 5 phases, 14 plans
- 2 days (2026-05-01 → 2026-05-02)
- 88 commits, 323 files changed

## Accumulated Context

### Decisions

- [052-01] Used `starts==1` exclusively for start counting; removed `minutes>0` history filter to allow 0-minute non-start entries to contribute to `start_prob` denominators
- [052-01] Changed `recent_start_rate < 0.25` to `start_prob < 0.25` in `mins_risk` cameo check to avoid NameError when position-prior branch fires
- [052-03] Extended `_xpts_ngw` intermediary with `xmins_v2_enabled`/`mins_60_prob` kwargs to thread flag to `_compute_xpts_fixture` without bypassing abstraction layer
- [052-03] Added `cache_dir: str = ''` parameter to `compute_accuracy_backtest` so `accuracy.py` can read existing flag from disk (backward compatible)
- [052-03] Added `json`/`os` imports to `accuracy.py` (required by `_read_existing_xmins_v2_flag` helper)
- [v1.9-roadmap] TRT-01 is PURE TYPESCRIPT — no LLM; top-3 sell roots + greedy continuation per branch
- [v1.9-roadmap] ML-08 requires `p-limit` ^6.1.0 npm install for 3-concurrent-request batching
- [v1.9-roadmap] Phases 57 (EO) and 58 (ML) are parallel-safe — zero shared files; can be executed concurrently
- [v1.9-roadmap] MTP-07 sell price caveat shown only when unauthenticated; exact selling_price used when authenticated
- [059-03] D-02 positive render guard used for manual-plan: `activeSection === 'plan'` not `activeSection !== 'squad'` — locks tab strictly to Plan section
- [059-03] window.location.reload() hack from Plan 02 no-squad submit remains in effect; submittedId prop pre-populates Team ID input only

### Pending Todos

- WR-02 (decision-severity.ts): captain returns MEDIUM (not LOW) when `candidates.length < 2` — cleanup agent scheduled (trig_01MnRB5hD37qiQqQYGNTCJhs, fires 2026-05-02T06:17Z)
- WR-01 (DecisionSummaryTab.tsx): duplicate transition classes on Load Squad button — cleanup agent scheduled
- WR-03/04 (MobileNav.test.tsx): 4→5 pills description wrong, Acc pill untested — cleanup agent scheduled
- Phase 48 hover card: non-functional in production until pipeline re-run produces `appearance_pts` in merged_players.json cache

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-04T09:11:28Z
Stopped at: Phase 59 complete — Phase 60 (Transfer Route Tree) next
Resume file: None
