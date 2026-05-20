---
phase: 129-squad-cost-simulator
plan: 02
subsystem: api-route
tags:
  - types
  - api-route
  - phase-129
  - pre-season-squad
  - COST-02
dependency_graph:
  requires:
    - "src/lib/types.ts (PreSeasonPlayer, PreSeasonSquad, SquadHealth, PreSeasonSquadResponse)"
    - "src/lib/pre-season-squad.ts (buildPreSeasonSquad)"
    - "src/app/api/pre-season-squad/route.test.ts (Wave 0 RED tests from Plan 01)"
  provides:
    - "PreSeasonSquadInputs interface (players, scoreMap, budget_default)"
    - "PreSeasonSquadResponse.inputs optional field (Phase 129 COST-02)"
    - "GET /api/pre-season-squad?include=inputs route handler (query-param gate)"
    - "loadSquadInputs shared helper (extracted from Resolution 2 inline code)"
  affects:
    - "Phase 129 Wave 2 (hook + component slider) — hook and component can now call ?include=inputs"
    - "Phase 127 watchlist — existing callers compile unchanged (optional inputs? field)"
tech_stack:
  added: []
  patterns:
    - "NextRequest + new URL(request.url).searchParams for query-param parsing in route handlers"
    - "4-way conditional Promise.all for D-01 parallel reads gated on includeInputs"
    - "Conditional spread ...(inputs ? { inputs } : {}) pattern for optional response fields"
    - "Object.fromEntries(Map) serialisation at route boundary (D-03 Pitfall 2 guard)"
    - "Shared helper extracted from inline logic to serve multiple resolution paths"
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - src/app/api/pre-season-squad/route.ts
decisions:
  - "loadSquadInputs is synchronous (non-async) — takes raw JSON strings, owns parse step, returns null on failure"
  - "Resolution 1 graceful degradation: archive/bootstrap missing under includeInputs=true returns plain ILP envelope (no 503, no inputs)"
  - "Resolution 2 when includeInputs=false: fresh readBlobOrLocal calls (preserves D-02 no-extra-I/O contract)"
  - "inputs variable declared per resolution path (not hoisted) to keep type narrowing clean"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 129 Plan 02: Types + Route Extension (Wave 1) Summary

**One-liner:** Extended PreSeasonSquadResponse with optional inputs field and refactored /api/pre-season-squad to attach PreSeasonSquadInputs envelope on ?include=inputs query param with loadSquadInputs shared helper and graceful degradation on both resolution paths.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PreSeasonSquadInputs type and extend PreSeasonSquadResponse | d6f4fa3 | src/lib/types.ts |
| 2 | Refactor pre-season-squad route to attach inputs envelope on ?include=inputs | a495d18 | src/app/api/pre-season-squad/route.ts |

## Interface Signatures

### PreSeasonSquadInputs (new)

```typescript
export interface PreSeasonSquadInputs {
  players: PreSeasonPlayer[]        // full eligible player pool with 500+ minutes from GW38 archive
  scoreMap: Record<string, number>  // Record<string,number>; client hydrates to Map<number,number> per D-03
  budget_default: number            // FPL tenths-of-million; 1000 = £100m per D-04
}
```

### PreSeasonSquadResponse (extended)

```typescript
export interface PreSeasonSquadResponse {
  squad: PreSeasonSquad | null
  health: SquadHealth | null
  solver: 'ilp' | 'greedy' | null
  inputs?: PreSeasonSquadInputs     // Phase 129 COST-02; present only when ?include=inputs query param was set
}
```

### GET handler (new signature)

```typescript
export async function GET(request: NextRequest): Promise<Response>
```

### loadSquadInputs helper (new, private)

```typescript
function loadSquadInputs(
  archiveText: string,
  bootstrapText: string,
): { players: PreSeasonPlayer[]; scoreMap: Map<number, number> } | null
```

Returns null if JSON parse fails OR if no eligible players (< 500 minutes) remain.

## Wave 0 Route Test Pass Count

**6/6 GREEN** — All Wave 0 route tests in `src/app/api/pre-season-squad/route.test.ts` pass:

1. omits inputs field when ?include=inputs absent (Resolution 1 ILP path) — GREEN
2. attaches inputs on ILP path when ?include=inputs present — GREEN
3. attaches inputs on greedy path when ?include=inputs present — GREEN
4. scoreMap serialises as Record<string,number> with non-empty keys — GREEN
5. returns 404 when archive absent (both with and without ?include=inputs) — GREEN
6. degrades gracefully when archive/bootstrap missing under includeInputs=true (no 503) — GREEN

## Phase 127 Watchlist Non-Regression

**Confirmed:** GET /api/pre-season-squad (without ?include=inputs) returns the identical `{ squad, health, solver }` envelope shape. The `inputs?` field is absent because:
- The conditional spread `...(inputs ? { inputs } : {})` only activates when `includeInputs === true` AND the helper returns non-null
- The optional `?` on `PreSeasonSquadInputs` in `PreSeasonSquadResponse` ensures all existing TypeScript callers compile unchanged
- All 13 pre-existing `NextSeasonPlannerTab.test.tsx` tests (which mock envelopes without inputs) pass GREEN

## Full Test Suite Status

| Test File | Expected | Actual |
|-----------|----------|--------|
| route.test.ts (6 tests) | 6 GREEN | 6 GREEN |
| NextSeasonPlannerTab.test.tsx (28 tests) | 17 GREEN, 11 RED | 17 GREEN, 11 RED |
| pre-season-squad.test.ts (8 tests) | 8 GREEN | 8 GREEN |
| Full suite (1568 tests) | 1 file failed (11 Wave 0 component RED) | 1 file failed (11 Wave 0 component RED) |

Wave 0 component tests remain RED as designed — Wave 2/3 (hook + component slider) will resolve them.

## Deviations from Plan

None — plan executed exactly as written. The route refactor, type additions, and test results all match the plan's acceptance criteria verbatim.

## Known Stubs

None — production code delivers the full COST-02 server-side contract. The Wave 0 component RED tests are intentional test scaffolding from Plan 01, not stubs.

## Threat Flags

No new network endpoints or auth paths. The `?include=inputs` extension adds parallel blob reads (archive + bootstrap) which are read-only file operations already used in Resolution 2. No new trust boundaries.

## Self-Check: PASSED

- [x] src/lib/types.ts modified — PreSeasonSquadInputs exported at line 1148, inputs? on PreSeasonSquadResponse at line 1142
- [x] src/app/api/pre-season-squad/route.ts modified — GET(request: NextRequest) at line 111, loadSquadInputs at line 40
- [x] Commit d6f4fa3 exists in git log (types)
- [x] Commit a495d18 exists in git log (route)
- [x] All 6 Wave 0 route tests GREEN
- [x] All 13 pre-existing component tests GREEN (17 total passing including 4 Wave 0 gate tests)
- [x] 11 Wave 0 component RED tests remain RED as expected
- [x] TypeScript: 1 error (pre-existing in decision-history/route.test.ts, unrelated to this plan)
