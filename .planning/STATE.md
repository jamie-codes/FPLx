---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Modelling & Refinement — Carry-forward
status: executing
stopped_at: ""
last_updated: "2026-05-07T12:30:00.000Z"
last_activity: 2026-05-07 -- Phase 076 all plans complete (Wave 2 done)
progress:
  total_phases: 26
  completed_phases: 25
  total_plans: 79
  completed_plans: 79
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-04 — v1.10 started)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** v1.10 Modelling & Trust — Monte Carlo simulator, calibration charts, model versioning, sensitivity analysis, rejection explainer

## Current Position

Phase: 76 — Analytics Enhancements (executing)
Plan: Wave 1 complete (3/4 plans done); Wave 2 (plan 02) in progress
Status: Executing Wave 2
Last activity: 2026-05-07 -- Phase 076 Wave 1 complete (plans 01, 03, 04)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|

**Previous milestone (v1.9) velocity:**

- 5 phases, 13 plans
- 2 days (2026-05-03 → 2026-05-04)
- 121 files changed, +27,865 / −1,388 lines

## Accumulated Context

### Decisions

- [v1.9-roadmap] TRT-01 is PURE TYPESCRIPT — no LLM; top-3 sell roots + greedy continuation per branch
- [v1.9-roadmap] ML-08 requires `p-limit` ^6.1.0 npm install for 3-concurrent-request batching
- [v1.9-roadmap] MTP-07 sell price caveat shown only when unauthenticated; exact selling_price used when authenticated
- [059-03] D-02 positive render guard used for manual-plan: `activeSection === 'plan'` not `activeSection !== 'squad'` — locks tab strictly to Plan section
- [059-03] window.location.reload() hack from Plan 02 no-squad submit remains in effect; submittedId prop pre-populates Team ID input only
- [052-01] Used `starts==1` exclusively for start counting; removed `minutes>0` history filter to allow 0-minute non-start entries to contribute to `start_prob` denominators
- [052-03] Extended `_xpts_ngw` intermediary with `xmins_v2_enabled`/`mins_60_prob` kwargs to thread flag to `_compute_xpts_fixture` without bypassing abstraction layer
- [v1.10-roadmap] Phase 61 simulate.py reuses `_compute_xpts_fixture` Poisson/Bernoulli parameters — no new HTTP calls; sim writes 4 fields per player to merged_players.json
- [v1.10-roadmap] Phase 62 rank simulator is client-side UI only — 5-GW trajectory computed over existing MC fields from Phase 61; no additional pipeline work
- [v1.10-roadmap] Phase 63 groups VER-01/VER-02/CAL-01/CAL-02 — all are accuracy.py + AccuracyTab extensions with no new pipeline data source
- [v1.10-roadmap] Phase 64 fragility engine is pure TypeScript over MergedPlayer — checks start_prob threshold (0.70), fixture difficulty tier, and hit cost; no pipeline dependency
- [v1.10-roadmap] Phase 65 rejection explainer is pure TypeScript over MergedPlayer + existing recommendation engine outputs; WHY-02 >20% ownership callout reuses selected_by_percent field

### Pending Todos

- WR-02 (decision-severity.ts): captain returns MEDIUM (not LOW) when `candidates.length < 2` — cleanup agent scheduled (trig_01MnRB5hD37qiQqQYGNTCJhs, fires 2026-05-02T06:17Z)
- WR-01 (DecisionSummaryTab.tsx): duplicate transition classes on Load Squad button — cleanup agent scheduled
- WR-03/04 (MobileNav.test.tsx): 4→5 pills description wrong, Acc pill untested — cleanup agent scheduled
- Phase 48 hover card: non-functional in production until pipeline re-run produces `appearance_pts` in merged_players.json cache

### Blockers/Concerns

None.

## Deferred Items

Items carried from v1.9:

| ID | Description | Phase | Target |
|----|-------------|-------|--------|
| TRT-06 | ChipToggle UI in RouteTreeTab — chipMode hardcoded null | 60 | v1.12 |
| TRT-02 | "Hits" column label cosmetic mismatch (shows totalTransfers, not totalHits) | 60 | v1.12 |
| VERIFY-60 | Phase 60 VERIFICATION.md not created — UAT recorded in STATE.md only | 60 | backlog |
| WR-02 | decision-severity.ts captain MEDIUM when candidates < 2 (should be LOW) | pre-v1.9 | backlog |
| WR-01 | DecisionSummaryTab Load Squad button duplicate transition classes | pre-v1.9 | backlog |
| WR-03/04 | MobileNav.test.tsx 4→5 pills description wrong, Acc pill untested | pre-v1.9 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 CaptainPicksPanel rewrite | 57 | backlog |

## Session Continuity

Last session: 2026-05-06T11:21:32.046Z
Stopped at: context exhaustion at 75% (2026-05-06)
Resume file: None
