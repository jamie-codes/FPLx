# Phase 44: Comparison Output - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 44-Comparison Output
**Areas discussed:** View integration, Comparison format, Change highlight style

---

## View Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace pitch | Comparison IS the main Optimiser view — Phase 43 pitch dropped | ✓ |
| Pitch + comparison below | Phase 43 pitch stays at top; comparison scrolls below | |
| Toggle (Pitch \| Compare) | Two modes switchable via button/tab within OptimiserPanel | |

**User's choice:** Replace pitch
**Notes:** Comparison replaces the pitch entirely — the Phase 43 green pitch graphic and player circles are dropped. The comparison table is the sole output once the engine returns a result.

---

## Comparison Format

| Option | Description | Selected |
|--------|-------------|----------|
| Position-grouped table | GK / DEF / MID / FWD sections + Bench section; 15 slots total | ✓ |
| Flat slot table | All 11 rows in slot order 1–11, no position group headers | |

**User's choice:** Position-grouped table  
**Notes:** Full 15-slot coverage confirmed (XI + bench) — a player demoted from the XI appears in the Bench section with a Dropped badge.

---

## Change Highlight Style

| Option | Description | Selected |
|--------|-------------|----------|
| Left accent border + delta pill | Green 2px border-l + green `+X.X xPts` pill on changed rows | ✓ |
| Row background highlight | Subtle green bg tint on changed rows | |
| Delta column always visible | Δ column for every row, blank for unchanged | |

**User's choice:** Left accent border + delta pill  
**Notes:** Bench changed rows get Promoted/Dropped badge instead of numeric delta (follow-up question confirmed this).

---

## Follow-up: Formation Label

| Option | Description | Selected |
|--------|-------------|----------|
| Inline with headline | `Formation: 4-3-3 │ Changes: N players │ +X.X xPts` | ✓ |
| Drop formation label | Position-grouped sections make it self-evident | |

**User's choice:** Inline with headline

---

## Follow-up: Bench Delta Display

| Option | Description | Selected |
|--------|-------------|----------|
| Promoted/Dropped label only | Badge instead of numeric delta for bench changes | ✓ |
| xPts delta (same as XI rows) | Numeric +/- delta for bench rows too | |

**User's choice:** Promoted/Dropped label only  
**Notes:** Bench xPts impact is indirect (auto-sub only) so numeric delta is noisy.

---

## Claude's Discretion

- Tailwind layout approach for the table (grid vs flex vs plain block — no TanStack Table)
- Mobile: whether unchanged bench rows get `opacity-60` de-emphasis
- Mobile "Changes badge" interpreted as the count in the headline area (not per-row — per-row highlighting already covers CMP-03)
- Typography sizing follows 43-UI-SPEC.md xs/sm token scale

## Deferred Ideas

None — discussion stayed within phase scope.
