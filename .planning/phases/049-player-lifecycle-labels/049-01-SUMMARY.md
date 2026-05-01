---
phase: 049-player-lifecycle-labels
plan: "01"
subsystem: frontend-lib
tags: [tdd, lifecycle-labels, squad-view, pure-ts]
dependency_graph:
  requires:
    - src/lib/recommend.ts (computePositionAverages)
    - src/lib/types.ts (ScoredPlayer, ClubForm, MinsRisk, SquadPick)
    - src/lib/squad-adapter.ts (SquadPick type)
  provides:
    - src/lib/lifecycle-label.ts (LifecycleLabel type, computeLifecycleLabel, computeLifecycleLabels, threshold constants)
    - src/lib/__tests__/lifecycle-label.test.ts (29 unit tests)
  affects:
    - Plan 049-02 (LifecycleLabelBadge + TransferPanel wiring — blocked until this plan)
tech_stack:
  added: []
  patterns:
    - Pure TypeScript priority-cascade label engine
    - TDD RED/GREEN with vitest
    - Mirrors computeVerdicts pattern (bench exclusion at position >= 12)
key_files:
  created:
    - src/lib/lifecycle-label.ts
    - src/lib/__tests__/lifecycle-label.test.ts
  modified: []
decisions:
  - "SELL_THRESHOLD=0.85 (not 0.90 from recommend.ts) — wider hysteresis per ROADMAP §Phase 49"
  - "posAvg passed in to computeLifecycleLabel (not computed internally) — enables precise unit testing"
  - "Null clubForm gracefully degrades to gem-score-only labels — no crash on BGW or missing team"
  - "Buy Next Week lower bound is posAvg * SELL_SOON_THRESHOLD (0.90) — prevents firing in sell band"
  - "computeVerdicts kept intact in recommend.ts — Phase 51 may reuse it"
metrics:
  duration_seconds: 174
  completed_date: "2026-05-01"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 49 Plan 01: Player Lifecycle Labels — Label Engine Summary

## One-liner

Pure-TypeScript 7-label lifecycle engine with priority cascade (Minutes Trap > Fixture Trap > Buy Next Week > Hold One More > Sell Soon > Sell > Hold) over existing ScoredPlayer + ClubForm fields.

## What Was Built

### New Files

**`src/lib/lifecycle-label.ts`** — The core label engine:
- `LifecycleLabel` union type (7 values)
- 5 exported threshold constants: `SELL_THRESHOLD=0.85`, `SELL_SOON_THRESHOLD=0.90`, `SWING_THRESHOLD=0.20`, `MINUTES_TRAP_MIN_COST=70`, `MINUTES_TRAP_START_PROB=0.65`
- `computeLifecycleLabel(player, posAvg, clubForm)` — single-player pure function
- `computeLifecycleLabels(squadPicks, allPlayers, clubFormMap)` — squad-level wrapper (bench excluded at position >= 12)

**`src/lib/__tests__/lifecycle-label.test.ts`** — 29 unit tests:
- Constant export verification (5 tests)
- Individual label tests (Tests 5-13 from RESEARCH.md spec)
- Priority cascade tests (Tests 1-4 from RESEARCH.md spec, plus additional edge cases)
- `computeLifecycleLabels` wrapper tests (bench exclusion, XI inclusion, empty squad, clubFormMap lookup)

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `SELL_THRESHOLD = 0.85` (not 0.90 from recommend.ts) | Wider hysteresis per ROADMAP §Phase 49; 0.85-0.90 range becomes "Sell Soon" warning band |
| `posAvg` passed in as parameter | Enables precise unit testing with exact values; mirrors RESEARCH.md signature |
| Null clubForm → gem-score-only labels | Graceful degradation for BGW teams; `?? 0` on all swing comparisons |
| `computeVerdicts` kept in recommend.ts | Phase 51 (Decision Summary) may reuse it; explicit decision from RESEARCH.md |
| Buy Next Week lower bound = `posAvg * 0.90` | Prevents firing in sell-band (Pitfall 1 from RESEARCH.md) |

## TDD Gate Compliance

- RED gate: `test(49-01): add failing tests for lifecycle-label engine (RED)` — commit `064928a`
  - Confirmed FAIL: module-not-found error (lifecycle-label.ts did not exist)
- GREEN gate: `feat(49-01): implement computeLifecycleLabel + computeLifecycleLabels (GREEN)` — commit `d282d4c`
  - Confirmed PASS: 29/29 tests pass

## Deviations from Plan

### Pre-existing Issue (Out of Scope)

**1. [Deferred] `tests/lib/club-form.test.ts` has 1 failing test pre-existing before this plan**
- **Found during:** Full suite run after GREEN
- **Issue:** `computeClubForm > assigns difficulty tier correctly — strong team is hard, weak team is easy` — assertion `expect(vsBur!.difficulty_tier).not.toBe('hard')` fails
- **Cause:** Pre-existing issue in the codebase; confirmed by verifying it fails with no local changes staged
- **Action:** Logged to deferred-items.md; not touched (out of scope per deviation rules)

No deviations to the plan implementation itself — executed as specified in RESEARCH.md.

## Verification

- `npx vitest run src/lib/__tests__/lifecycle-label.test.ts` — 29/29 pass
- `npx vitest run` full suite — 550/551 pass (1 pre-existing failure unrelated to this plan)
- `npx tsc --noEmit` — no new TypeScript errors introduced by this plan

## Known Stubs

None. This plan creates a pure computation library with no UI rendering — no stub patterns possible.

## Threat Flags

None. This plan adds pure TypeScript computation over existing data fields. No new API endpoints, no new network calls, no auth paths, no file access, no schema changes. The `computeLifecycleLabels` function is called client-side only with data already fetched by existing hooks.

## Self-Check: PASSED

- `src/lib/lifecycle-label.ts` — FOUND
- `src/lib/__tests__/lifecycle-label.test.ts` — FOUND
- Commit `064928a` (RED tests) — FOUND
- Commit `d282d4c` (GREEN implementation) — FOUND
