# Phase 85: Set-Piece Threat Assisted UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 85-set-piece-threat-assisted-ui
**Areas discussed:** Badge scope, Tier computation location, Type shape

---

## Badge Scope

| Option | Description | Selected |
|--------|-------------|----------|
| FK + corners only | Only Direct FK and Corners rows get the badge — penalty takers don't make assisted deliveries | |
| All 3 taker rows | All rows show a badge; penalty-only takers show "—" via graceful fallback | |
| You decide | Use best judgement given existing card layout | ✓ |

**User's choice:** You decide
**Notes:** Claude chose FK + corners only — penalty takers don't assist shots so showing a badge would always be "—" with no signal value.

---

## Tier Computation Location

| Option | Description | Selected |
|--------|-------------|----------|
| API route | Route collects all ranked takers, computes quartile cuts, emits tier string per taker | ✓ |
| Frontend | API sends raw delivery_quality_rank and total count; component computes tier | |
| You decide | Use best judgement | |

**User's choice:** API route (Recommended)
**Notes:** Keeps tier logic server-side; frontend renders the pre-computed string.

---

## Type Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat optional fields | Add 5 fields directly to SetPieceTaker — matches existing flat interface shape | ✓ |
| Nested sp_quality object | Add sp_quality?: { ... } nested object to SetPieceTaker | |
| You decide | Use best judgement | |

**User's choice:** Flat optional fields (Recommended)
**Notes:** Consistent with existing `now_cost?`, `selected_by_percent?`, `fixtures?`, `roles?` optional fields already on the interface.

---

## Claude's Discretion

- **Badge scope**: FK + corners only (penalty takers excluded — no delivery quality signal)
- **Badge layout**: Inline after player name, matching existing "Changed" badge pattern
- **Tooltip for "—" badge**: No tooltip when sp_tier is null (insufficient data case)
- **API merge strategy**: sp_quality.json read in separate try/catch after primary read; failure does not fail the route

## Deferred Ideas

None — discussion stayed within phase scope.
