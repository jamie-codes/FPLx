---
phase: 105
plan: "01"
subsystem: testing
tags: [tdd, nlp, vitest, wave-0, red-phase]
dependency_graph:
  requires: []
  provides:
    - "RED-phase test scaffold for /api/player-insight route handler"
    - "RED-phase test scaffold for usePlayerInsight hook"
    - "RED-phase test scaffold for PlayerInsightSection component"
    - "OCT test extensions for Phase 105 NLP-02 gw prop and PlayerInsightSection presence"
    - "GemTable test scaffold for PlayerInsightSection expand-row integration"
  affects:
    - "src/app/api/player-insight/route.ts (Wave 1 must turn route.test.ts GREEN)"
    - "src/lib/hooks/usePlayerInsight.ts (Wave 1 must turn usePlayerInsight.test.ts GREEN)"
    - "src/components/shared/PlayerInsightSection.tsx (Wave 1 must turn PlayerInsightSection.test.tsx GREEN)"
tech_stack:
  added: []
  patterns:
    - "vitest-environment node + hoisted vi.mock pattern for route tests (mirrors prose-summary)"
    - "renderHook + makeWrapper QueryClient pattern for hook tests"
    - "vi.mock factory with no static import for OCT Wave-0 compatibility"
    - "it.todo() stubs in OCT to preserve existing test GREEN state"
key_files:
  created:
    - src/app/api/player-insight/route.test.ts
    - src/lib/hooks/usePlayerInsight.test.ts
    - src/components/shared/PlayerInsightSection.test.tsx
    - src/components/gem-table/GemTable.test.tsx
  modified:
    - src/components/transfers/OpportunityCostTable.test.tsx
decisions:
  - "OCT Phase 105 stubs use it.todo() instead of failing assertions to preserve existing 6 tests GREEN in Wave 0 — static imports of non-existent modules cause Vite transform failure that blocks all tests in the file"
  - "vi.mock factory registered in OCT without static import — Vite resolves imports at transform time, not runtime, so static import of non-existent module breaks entire file"
  - "GemTable.test.tsx uses vi.mock for both usePlayerInsight and PlayerInsightSection (neither exists) — entire file is RED by design per plan acceptance criteria"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-13"
  tasks: 3
  files: 5
---

# Phase 105 Plan 01: RED-Phase Test Scaffolding for NLP-02 Summary

Wave 0 produces 5 test files (3 new, 1 modified, 1 new) totalling 766 lines. Every new artifact needed by Wave 1 has failing test coverage. The cost-explosion safeguard test ("does NOT call mutate from useEffect") is in place before any production code is written.

## Files Created and Line Counts

| File | Lines | State | Notes |
|------|-------|-------|-------|
| `src/app/api/player-insight/route.test.ts` | 215 | RED (11 failing) | Mirror of prose-summary pattern; tests module-not-found |
| `src/lib/hooks/usePlayerInsight.test.ts` | 161 | RED (module-not-found) | renderHook + makeWrapper; 8 stubs |
| `src/components/shared/PlayerInsightSection.test.tsx` | 123 | RED (module-not-found) | 8 stubs + critical cost-explosion safeguard |
| `src/components/gem-table/GemTable.test.tsx` | 118 | RED (module-not-found) | 3 stubs for expand-row integration |
| `src/components/transfers/OpportunityCostTable.test.tsx` | 149 | MODIFIED — 6 existing GREEN + 3 todo | it.todo() stubs for Wave 1 |

## RED-Phase Test Counts

| Test File | Stubs | State |
|-----------|-------|-------|
| route.test.ts | 11 | RED (failing with module-not-found) |
| usePlayerInsight.test.ts | 8 | RED (failing with module-not-found) |
| PlayerInsightSection.test.tsx | 8 | RED (failing with module-not-found) |
| GemTable.test.tsx | 3 | RED (failing with module-not-found) |
| OpportunityCostTable.test.tsx (new stubs) | 3 | TODO (it.todo — Wave 1 converts to real tests) |
| **Total** | **33** | **All pending Wave 1** |

## Confirmed RED State

```
Test Files  4 failed (4)
Tests       11 failed (11)
```

Route test (11 failing, all with "Cannot read properties of undefined" / "module-not-found"):
- POST 400 when body fails zod schema
- 503 when ANTHROPIC_API_KEY missing
- 502 when Anthropic SDK throws
- 422 when both guardrail attempts fail
- retries with strict prompt after first guardrail fail
- 200 with prose on guardrail pass
- put called with allowOverwrite true
- writes blob with key player_insights/gw35/element_100.json
- does NOT call put when USE_BLOB=false
- cache write failure does NOT fail the response
- does not use Edge runtime and sets maxDuration = 30

## Stubs That Unexpectedly Went GREEN

None — all stubs are RED as expected. OCT existing tests (6) are GREEN as required; OCT new stubs are TODO.

## Deviations from Plan

**1. [Rule 1 - Deviation] OCT stubs use it.todo() instead of failing assertions**

- **Found during:** Task 3, Sub-action 3b
- **Issue:** Vitest/Vite resolves module imports at transform time (not runtime). Adding a static import of `@/lib/hooks/usePlayerInsight` (non-existent in Wave 0) to the top of OpportunityCostTable.test.tsx caused the entire test file to fail to transform, breaking the existing 6 column-header tests.
- **Fix:** Used `it.todo()` for the 3 Phase 105 NLP-02 stubs, and registered `vi.mock('@/lib/hooks/usePlayerInsight', factory)` without a static import. The mock factory is in place for Wave 1 to activate when the module is created.
- **Impact:** Plan acceptance criteria `grep -c "vi.mock('@/lib/hooks/usePlayerInsight'" returns 1` is satisfied. Existing OCT tests remain GREEN. The 3 new stubs are TODO (not RED with module-not-found error).
- **Commit:** 064b682

## Threat Flags

None — Wave 0 produces only test scaffolding (no network endpoints, no auth paths, no schema changes).

## Self-Check: PASSED
