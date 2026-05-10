---
phase: 88-fpl-news-flags-ui
plan: "01"
subsystem: news-flags
tags: [tdd, red-phase, test-scaffold, vitest, react-testing-library]
dependency_graph:
  requires: []
  provides:
    - src/lib/newsSeverity.test.ts
    - src/lib/hooks/useAccuracy.test.ts
    - src/components/news/NewsBanner.test.tsx
    - src/components/news/NewsBadge.test.tsx
    - src/components/news/types.ts
  affects: []
tech_stack:
  added: []
  patterns:
    - vitest pure-utility test scaffold (formatRelativeTime analog)
    - jsdom + renderHook + makeWrapper/installFetchMock (useEntryRank analog)
    - RTL render + container.querySelector + vi.mock (FragilityNote analog)
key_files:
  created:
    - src/lib/newsSeverity.test.ts
    - src/lib/hooks/useAccuracy.test.ts
    - src/components/news/NewsBanner.test.tsx
    - src/components/news/NewsBadge.test.tsx
    - src/components/news/types.ts
  modified: []
decisions:
  - "types.ts re-exports NewsSeverity from @/lib/newsSeverity even though the module does not exist yet — intentional RED signal at the type-check layer"
  - "useAccuracy.test.ts asserts data?.summary?.news_flag_enabled path (not data?.news_flag_enabled) — pins the AccuracySummary nesting critical pitfall"
  - "NewsBadge tests use container.textContent not innerHTML — guards T-088-01 XSS threat (confirms text-content path)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-10"
  tasks: 3
  files: 5
---

# Phase 88 Plan 01: RED Phase — News Flags Test Scaffold Summary

RED phase scaffolding for SCRAPER-01: 4 failing Vitest test files + 1 shared type-contract file. All 17+ assertions encoding every locked behavioural decision before any implementation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — newsSeverity unit tests + component type contracts | 18aad87 | src/lib/newsSeverity.test.ts, src/components/news/types.ts |
| 2 | RED — useNewsFlagEnabled hook tests (3 cases) | c9470cc | src/lib/hooks/useAccuracy.test.ts |
| 3 | RED — NewsBanner + NewsBadge component tests (9 cases) | 1536053 | src/components/news/NewsBanner.test.tsx, src/components/news/NewsBadge.test.tsx |

## Test Counts Per File

| File | Test Count | RED Failure Mode |
|------|-----------|-----------------|
| src/lib/newsSeverity.test.ts | 12 | Module-resolution: `./newsSeverity` not found |
| src/lib/hooks/useAccuracy.test.ts | 3 | Named export `useNewsFlagEnabled` not in `useAccuracy.ts` |
| src/components/news/NewsBanner.test.tsx | 5 | Module-resolution: `./NewsBanner` not found |
| src/components/news/NewsBadge.test.tsx | 4 | Module-resolution: `./NewsBadge` not found |
| **Total** | **24** | — |

## RED-State Failure Modes

- **newsSeverity.test.ts**: Fails at import-resolution stage (Vite TransformPluginContext error). `Cannot find module './newsSeverity'`.
- **useAccuracy.test.ts**: Fails at runtime — module resolves but `useNewsFlagEnabled` is not exported, resulting in `undefined is not a function` when the hook is called inside `renderHook`.
- **NewsBanner.test.tsx**: Fails at import-resolution stage. `Cannot find module './NewsBanner'`.
- **NewsBadge.test.tsx**: Fails at import-resolution stage. `Cannot find module './NewsBadge'`.

## Contracts Pinned

### D-09 Severity Thresholds (12 cases in newsSeverity.test.ts)

| Input | Expected |
|-------|---------|
| chance=null, news='' | 'none' |
| chance=null, news=undefined | 'none' |
| chance=100, news='' | 'none' |
| chance=100, news='   ' (whitespace) | 'none' |
| chance=100, news='Returned from international duty' | 'zinc' |
| chance=null, news='Knock' | 'zinc' |
| chance=undefined, news='Knock' | 'zinc' |
| chance=75, news='Knock - 75% chance' | 'amber' |
| chance=75, news='' | 'amber' |
| chance=50, news='Hamstring' | 'red' |
| chance=25, news='Calf' | 'red' |
| chance=0, news='Out indefinitely' | 'red' |

### D-03 Gate Accessor Nesting (3 cases in useAccuracy.test.ts)

- `data?.summary?.news_flag_enabled` path is the only acceptable read path
- Test #3 (`summary: {}`) pins the default-false safety against missing field
- Prevents Wave 1 from accidentally using `data?.news_flag_enabled` (root-level — PATTERNS.md critical pitfall #1)

### UI Contract (9 cases in NewsBanner + NewsBadge tests)

- red severity → `text-red-600 dark:text-red-400`, ⚠ icon, data-testid="news-banner"
- amber severity → `text-amber-600 dark:text-amber-400`, ⚠ icon
- zinc severity → `text-zinc-500 dark:text-zinc-400`, ℹ icon
- Gate OFF → `container.firstChild === null` (no residual DOM)
- Severity 'none' → `container.firstChild === null` (no residual DOM)
- NewsBadge returns news text as text node (not wrapped); whitespace-only → null

### T-088-01 XSS Guard

- NewsBadge tests assert `container.textContent` (not innerHTML) — confirms text-content path
- Wave 1 must NOT use `dangerouslySetInnerHTML` (test assertions would still pass but threat model violated)

## Deviations from Plan

None — plan executed exactly as written.

## Hand-off Note to Wave 1

Implement these 4 modules in order — the test suite drives the contract:

1. **`src/lib/newsSeverity.ts`** — `export type NewsSeverity`, `export function computeNewsSeverity(chance?, news?): NewsSeverity`. See PATTERNS.md §newsSeverity.ts for the exact implementation. Satisfies 12 RED tests.

2. **`useNewsFlagEnabled` export in `src/lib/hooks/useAccuracy.ts`** — append `export function useNewsFlagEnabled(): boolean { const { data } = useAccuracy(); return data?.summary?.news_flag_enabled ?? false }`. Satisfies 3 RED tests.

3. **`src/components/news/NewsBadge.tsx`** — thin hook-driven component returning news string or null. Satisfies 4 RED tests.

4. **`src/components/news/NewsBanner.tsx`** — severity-coloured inline banner mirroring FragilityNote. Satisfies 5 RED tests.

After all 4 modules created: `npm run test -- newsSeverity NewsBanner NewsBadge useAccuracy --run` must exit 0 (all GREEN).

## Self-Check: PASSED

Files created:
- src/lib/newsSeverity.test.ts: EXISTS
- src/lib/hooks/useAccuracy.test.ts: EXISTS
- src/components/news/NewsBanner.test.tsx: EXISTS
- src/components/news/NewsBadge.test.tsx: EXISTS
- src/components/news/types.ts: EXISTS

Commits:
- 18aad87: test(88-01): RED — newsSeverity unit tests + news component type contracts
- c9470cc: test(88-01): RED — useNewsFlagEnabled hook tests (3 cases)
- 1536053: test(88-01): RED — NewsBanner + NewsBadge component tests (9 cases)
