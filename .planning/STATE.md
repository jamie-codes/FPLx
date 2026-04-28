---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Analytics Engine & Intelligence Layer
status: active
stopped_at: ""
last_updated: "2026-04-27T23:30:00.000Z"
last_activity: 2026-04-27
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27 after v1.3)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.4 Analytics Engine & Intelligence Layer — Phase 26 complete, Phase 27 (FDR++ Pipeline) next

## Current Position

Phase: 27 - FDR++ Pipeline (ready to execute)
Status: Phase 27 planned — 2 plans, 2 waves
Last activity: 2026-04-28 — Phase 27 plans created and verified

Progress: [█░░░░░░░░░] 11% (v1.4: 1/9 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 2 (v1.4)
- Average duration: ~30 min (based on v1.2/v1.3 history)
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend (v1.3):**

| Phase 19 P01 | 3 | 2 tasks | 11 files |
| Phase 19 P02 | 4 | 2 tasks | 2 files |
| Phase 20 P01 | 2min | 2 tasks | 4 files |
| Phase 20-auth-ux P02 | 5 min | 1 tasks | 1 files |
| Phase 20-auth-ux P02 | 5min | 2 tasks | 1 files |
| Phase 21-planner-tab-shell-and-state-model P01 | 2min | 2 tasks | 3 files |
| Phase 21 P02 | 128s | 1 tasks | 5 files |
| Phase 22-planning-engine P01 | 8min | 2 tasks | 3 files |
| Phase 22-planning-engine P02 | 5min | 1 tasks | 1 files |
| Phase 22-planning-engine P02 | 10min | 2 tasks | 1 files |
| Phase 23-transfer-output-table P01 | 10min | 2 tasks | 4 files |
| Phase 23-transfer-output-table P02 | 10min | 2 tasks | 1 files |
| Phase 24-squad-snapshot P01 | 8min | 2 tasks | 3 files |
| Phase 24-squad-snapshot P02 | 90s | 1 tasks | 3 files |
| Phase 25-manual-edit-mode P01 | 12min | 2 tasks | 4 files |
| Phase 25-manual-edit-mode P02 | 10min | 1 tasks | 2 files |
| Phase 25-manual-edit-mode P02 | 10min | 2 tasks | 2 files |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.4 Roadmap]: Phase 26 groups SP-01/SP-02/MOB-LS-01/DATA-04 as quick wins -- zero pipeline blocking changes, ships visible features immediately
- [v1.4 Roadmap]: FDR++ (Phase 27) must land before xPts (Phase 28) -- CS probability needs opponent attacking difficulty
- [v1.4 Roadmap]: Phase 29 (regression detector) can run in parallel with Phases 27-28 since it uses a separate Understat per-match pipeline, not FDR++
- [v1.4 Roadmap]: Differential tracker (Phase 30) depends on xPts (Phase 28) for EV comparison; uses selected_by_percent as EO proxy (no official top-10k API)
- [v1.4 Roadmap]: Captaincy ceiling (Phase 31) depends on both xPts variance (Phase 28) and ownership data (Phase 30)
- [v1.4 Roadmap]: Team target list (Phase 32) is a late consumer depending on FDR++, xPts, and regression flags
- [v1.4 Roadmap]: Insights tab (Phase 33) and chip strategy (Phase 34) are leaf consumers with no downstream dependents -- shipped last
- [v1.4 Roadmap]: FDR++ is additive -- existing difficulty_score field preserved for 6+ consumers (gem-score, proj_pts, FixtureBadges, ClubFormTable, planning-engine, captaincy-engine)

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: xPts double-counting risk -- CS points and DefCon bonus are correlated; must use joint defensive-points model in Phase 28
- [Research]: Per-match Understat xG/xA fetch is a pipeline gap -- verify soccerdata supports per-match data during Phase 29 planning
- [Research]: Free Hit optimal squad construction approach (greedy vs solver) needs design research during Phase 34 planning
- [Research]: merged_players.json size -- currently ~300KB; monitor that v1.4 field additions keep gzipped transfer under 100KB

## Session Continuity

Last session: 2026-04-27
Stopped at: Roadmap created for v1.4 milestone
Resume file: None
