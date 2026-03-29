---
phase: 01-data-foundation
plan: 01
subsystem: scaffold
tags: [nextjs, vitest, typescript, zod, scaffold]
dependency_graph:
  requires: []
  provides:
    - Next.js 16 project scaffold with app router
    - Shared TypeScript types (FPLElement, FPLTeam, FPLEvent, FPLBootstrap, PlayerIdMapEntry, PlayerIdMap, PipelineMetadata)
    - Vitest test framework with path alias
    - FPL bootstrap fixture for unit tests
  affects:
    - All subsequent plans in Phase 1 (import from @/lib/types)
    - Plans 02+ (Zod adapter tests use fixture and types)
tech_stack:
  added:
    - next@16.2.1
    - react@19.2.4
    - zod@^4.3.6
    - "@vercel/blob@^2.3.1"
    - vitest@^4.1.2
    - "@vitest/ui@^4.1.2"
    - tailwindcss@^4
    - typescript@^5
  patterns:
    - Next.js App Router with src/ directory layout
    - Vitest with node environment and @ path alias
    - TypeScript strict mode with @/* path alias
key_files:
  created:
    - package.json (updated with all Phase 1 dependencies and test script)
    - tsconfig.json (TypeScript config with @/* alias)
    - next.config.ts (Next.js 16 config)
    - vitest.config.ts (Vitest with node env and @ alias)
    - src/lib/types.ts (shared FPL TypeScript interfaces)
    - src/app/page.tsx (minimal FPLX placeholder)
    - src/app/layout.tsx (Next.js root layout)
    - src/app/globals.css (Tailwind CSS globals)
    - .env.local.example (env var documentation)
    - .gitignore (with pipeline/cache/ and .env.local entries)
    - tests/lib/fpl-adapter.test.ts (11 todo stubs + 1 passing test)
    - tests/fixtures/bootstrap-static-sample.json (3-player FPL fixture)
  modified: []
decisions:
  - "Scaffolded in temp directory then copied to project root to avoid create-next-app conflict with existing .planning/ directory"
  - "Removed default Next.js SVG assets and README (not needed for this app)"
metrics:
  duration: 6 minutes
  completed: "2026-03-27"
  tasks_completed: 2
  files_created: 12
---

# Phase 1 Plan 1: Project Scaffold and Shared Types Summary

**One-liner:** Next.js 16 scaffold with Zod, Vitest, and shared TypeScript types for FPL data shapes including set piece taker order fields and nullable 2025/26 stat fields.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold Next.js 16 project with all Phase 1 dependencies | 70263e9 | package.json, .env.local.example, .gitignore, src/app/page.tsx |
| 2 | Create shared TypeScript types and Vitest config with test stubs | fdb6389 | src/lib/types.ts, vitest.config.ts, tests/lib/fpl-adapter.test.ts, tests/fixtures/bootstrap-static-sample.json |

## Verification Results

- `npx next build`: PASSED — static site compiles cleanly, / and /_not-found routes generated
- `npx vitest run`: PASSED — 1 test passed, 11 todo stubs, 0 failures

## Key Artifacts

### src/lib/types.ts

Exports the full type contract for all downstream plans:
- `FPLElement` — 18 fields including nullable 2025/26 stats (`defensive_contributions`, `clearances_blocks_interceptions`) and set piece taker order fields (`direct_freekicks_order`, `penalties_order`, `corners_and_indirect_freekicks_order`)
- `FPLTeam`, `FPLEvent`, `FPLBootstrap` — complete bootstrap-static shape
- `PlayerIdMapEntry`, `PlayerIdMap` — FPL-to-Understat ID bridge types
- `PipelineMetadata` — cache metadata with `stale` flag per D-06

### tests/fixtures/bootstrap-static-sample.json

3-player fixture covering edge cases:
- Player with all set piece taker fields null (Magalhães — defender, no SP roles)
- Player with direct freekicks and corner taker orders (Saka)
- Player with penalty taker order and null defensive stats (Wissa — promoted-team forward)
- Extra field `extra_field_that_should_be_stripped` to verify Zod strip behavior in Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded in temp directory due to create-next-app conflict**
- **Found during:** Task 1
- **Issue:** `create-next-app` refused to scaffold in the project directory because `.planning/` and `pipeline/` already existed as conflicting files
- **Fix:** Ran scaffold in `/tmp/nextjs-scaffold`, then individually copied all generated files to `C:/users/jamie/fplx/`. Removed default Next.js placeholder assets (SVG files, README) that are not needed for this app.
- **Files modified:** All scaffolded files
- **Commit:** 70263e9

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| tests/lib/fpl-adapter.test.ts | 11 `it.todo()` stubs | Intentional — Plan 02 will implement `src/lib/fpl-adapter.ts` and fill these in |

These stubs are intentional per plan design. Plan 02 (Zod adapter) will wire `@/lib/fpl-adapter` and resolve all todos.

## Self-Check: PASSED
