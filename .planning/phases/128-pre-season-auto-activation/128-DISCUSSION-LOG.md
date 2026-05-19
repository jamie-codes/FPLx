# Phase 128: Pre-Season Auto-Activation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 128-pre-season-auto-activation
**Areas discussed:** Activation sequencing, Schema + inactive response, Status pill placement, Banner content + placement

---

## Activation Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Nested in IS_OFF_SEASON | Tri-state already requires IS_OFF_SEASON — keep inside that block, after GW38 gate, as a separate sub-block | ✓ |
| Separate top-level check | Evaluate IS_OFF_SEASON again independently, before or after the existing block | |
| You decide | Planner picks the cleanest structure | |

**User's choice:** Nested in IS_OFF_SEASON (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Blob + local idempotency only | Skip the 'already exists' check and re-run full ILP. All other logic runs normally. | ✓ |
| Full skip — delete old + rewrite | Explicitly delete pre_season_squad.json before re-running | |
| You decide | Planner chooses | |

**User's choice:** Blob + local idempotency only (Recommended)

---

## Schema + Inactive Response

| Option | Description | Selected |
|--------|-------------|----------|
| Year pair from deadline_time | events[0].deadline_time year → e.g. "2526". Human-readable, stable. | ✓ |
| GW1 event id (events[0].id) | Opaque integer unique to the season | |

**User's choice:** Year pair from deadline_time (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| 404 | Consistent with /api/pre-season-squad pattern. usePreSeasonActive treats null as 'Awaiting'. | ✓ |
| 200 { active: false } | Allows hook to distinguish 'not activated' from 'fetch error' | |
| You decide | Planner picks cleanest approach | |

**User's choice:** 404 (Recommended)

---

## Status Pill Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top of tab content | Standalone status row at top of tab body, before formation grid | ✓ |
| Inline with solver badge | Same headline row as ILP/Greedy badge | |
| You decide | Planner picks cleanest layout | |

**User's choice:** Top of tab content (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show everything | Formation grid and health indicator still visible when Awaiting | ✓ |
| Placeholder only | Awaiting pill replaces formation grid with placeholder message | |

**User's choice:** Yes, show everything (Recommended)

---

## Banner Content + Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Between pill and grid | Inline alert block between status row and formation grid | ✓ |
| Above the pill | Full-width banner at very top of tab | |
| Toast | Transient pop-up in corner | |

**User's choice:** Between pill and grid (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Short + action-oriented | "🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices." | ✓ |
| Informational | More technical detail about bootstrap data and ILP re-run | |
| You decide | Planner writes something fitting the app's tone | |

**User's choice:** Short + action-oriented (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| X icon top-right | Small × button. Sets nsp_activation_seen_{seasonId} in localStorage. | ✓ |
| "Got it" button inline | Text button inside the banner | |

**User's choice:** X icon top-right (Recommended)

---

## Claude's Discretion

- Exact Tailwind classes for status pill and banner
- TanStack Query staleTime for usePreSeasonActive()
- Whether pre_season_active.json write uses save() from upload.py
- Error handling in the activation block (non-fatal pattern)

## Deferred Ideas

None — discussion stayed within phase scope
