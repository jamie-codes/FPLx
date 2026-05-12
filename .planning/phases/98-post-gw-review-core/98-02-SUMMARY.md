---
phase: 98-post-gw-review-core
plan: 02
subsystem: api-route, react-component, vitest
tags: [api-route, react-component, vitest, fpl-bootstrap, gw-review, tdd, bench-computation]

# Dependency graph
requires:
  - phase: 98-01
    provides: "GwReview interface with best_bench_player_name/best_bench_player_pts; stub values in route.ts"
provides:
  - "bench computation in /api/gw-review (benchPicks filter + reduce; empty-bench '—'/0 fallback)"
  - "Best bench info row in GwReviewTab (happy-path branch only, em-dash separator)"
  - "src/app/api/gw-review/route.test.ts — first node-env Vitest suite for this route (3 cases)"
  - "Two new PGW-01 component test cases in GwReviewTab.test.tsx"
affects: [98-03, GwReviewTab, /api/gw-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node-env Vitest route test: vi.mock('fs/promises') + vi.stubGlobal('fetch', url-dispatch mock) + NextRequest factory"
    - "Bench computation: picks.filter(p => p.position > 11) + length > 0 guard before reduce (T-98-05 empty array)"
    - "UI info row: flex items-baseline gap-2 (not flex-wrap) + em-dash separator (U+2014) matching Top scorer style"

key-files:
  created:
    - src/app/api/gw-review/route.test.ts
  modified:
    - src/app/api/gw-review/route.ts
    - src/components/squad/GwReviewTab.tsx
    - src/components/squad/GwReviewTab.test.tsx

key-decisions:
  - "Bench computation insertion point: after topScorer declaration, before captainDelta math — avoids recomputing bench_pts_left (Pitfall 4)"
  - "Empty-bench fallback sentinel '—'/0 at API layer not in type — non-optional contract maintained (D-09)"
  - "Best bench row uses simpler flex items-baseline gap-2 (not flex-wrap) matching Top scorer, not Captain row"
  - "Node-env test uses URL-substring dispatch in fetch mock (url.includes('/picks/') vs /bootstrap-static/) — reusable pattern for future API route tests"
  - "RED test file committed first with stub values confirming test assertion failure; GREEN replaced stubs with real computation"

patterns-established:
  - "API route node-env test: mock fs/promises + vi.stubGlobal fetch dispatch — reuse for any new /api/ route tests"

requirements-completed: [PGW-01]

# Metrics
duration: ~18min
completed: 2026-05-12
---

# Phase 98 Plan 02: PGW-01 Bench Computation + Best Bench Row Summary

**Bench computation added to `/api/gw-review` (highest `total_points` bench pick, empty-bench `'—'`/0 fallback); `GwReviewTab` renders third info row "Best bench"; first node-env Vitest suite for the route (3 TDD cases)**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-12T09:10:00Z
- **Completed:** 2026-05-12T09:28:12Z
- **Tasks:** 2 (TDD: Task 1 RED, Task 2 GREEN)
- **Files created:** 1 (`route.test.ts`)
- **Files modified:** 3 (`route.ts`, `GwReviewTab.tsx`, `GwReviewTab.test.tsx`)

## Accomplishments

- Created `src/app/api/gw-review/route.test.ts` — the first node-env Vitest suite for this route; closes the Wave 0 gap noted in 98-RESEARCH.md Validation Architecture
- 3 test cases cover: best bench player identification, tie-breaking by score (not position order), empty-bench edge case
- Replaced stub values in `route.ts` with real bench computation: `picks.filter(p => p.position > 11)` + guarded reduce
- Empty-bench safety guard: `benchPicks.length > 0` before reduce prevents TypeError on empty array (T-98-05)
- `best_bench_player_name` and `best_bench_player_pts` now populated on every 200 response from `/api/gw-review`
- Added "Best bench" info row to `GwReviewTab`'s data-rendered branch; em-dash separator (U+2014), `flex items-baseline gap-2` (not flex-wrap) matching "Top scorer" row style
- Extended `sampleReview` fixture to `Watkins`/9 and added 2 new component test cases (happy path + empty state absence)
- All 9 targeted tests pass; 0 new TypeScript errors

## Task Commits

1. **Task 1 (RED): node-env test suite for route** — `6ac6e44`
2. **Task 2 (GREEN): bench computation + Best bench row + component tests** — `79737d5`

## Files Created/Modified

- `src/app/api/gw-review/route.test.ts` — NEW; `@vitest-environment node`; 3 test cases; `vi.mock('fs/promises')` + url-substring fetch dispatch
- `src/app/api/gw-review/route.ts` — bench computation block (7 lines) + `best_bench_player_name`/`best_bench_player_pts` fields in review literal
- `src/components/squad/GwReviewTab.tsx` — "Best bench" info row inserted after Captain row closing `</div>` in data-rendered branch
- `src/components/squad/GwReviewTab.test.tsx` — sampleReview updated to Watkins/9; 2 new `it(...)` test cases

## Key Implementation Details

### Bench computation insertion point (route.ts)

Inserted after `const topScorer = optimalCaptain` (line 151 in original), before `captainDelta` math:

```typescript
// Phase 98 PGW-01 / D-09: best bench player = highest total_points among picks with position > 11
const benchPicks = picks.filter((p) => p.position > 11)
const bestBench = benchPicks.length > 0
  ? benchPicks.reduce((best, p) => (p.total_points > best.total_points ? p : best), benchPicks[0])
  : null
```

`bench_pts_left` is unchanged — it stays as `entryHistory.points_on_bench` (Pitfall 4).

### Empty-bench fallback sentinel

`'—'` (em-dash) and `0` are returned when `benchPicks.length === 0`. This keeps `best_bench_player_name` and `best_bench_player_pts` non-optional on the `GwReview` type while handling the edge case gracefully.

### Node-env test mock pattern (reusable for future API route tests)

```typescript
// @vitest-environment node
vi.mock('fs/promises', () => ({ readFile: vi.fn(async () => JSON.stringify({ gw: 34, average_score: 55 })) }))
// URL-substring dispatch:
vi.fn(async (url: string) => {
  if (url.includes('/picks/')) return new Response(JSON.stringify({ ... }), { status: 200 })
  if (url.includes('/bootstrap-static/')) return new Response(JSON.stringify({ elements }), { status: 200 })
  throw new Error(`Unexpected fetch URL: ${url}`)
})
vi.stubGlobal('fetch', fetchMock)
// Cleanup: vi.unstubAllGlobals() + vi.restoreAllMocks() in afterEach
```

## Decisions Made

- Bench computation placed after `topScorer` declaration and before `captainDelta` math — natural grouping with other starters/bench logic, avoids recomputing `bench_pts_left` (Pitfall 4)
- `bestBench` uses optional chaining (`bestBench?.total_points ?? 0`) rather than explicit null check — idiomatic TS, safe
- "Best bench" info row uses `flex items-baseline gap-2` (matching "Top scorer") not `flex flex-wrap` (which is only on "Captain") — per D-08 and 98-UI-SPEC.md
- Separator in component is em-dash ` — ` (U+2014) matching 98-UI-SPEC copywriting contract

## Deviations from Plan

None — plan executed exactly as written. TDD RED → GREEN sequence followed.

## Known Stubs

None — all stub values from Plan 01 have been replaced with real computation.

## Threat Flags

No new threat surface introduced. The bench computation operates on already-validated FPL response data (T-98-04, T-98-05 mitigated as designed in threat model).

## Self-Check: PASSED

- `src/app/api/gw-review/route.test.ts` — exists, first line is `// @vitest-environment node`
- `src/app/api/gw-review/route.ts` — contains `benchPicks` (3 occurrences), `best_bench_player_name:` (1), `best_bench_player_pts:` (1), `'—'` fallback (2 — declaration and in review object)
- `src/components/squad/GwReviewTab.tsx` — contains `Best bench` (1), ` — ` em-dash separator (in Best bench row), `flex flex-wrap` still only 1 (Captain row only)
- `src/components/squad/GwReviewTab.test.tsx` — `best_bench_player_name: 'Watkins'` (1), `best_bench_player_pts: 9` (1), `Best bench` (4)
- Commit `6ac6e44` (Task 1 RED) — FOUND
- Commit `79737d5` (Task 2 GREEN) — FOUND
- `npx vitest run src/app/api/gw-review/route.test.ts src/components/squad/GwReviewTab.test.tsx` → 9/9 pass
- `npx tsc --noEmit` → no errors

---
*Phase: 98-post-gw-review-core*
*Completed: 2026-05-12*
