---
phase: 85-set-piece-threat-assisted-ui
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/app/api/set-pieces/route.ts
  - src/lib/types.ts
  - src/components/set-pieces/SetPieceTakerPanel.tsx
  - src/components/set-pieces/SetPieceTakerPanel.test.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 85: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 85 adds sp_quality fields (delivery_quality_rank, sp_tier, corner/fk danger scores) to the set-piece API response and surfaces per-taker delivery-quality tier badges in the UI. The component and type changes are well-structured. The test coverage for the new badge behaviour (SPQ-03) is thorough and the tier classification logic is correct (higher delivery_quality_rank = Elite, as the field is an EB-shrunk mean-xG score, not an ordinal rank).

One critical crash path exists in the route handler: if `set_piece_changes.json` parses successfully as a non-array-containing value (e.g. `null` or `{}`) while `sp_quality.json` loads successfully, `payload.teams.map(...)` throws an unhandled `TypeError` that bypasses all structured error responses. Two warnings cover percentile distortion from dual-role takers and redundant non-null assertions. Two info items cover test brittleness and a dead code path in tooltip construction.

## Critical Issues

### CR-01: Unhandled crash when `set_piece_changes.json` parses successfully but lacks `teams`

**File:** `src/app/api/set-pieces/route.ts:90`

**Issue:** `JSON.parse(primaryRaw)` at line 74 is inside a `try/catch` that returns a structured 500 on failure. However, if `primaryRaw` parses successfully but yields a value without a `teams` array (e.g., the file contains `null`, `{}`, or `[]`), `payload.teams` is `undefined`. If `sp_quality.json` also loads successfully (`qmap` is non-null), execution reaches line 90:

```ts
const mergedTeams: SetPieceTeam[] = payload.teams.map((team) => ({
```

This throws `TypeError: Cannot read properties of undefined (reading 'map')`. The exception is unhandled — no `try/catch` wraps the qmap-merging block. Next.js catches the uncaught error and emits a plain-text 500, not the `{ error: 'Failed to load set-piece data' }` JSON body that callers expect.

The trigger requires malformed pipeline output, but the pipeline can be disrupted (partial write, corrupted cache). The secondary read's graceful fallback (`console.error` + `qmap = null`) makes this path reachable whenever `set_piece_changes.json` corruption and a valid `sp_quality.json` coincide.

**Fix:** Add a runtime guard immediately after the primary parse:

```ts
let payload: SetPieceChanges
try {
  payload = JSON.parse(primaryRaw) as SetPieceChanges
  if (!payload || !Array.isArray(payload.teams)) {
    return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
  }
} catch {
  return Response.json({ error: 'Failed to load set-piece data' }, { status: 500 })
}
```

## Warnings

### WR-01: Dual-role takers double-counted in percentile pool, distorting tier cutoffs

**File:** `src/app/api/set-pieces/route.ts:99-105`

**Issue:** The ranks pool is built by iterating over all teams and pushing both `fk_taker.delivery_quality_rank` and `corner_taker.delivery_quality_rank`. When the same player holds both roles for a team, `mergeSpQualityIntoTaker` copies their single `sp_quality.json` entry (one composite score) onto both the `fk_taker` and `corner_taker` objects. Their score is pushed twice into `ranks`.

This double-counts that player in `sorted[]` (the array used by `pickAt` to compute p25/p75), shifting the quartile cutoffs. With several dual-role takers, the upper percentile is inflated, which can push borderline players from `Good` to `Elite` or prevent genuinely weak deliverers from being classified `Weak`. The `distinct` deduplication at line 29 prevents false pass/fail of the `< 4` threshold, but it does not protect the `sorted[]` pool.

**Fix:** Deduplicate by taker ID before pushing to the pool:

```ts
const seen = new Set<number>()
for (const team of mergedTeams) {
  for (const taker of [team.fk_taker, team.corner_taker]) {
    if (typeof taker.delivery_quality_rank === 'number' && taker.id != null && !seen.has(taker.id)) {
      seen.add(taker.id)
      ranks.push(taker.delivery_quality_rank)
    }
  }
}
```

### WR-02: Redundant non-null assertions inside a narrowed `if (qmap)` block

**File:** `src/app/api/set-pieces/route.ts:92-94`

**Issue:** `qmap!` is used three times inside an `if (qmap)` block. TypeScript narrows `qmap` to `SpQualityMap` (non-null) upon entry to the `if` branch, so the `!` assertions are redundant. While harmless at runtime, they suppress TypeScript's narrowing signals and could confuse future readers into thinking `qmap` might be null at those call sites.

**Fix:** Remove the `!` operators; the type is already narrowed:

```ts
penalty_taker: mergeSpQualityIntoTaker(team.penalty_taker, qmap),
fk_taker:      mergeSpQualityIntoTaker(team.fk_taker, qmap),
corner_taker:  mergeSpQualityIntoTaker(team.corner_taker, qmap),
```

## Info

### IN-01: `buildSpQualityTooltip` substitutes `n=0` when `sp_sample_n` is `null` or `undefined`, producing a misleading tooltip

**File:** `src/components/set-pieces/SetPieceTakerPanel.tsx:23-26`

**Issue:** `buildSpQualityTooltip` is called only when `sp_tier` is non-null (a badge is shown). A non-null `sp_tier` implies the taker has a `delivery_quality_rank`, which requires at least `FK_MIN_N=3` or `CORNER_MIN_N=5` actual shots — so `sp_sample_n` should always be a positive integer in production. However, if `sp_sample_n` arrives as `null` or `undefined` (e.g. from a schema change or partial pipeline output), the tooltip silently displays `(n=0 shots)`, which is factually wrong and could mislead users into thinking no data exists for an Elite/Good/Weak taker.

**Fix:** Either assert that `sampleN` is always a positive integer at this call site, or surface an explicit placeholder:

```ts
function buildSpQualityTooltip(sampleN: number | null | undefined): string {
  const n = (typeof sampleN === 'number' && sampleN > 0) ? sampleN : '?'
  return `xG generated by this taker's assisted set-piece shots — measures how often their deliveries produce high-xG chances (n=${n} shots)`
}
```

### IN-02: SHD-01 tests rely on un-mocked `useTeamBadge` and `RotationRiskBadge` module-level imports

**File:** `src/components/set-pieces/SetPieceTakerPanel.test.tsx:45-77`

**Issue:** The SHD-01 ghost-watermark tests assert on `img[aria-hidden="true"]` rendered (or absent) based on whether the team short name is in `TEAM_BADGE_CODE`. `useTeamBadge` is not mocked; it executes real code from `@/lib/team-colours` and `@/lib/fpl-images`. Similarly, `RotationRiskBadge` is not mocked. This couples the tests to both modules' implementations: a rename in `TEAM_BADGE_CODE` (e.g. `ARS` key changed), a change to `teamBadgeUrl`, or any DOM-incompatible side-effect in `RotationRiskBadge` will silently break the SHD-01 assertions with no indication the cause is outside the component under test.

**Fix:** Either mock `useTeamBadge` in the test file alongside the other hooks, or add a brief comment documenting the intentional coupling so future authors know these tests depend on `TEAM_BADGE_CODE['ARS']` existing and `TEAM_BADGE_CODE['XYZ']` being absent.

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
