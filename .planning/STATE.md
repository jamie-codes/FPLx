---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Modelling & Trust
status: executing
stopped_at: Phase 89 Plan 02 complete — REFRESH-01 closed
last_updated: "2026-05-10T11:15:00.000Z"
last_activity: 2026-05-10
progress:
  total_phases: 9
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09 — v1.16 milestone started)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Phase 89 — event-aware-pipeline-scheduling

## Current Position

Phase: 89 (event-aware-pipeline-scheduling) — COMPLETE
Plan: 2 of 2 — All 3 tasks complete; UAT approved by user
Status: Phase complete — REFRESH-01 closed
Last activity: 2026-05-10

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**Previous milestone (v1.14) velocity:**

- 4 phases (82–85), all complete
- Shipped 2026-05-09 (2 days)

**Previous milestone (v1.13) velocity:**

- 4 phases (78–81), all complete
- Shipped 2026-05-08

**Previous milestone (v1.9) velocity:**

- 5 phases, 13 plans
- 2 days (2026-05-03 → 2026-05-04)
- 121 files changed, +27,865 / −1,388 lines

## Accumulated Context

### Decisions

- [v1.16-roadmap] Phase 88 (SCRAPER-01) sequenced first — pure frontend display over fields already in pipeline; unblocks Phase 93's "news flip to 'doubt'" perturbation
- [v1.16-roadmap] Phase 89 (REFRESH-01) is pure DevOps / GitHub Actions — `pipeline/refresh_gate.py` deadline-guard + dense Fri/Sat/Sun cron + `concurrency: cancel-in-progress`; no TypeScript changes
- [v1.16-roadmap] Phase 90 (MC-01) is v1.16 scope = pipeline + merged_players.json extension only (4 fields); rank simulator UI / captain integration deliberately deferred (would be MC-03/MC-04 later); ≥1000 iterations floor (10x lower than v1.10 Phase 61's 10,000) because we only write percentiles
- [v1.16-roadmap] Phase 90 isolation rule: `simulate.py` MUST NOT import from `merge.py` (mirrors v1.10 Phase 61 D-02) — Poisson math duplicated as internal helper
- [v1.16-roadmap] Phase 91 (CAL-01) is independent of Phase 90 — uses existing accuracy backtest data, not MC percentiles; recharts already installed since Phase 63
- [v1.16-roadmap] Phase 92 (DH-04) extends Phase 82's data_health.json with rolling 7-element history array; zero new API routes / hooks per REQUIREMENTS.md
- [v1.16-roadmap] Phase 93 (SENS-01) extends v1.10 Phase 64 binary fragility to tristate (ROBUST/FRAGILE/KNIFE EDGE) with 5 perturbations; existing `computeFragility` API preserved, signature unchanged
- [v1.16-roadmap] Phase 93 depends on Phase 88 — without SCRAPER-01 news taxonomy, the fifth perturbation has no input to manipulate
- [v1.16-roadmap] Phase 94 (WHY-01) extends v1.10 Phase 65 explainer with two new entry points (TransferPanel search field + GemTable head-to-head); existing `computeRejection` API preserved
- [v1.16-roadmap] Phase 94 predicate-order determinism is a quality bar — `PREDICATE_ORDER` constant array makes explainer output character-deterministic across runs
- [v1.16-roadmap] Phase 95 (SPQ-04) is pure client-side aggregation in `src/lib/setPieceLeague.ts` over existing `sp_quality.json`; zero pipeline changes; reuses `useTeamBadge()` from v1.13 Phase 81 for crests
- [v1.16-roadmap] Phase 96 (BACK-01) is the most complex phase in v1.16 — pipeline write + new API route + new hook + new sub-tab + localStorage caching; sequenced last so simpler wins ship first
- [v1.16-roadmap] Phase 96 regret formula: `(model_pts − user_pts) × 2` accounts for captain points-doubling rule; comparison is to snapshotted recommendation at decision time, NOT retrospective max
- [v1.16-roadmap] Phase 96 ring buffer key `decisionHistory:teamId:{id}` so swapping team IDs doesn't corrupt user's own cache; 38 GWs × ~10KB ≈ 400KB fits localStorage
- [v1.16-roadmap] BACK-02 (transfer regret backtester) explicitly deferred to v1.17 — needs Python port of `suggestTransfers()` first

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
| BACK-02 | Transfer regret backtester (Python port of suggestTransfers required) | — | v1.17 |

## Session Continuity

Last session: 2026-05-10T11:15:00.000Z
Stopped at: Phase 89 Plan 02 — complete (REFRESH-01 closed, UAT approved)
Resume file: None — advance to Phase 90 (MC-01)
