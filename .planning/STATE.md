---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Gameweek Planner
status: executing
stopped_at: Completed 24-01-PLAN.md
last_updated: "2026-04-02T22:03:03.841Z"
last_activity: 2026-04-02
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 12
  completed_plans: 11
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01 after v1.2)

**Core value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.
**Current focus:** Phase 24 — squad-snapshot

## Current Position

Phase: 24 (squad-snapshot) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-04-02

Progress: [░░░░░░░░░░] 0% (v1.3: 0/7 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.3)
- Average duration: ~30 min (based on v1.2 history)
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3 Roadmap]: DQ-01/02 and VG-01/02 grouped into Phase 19 — all are pipeline/display polish with no blocking dependencies on each other
- [v1.3 Roadmap]: AUTH-03/04 is Phase 20 — self-contained; can be built independently of Planner work
- [v1.3 Roadmap]: PLAN-08 (nav tab) grouped with PLAN-01 (horizon selector) in Phase 21 — tab shell and state model must exist before engine or UI
- [v1.3 Roadmap]: Manual edit (PLAN-04) is Phase 25 (last) — depends on stable output table (Phase 23) and squad snapshot (Phase 24)
- [v1.3 Roadmap]: immer + use-immer are the only new packages; install happens in Phase 21
- [Phase 19]: xG proxy uses FPL goals_scored/assists per-90 formula matching existing Understat approach — ensures all players with minutes get numeric xG/xA
- [Phase 19]: DefCon threshold raised to < 5 games — eliminates noise from low-appearance players in DefCon table
- [Phase 19]: pts_gw_count threshold comparison (< 5 / < 3) determines partial window asterisk display per D-11
- [Phase 20]: dialog::backdrop styled via globals.css CSS rule (not Tailwind backdrop: prefix) — Tailwind v4 backdrop: support unverified in this project config
- [Phase 20]: AuthModal always rendered in DOM (not conditionally) — prevents showModal() null ref on first open (Pitfall 4 from RESEARCH.md)
- [Phase 20-auth-ux]: handleAuthSuccess calls setAuthenticated() then closes modal — TanStack Query cache invalidated before modal disappears
- [Phase 20-auth-ux]: handleAuthSuccess calls setAuthenticated() then closes modal — TanStack Query cache invalidated before modal disappears
- [Phase 20-auth-ux]: Inline token form and state (showTokenForm, tokenInput, loginLoading, loginError) removed from TransferPanel — all token-entry logic lives in AuthModal
- [Phase 21]: computeHitCost returns explicit 0 (not hits * -4 when hits===0) to avoid -0 IEEE754 artifact
- [Phase 21]: snapshotSquad uses structuredClone for deep copy over JSON round-trip or spread
- [Phase 21]: HorizonSelector styling copied verbatim from GwToggle.tsx — ensures visual consistency across segmented controls
- [Phase 21]: Tab type updated in both page.tsx and MobileNav.tsx together — these local type definitions must stay in sync
- [Phase 22-planning-engine]: LOOK_AHEAD_DISCOUNT=0.8 per D-01; greedy + 1-level look-ahead, no deeper recursion
- [Phase 22-planning-engine]: CANDIDATES_PER_POSITION=20 pre-filter by gem_score to bound candidate search space
- [Phase 22-planning-engine]: Hit threshold D-03: paid transfer only suggested when netGain > 0 after -4 deduction
- [Phase 22-planning-engine]: useMyTeam(isAuthenticated): actual hook requires boolean enabled arg — pass isAuthenticated from useAuthStatus
- [Phase 22-planning-engine]: useMyTeam(isAuthenticated): actual hook requires boolean enabled arg — pass isAuthenticated from useAuthStatus
- [Phase 23-transfer-output-table]: formatGain uses U+2212 minus sign for negative values (typographic correctness)
- [Phase 23-transfer-output-table]: Hold row uses colSpan=2 spanning Out+In columns
- [Phase 23-transfer-output-table]: useImmer replaces useState for planResult to allow safe nested mutation in handleChipToggle
- [Phase 23-transfer-output-table]: updatePlanResult(() => result) used in handleGeneratePlan to satisfy Immer recipe signature
- [Phase 24-squad-snapshot]: positionsAfter snapshot taken AFTER positionMap.delete/set block so bought player position is correctly captured
- [Phase 24-squad-snapshot]: positionsAfter uses Record<number, number> (plain object, not Map) to keep PlanStep JSON-serializable

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: Free transfer cap for 2025/26 reported as 5 in SUMMARY.md but 2 in FEATURES.md — must verify against official FPL rules before coding Phase 21 free transfer accumulation logic
- [Research]: Look-ahead depth (2 vs 3 GWs) and candidate pre-filter counts not empirically verified — settle via Vitest benchmarks during Phase 22

## Session Continuity

Last session: 2026-04-02T22:03:03.838Z
Stopped at: Completed 24-01-PLAN.md
Resume file: None
