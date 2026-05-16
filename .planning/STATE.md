---
gsd_state_version: 1.0
milestone: v1.21
milestone_name: Polish, Intelligence & Team News
status: in_progress
stopped_at: Phase 114 Wave 1 complete — awaiting UAT-01 human checkpoint
last_updated: "2026-05-16T20:00:00.000Z"
last_activity: 2026-05-16 — Phase 114 Wave 1 complete (TRT-01, TRT-02, SPARK-01 delivered)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16 — v1.21 milestone active)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.21 Phase 114 — Polish & Carry-Forward Fixes

## Current Position

Phase: 114 (in progress — Wave 2 pending)
Plan: 114-03 (human checkpoint, Wave 2)
Status: Wave 1 complete (114-01 ✓, 114-02 ✓); UAT-01 human checkpoint pending
Last activity: 2026-05-16 — Wave 1 executed (TRT-01/TRT-02/SPARK-01 delivered)

```
Phase 114 [██████████] 67%  (2/3 plans done, Wave 2 pending)
Phase 115 [          ] 0%
Phase 116 [          ] 0%

Milestone  [          ] 0%  (0/3 phases complete)
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

Last session: 2026-05-16T20:00:00.000Z
Stopped at: Phase 114 Wave 1 complete — UAT-01 human checkpoint pending
Next command: User approves UAT-01, then `/gsd-execute-phase 114` to resume Wave 2
