---
gsd_state_version: 1.0
milestone: v1.21
milestone_name: milestone
status: executing
stopped_at: Phase 116 UI-SPEC approved
last_updated: "2026-05-17T12:49:21.581Z"
last_activity: 2026-05-17 -- Phase 116 planning complete
progress:
  total_phases: 61
  completed_phases: 0
  total_plans: 0
  completed_plans: 152
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16 — v1.21 milestone active)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.21 Phase 116 — Prose Staleness & Model Versioning

## Current Position

Phase: 116
Plan: —
Status: Ready to execute
Last activity: 2026-05-17 -- Phase 116 planning complete

```
Phase 114 [██████████] 100% ✅ COMPLETE
Phase 115 [██████████] 100% ✅ COMPLETE
Phase 116 [          ] 0%

Milestone  [██████    ] 67%  (2/3 phases complete)
```

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**v1.20 velocity:**

- 4 phases (110-113), all complete
- Shipped 2026-05-16 (3 days)
- 120 files changed, +17,166 / −2,112 lines

**v1.21 velocity:**

- 0 phases complete (3 total)
- Started 2026-05-16

## Accumulated Context

### Decisions

_(No v1.21 decisions yet — roadmap phase only)_

### Key Context for Execution

- v1.21 is a UI wiring milestone — backends for SCRAPER-01 news fields, NLP-01 prose, and VER-01 version records are all already in production
- NEWS-01 (staleness suppression gate) is a PREREQUISITE for NEWS-02 and NEWS-03 — do not wire NewsBanner into new call sites before the 14-day zinc suppression predicate lands
- VER-01 (sample_gws schema extension in accuracy.py) must precede VER-02 (VersionHistoryTable UI)
- SPARK-01 uses existing rank_trajectory field already in MergedPlayer — zero pipeline changes needed
- UAT-01 is a human visual checkpoint, not a code task — verifies dark mode, delta colour polarity, multi-transfer GW format, captain regression in BackTab
- Research recommends no /gsd-research-phase for any phase — all patterns established, all data confirmed live
- FORMULA_VERSION: if v1.21 delivers only UI wiring with no formula changes to merge.py/simulate.py/xmins.py/bonus.py, keep at current version; if any formula-touching change lands, bump to v1.21-a

### Blockers/Concerns

- None active at roadmap definition.

## Deferred Items

### Carried from v1.20

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| VERIFY-60 | Phase 60 VERIFICATION.md not created | 60 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 | 57 | backlog |
| Phase 48 hover card | non-functional until pipeline re-run produces appearance_pts | 48 | backlog |

### Items resolved by v1.21

| ID | Description | Resolution |
|----|-------------|------------|
| BACK-02-UAT | Phase 113 human UAT gate | Addressed in Phase 114 UAT-01 |
| RANK-SPARK | rank_trajectory sparkline in GemTable | Addressed in Phase 114 SPARK-01 |
| TRT-01 | Hits column label mismatch | Addressed in Phase 114 TRT-01 |
| TRT-02 | ChipToggle stub in RouteTreeTab | Addressed in Phase 114 TRT-02 |

## Session Continuity

Last session: 2026-05-17T12:23:45.147Z
Stopped at: Phase 116 UI-SPEC approved
Next command: `/gsd-discuss-phase 115`
