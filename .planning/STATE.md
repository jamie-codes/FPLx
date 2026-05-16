---
gsd_state_version: 1.0
milestone: v1.20
milestone_name: Modelling & Refinement — Carry-forward
status: milestone_complete
stopped_at: Phase 113 context gathered
last_updated: "2026-05-15T16:42:18.107Z"
last_activity: 2026-05-15
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14 — v1.19 complete, v1.20 roadmap drafted)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Phase 113 — transfer-regret-backtester

## Current Position

Phase: 113
Plan: Not started
Status: Milestone complete

**v1.20 Phase Plan:**

- Phase 110: GW Review & History Fixes — FIX-03, FIX-04, FIX-05, FIX-06
- Phase 111: Fixture Heatmap & Planner Cross-Position Fixes — FIX-01, FIX-02
- Phase 112: Optimiser On-Demand & Transfer Suggestion Cap — OPT-01, TFR-02
- Phase 113: Transfer Regret Backtester — BACK-02

Last activity: 2026-05-16

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**Previous milestone (v1.19) velocity:**

- 4 phases (106–109), all complete
- Shipped 2026-05-14 (1 day)
- 42 files changed, +4,911 / −89 lines

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

## Accumulated Context

### Decisions

- [v1.20-roadmap] 4 phases (110-113) derived from 9 requirements by clustering on delivery surface and root-cause locality. GW Review/History bugs (FIX-03/04/05/06) grouped into Phase 110 because all four touch `/api/gw-review` + `/api/decision-history` + their UI consumers — single TDD pass and one round of UAT can lock down all four with the lowest combined cost. Cross-bug root-cause investigation flagged in Phase 110 phase notes.
- [v1.20-roadmap] Phase 111 pairs the fixture heatmap BGW bug (FIX-01) with the planner cross-position bug (FIX-02). Both are isolated engine/data-layer fixes in different files, neither has UAT dependencies on Phase 110, and combining them keeps the milestone progress table tidy. Audit every existing `suggestTransfers` call site (v1.6 RouteTree, v1.9 Manual Plan, v1.17 GW-targeted scoring) as part of FIX-02 — the position lock has multiple entry points after several milestones of expansion.
- [v1.20-roadmap] Phase 112 pairs OPT-01 (Optimiser on-demand) with TFR-02 (transfer cap) because both are Squad sub-tab UX-only fixes with zero engine surface change. OPT-01 lifts initial calculation behind a button click; TFR-02 truncates after sort+affordability ordering so the top-3 is the *best* top-3 not an arbitrary slice. Defaults: "position slot" = `element_type` (GK/DEF/MID/FWD) unless user clarifies otherwise during planning.
- [v1.20-roadmap] Phase 113 sequenced last because it is the largest piece of work — the Transfer Regret Backtester requires a recommendation snapshot pipeline (mirror of Phase 96 captain_picks snapshot pattern), a new component on the existing `BackTab` (no new sub-tab), and a join in `/api/decision-history` against authenticated FPL event_transfers + element-summary point totals. Carries the BACK-02 deferred item from v1.19 Deferred Items into resolution.
- [v1.20-roadmap] BACK-02 hindsight scoring uses *actual realised points* (FPL element-summary), NOT predicted xPts — same rule as Phase 96 BACK-01 captain backtester, so "regret" is grounded in what actually happened, not what was forecast. Recommendation snapshot must use deadline-minus-1-hour data so the comparison is honest (do NOT use future GW data to recommend retroactively).

### Pending Todos

- Phase 110 research spike: confirm whether FIX-03/04/05/06 share a root cause (single mis-typed field name in `gw_review_gw{N}.json` or sign convention drift between pipeline writer and UI reader) before patching as four independent fixes.
- Phase 111 research spike: enumerate every call site of `suggestTransfers` / planner candidate selection across Squad Transfers, Manual Plan, Route Tree, Decision Summary OCS sells — confirm position-lock is enforced (or not) at each before patching.
- Phase 112 product clarification: confirm with user during `/gsd-plan-phase 112` whether TFR-02 "position slot" means `element_type` (GK/DEF/MID/FWD — 4 buckets) or specific 15-player squad-slot. Default assumption: `element_type`.
- Phase 113 design decision: Python pipeline snapshot vs TypeScript post-hoc compute. Snapshot route mirrors Phase 96 BACK-01 pattern (durable trail, audit-stable); post-hoc route is faster to ship but loses replay stability if `merged_players.json` schema drifts.

### Blockers/Concerns

- None active for v1.20 entry. All four phases depend only on v1.19 surfaces which are now live in production.

## Deferred Items

### Pre-existing deferred items (carried into v1.20 planning)

| ID | Description | Phase | Target |
|----|-------------|-------|--------|
| BACK-02 | Transfer regret backtester (Python port of suggestTransfers required) | 113 | **resolved by Phase 113** |
| RANK-SPARK | `rank_trajectory` sparkline in GemTable (data exists in MergedPlayer) | — | v1.21+ (visual design decision needed) |
| TRT-06 | ChipToggle UI in RouteTreeTab — chipMode hardcoded null | 60 | post-season |
| TRT-02 | "Hits" column label cosmetic mismatch (shows totalTransfers, not totalHits) | 60 | post-season |
| VERIFY-60 | Phase 60 VERIFICATION.md not created — UAT recorded in STATE.md only | 60 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 CaptainPicksPanel rewrite | 57 | backlog |
| Phase 48 hover card | non-functional in production until pipeline re-run produces appearance_pts in merged_players.json cache | 48 | backlog |

### Resolved during v1.20 planning

- BACK-02 — moved out of "carry-forward backlog" into Phase 113 (no longer deferred)
- FIX-01..FIX-06, OPT-01, TFR-02 — newly catalogued bug-and-UX requirements, assigned to Phases 110/111/112

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

Last session: 2026-05-15T16:42:18.099Z
Stopped at: Phase 113 context gathered
Next command: `/gsd-plan-phase 111`
