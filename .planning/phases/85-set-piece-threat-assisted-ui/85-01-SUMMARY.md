---
phase: 85-set-piece-threat-assisted-ui
plan: "01"
subsystem: api-types
tags: [set-pieces, sp-quality, types, api-route, quartile-tier]
dependency_graph:
  requires: [84-set-piece-threat-assisted-pipeline]
  provides: [SetPieceTaker-sp-quality-fields, api-set-pieces-sp-tier]
  affects: [src/lib/types.ts, src/app/api/set-pieces/route.ts]
tech_stack:
  added: []
  patterns: [dual-read-try-catch, quartile-nearest-rank, server-side-tier-classification]
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - src/app/api/set-pieces/route.ts
decisions:
  - "readJsonArtifact helper centralises Blob/local dual-read; sp_quality.json read in separate try/catch per D-06"
  - "computeQuartileCutoffs uses nearest-rank method; <4 distinct ranked takers -> all default to Good"
  - "Penalty takers excluded from rank pool per D-01; sp_tier left undefined on penalty_taker"
  - "grep -c 'set_piece_changes.json' returns 1 (not 2) because both localFilename and blobPrefix args appear on the same function-call line; behavior is correct"
metrics:
  duration: ~15 minutes
  completed: "2026-05-09"
  tasks: 2
  files_modified: 2
requirements_satisfied: [SPQ-03]
---

# Phase 85 Plan 01: Set-Piece Threat API Contract Summary

Extended `SetPieceTaker` interface with 5 flat optional sp_quality fields and rewrote `/api/set-pieces` to merge `sp_quality.json` into each taker and compute server-side `sp_tier` via P25/P75 quartile logic across all FK and corner takers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend SetPieceTaker type with sp_quality fields | 9e9de78 | src/lib/types.ts |
| 2 | Extend /api/set-pieces to merge sp_quality.json and compute sp_tier | 69a097a | src/app/api/set-pieces/route.ts |

## What Was Built

### Task 1 — SetPieceTaker type extension

Added 5 flat optional fields to `SetPieceTaker` in `src/lib/types.ts`:
- `corner_danger_score?: number | null`
- `fk_danger_score?: number | null`
- `delivery_quality_rank?: number | null`
- `sp_sample_n?: number | null`
- `sp_tier?: 'Elite' | 'Good' | 'Weak' | null`

`SetPieceTeam` and `SetPieceChanges` interfaces unchanged. `tsc --noEmit` clean throughout.

### Task 2 — Route extension

Rewrote `src/app/api/set-pieces/route.ts` (112 insertions, 20 deletions):
- `readJsonArtifact(localFilename, blobPrefix)` helper centralises Blob/local dual-read (DRY, mirrors existing USE_BLOB pattern)
- Primary read (`set_piece_changes.json`) failure remains fatal (500) — preserves existing behaviour
- Secondary read (`sp_quality.json`) failure is non-fatal: logs `console.error` once, returns primary payload with sp_quality fields omitted
- `mergeSpQualityIntoTaker`: joins on `taker.id?.toString()` per Phase 84 D-06; tolerates null `id`; merges nulls from below-threshold entries
- `computeQuartileCutoffs`: nearest-rank P25/P75; `<4 distinct` ranked takers returns `null` (triggers 'Good' fallback for all)
- `classifyTier`: rank >= P75 -> Elite; rank <= P25 -> Weak; else Good; null rank -> null
- Rank pool built from FK + corner takers ONLY (penalty_taker excluded per D-01)
- sp_tier assigned on `fk_taker` and `corner_taker`; `penalty_taker` gets sp_quality fields merged but no sp_tier
- `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` preserved

## Deviations from Plan

### Minor spec inconsistency (documented, not a bug)

**[Documentation] grep -c 'set_piece_changes.json' acceptance criterion**
- **Expected:** `grep -c` returns 2 (plan expected two separate lines for local filename and Blob prefix)
- **Actual:** Returns 1 (both args appear on the same `readJsonArtifact(...)` call line)
- **Why:** The plan's code spec refactored the dual-read into a helper function — both `set_piece_changes.json` references appear as args on a single line, so `grep -c` (which counts matching lines) returns 1, not 2
- **Impact:** None — the behavior is correct; `set_piece_changes.json` IS passed as both `localFilename` and `blobPrefix` exactly as required

## Pre-existing Test Failures (Out of Scope)

The following test failures existed before this plan and are unrelated to this plan's changes:
- `tests/lib/captain-picks.test.ts` (5 failures) — documented in STATE.md as `TEST-57`
- `src/components/nav/MobileNav.test.tsx` (8 failures) — documented in STATE.md as `WR-03/WR-04`
- `tests/lib/club-form.test.ts` (1 failure) — pre-existing

All set-pieces tests pass: `SetPieceTakerPanel.test.tsx` 3/3 passing.

## Known Stubs

None — this plan establishes the API contract. Plan 02 wires the UI rendering.

## Threat Flags

None — this plan adds no new network endpoints. The `/api/set-pieces` route already existed; this extends its response shape.

## Self-Check: PASSED

- src/lib/types.ts — modified, `grep -n sp_tier` returns line 577
- src/app/api/set-pieces/route.ts — modified with 112 insertions
- Commit 9e9de78 — Task 1 (types.ts)
- Commit 69a097a — Task 2 (route.ts)
- `npx tsc --noEmit` exits 0
- `SetPieceTakerPanel.test.tsx` 3/3 passing
