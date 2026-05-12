---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: End-of-Season Intelligence
status: ready_to_plan
stopped_at: Phase 99 UI-SPEC approved
last_updated: "2026-05-12T11:23:35.766Z"
last_activity: 2026-05-12 -- Phase 99 execution started
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 7
  completed_plans: 5
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11 — Phase 96 complete)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Phase 99 — top-10k-comparison

## Current Position

Phase: 100
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-12

Progress: [██░░░░░░░░] 2/5 phases complete

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 77 | 02 | ~10 min | 2 | 5 |
| 89 | 02 | ~15 min | 2 | 2 |

**Previous milestone (v1.16) velocity:**

- 9 phases (88–96), all complete
- Shipped 2026-05-11 (2 days)

**Previous milestone (v1.14) velocity:**

- 4 phases (82–85), all complete
- Shipped 2026-05-09 (2 days)

**Previous milestone (v1.9) velocity:**

- 5 phases, 13 plans
- 2 days (2026-05-03 → 2026-05-04)
- 121 files changed, +27,865 / −1,388 lines

## Accumulated Context

### Decisions

- [v1.17-roadmap] Phase 97 (HEAT-01/02) is pure client-side over existing attacking_difficulty data from useClubForm(); no pipeline change; toggle added within Club Form tab; mirrors Phase 66 heat map (v1.11) but scoped to 8 GWs and Club Form toggle rather than dedicated sub-tab
- [v1.17-roadmap] Phase 98 (PGW-01/02/04) extends existing BackTab / useDecisionHistory hook (already in production from Phase 96); auto-surface on PGW-04 uses FPL bootstrap events[].deadline_time comparison; bench summary requires authenticated FPL picks endpoint already in use
- [v1.17-roadmap] Phase 99 (PGW-03) separated from Phase 98 because top-10k data source needs investigation — FPL does not expose a direct top-10k API; options include classic league standings for league-314 (overall), or deriving from bootstrap average_entry_score as fallback; this needs research before planning
- [v1.17-roadmap] Phase 100 (HIST-01/02/03) all in Decision History context: HIST-01 is pure computation over existing BackTab data (no new pipeline); HIST-02 needs chip GW identification from FPL entry history (picks API already authenticated); HIST-03 needs authenticated FPL transfers endpoint (/entry/{id}/transfers/)
- [v1.17-roadmap] Phase 101 (GWT-01 + UX-01) bundled: GWT-01 is a TransferPanel enhancement (GW selector + per-GW xPts re-rank using existing upcoming_fixtures data); UX-01 is a string rename only; both are client-side only, no pipeline change
- [v1.17-roadmap] UX-01 bundled into Phase 101 (not its own phase) per instructions — it is a one-line string change and does not warrant a standalone phase
- [v1.17-roadmap] BACK-02 (transfer regret backtester) carried forward from v1.16 — still deferred, requires Python port of suggestTransfers()

### Pending Todos

- WR-02 (decision-severity.ts): captain returns MEDIUM (not LOW) when candidates.length < 2 — cleanup agent scheduled (trig_01MnRB5hD37qiQqQYGNTCJhs, fires 2026-05-02T06:17Z)
- WR-01 (DecisionSummaryTab.tsx): duplicate transition classes on Load Squad button — cleanup agent scheduled
- WR-03/04 (MobileNav.test.tsx): 4→5 pills description wrong, Acc pill untested — cleanup agent scheduled
- Phase 48 hover card: non-functional in production until pipeline re-run produces appearance_pts in merged_players.json cache

### Blockers/Concerns

- PGW-03 (top-10k comparison) data source needs research before planning Phase 99 — FPL does not have a direct documented top-10k endpoint; research required to determine feasibility and fallback strategy

## Deferred Items

| ID | Description | Phase | Target |
|----|-------------|-------|--------|
| TRT-06 | ChipToggle UI in RouteTreeTab — chipMode hardcoded null | 60 | v1.12 |
| TRT-02 | "Hits" column label cosmetic mismatch (shows totalTransfers, not totalHits) | 60 | v1.12 |
| VERIFY-60 | Phase 60 VERIFICATION.md not created — UAT recorded in STATE.md only | 60 | backlog |
| WR-02 | decision-severity.ts captain MEDIUM when candidates < 2 (should be LOW) | pre-v1.9 | backlog |
| WR-01 | DecisionSummaryTab Load Squad button duplicate transition classes | pre-v1.9 | backlog |
| WR-03/04 | MobileNav.test.tsx 4→5 pills description wrong, Acc pill untested | pre-v1.9 | backlog |
| TEST-57 | captain-picks.test.ts 5 pre-existing failures from Phase 57 CaptainPicksPanel rewrite | 57 | backlog |
| BACK-02 | Transfer regret backtester (Python port of suggestTransfers required) | — | v1.18+ |

## Session Continuity

Last session: 2026-05-12T10:15:12.390Z
Stopped at: Phase 99 UI-SPEC approved
Resume file: .planning/phases/99-top-10k-comparison/99-UI-SPEC.md
