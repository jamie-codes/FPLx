# Phase 1: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 01-data-foundation
**Areas discussed:** Player ID mapping bootstrap, Zod schema strictness

---

## Player ID Mapping Bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Community CSV + pipeline merge | vaastav/Fantasy-Premier-League GitHub repo, covers ~500 players upfront | ✓ |
| Manual top-tier only | Handcraft JSON for ~100-150 most-transferred players, null for rest | |
| Fuzzy name matching (auto) | Unicode normalisation + Levenshtein, ~15-20% mismatch rate | |

**User's choice:** Community CSV + pipeline merge (recommended)
**Notes:** No additional clarifications — default recommendation accepted.

---

## Unmatched Players (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Null xG/xA, include in tables | Dash shown in xG/xA columns; Gem score on available dims | ✓ |
| Exclude from tables entirely | Hidden from Gem/DefCon views if no Understat data | |

**User's choice:** Null xG/xA, include in tables (recommended)
**Notes:** Honest representation preferred over hiding data gaps.

---

## Zod Schema Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Used-fields only | Validate only consumed fields; ignore FPL additions | ✓ |
| Full known schema | Validate entire bootstrap-static shape; maximum noise | |
| Passthrough with required fields | z.passthrough() — required fields strict, unknown allowed | |

**User's choice:** Used-fields only (recommended)
**Notes:** Resilience to FPL API additions preferred over exhaustive schema.

---

## Zod Validation Failure Behaviour (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Throw and serve stale cache | Loud error, previous cache served with stale indicator | ✓ |
| Throw and serve nothing | Loud error, app shows error state until fixed | |

**User's choice:** Throw and serve stale cache (recommended)
**Notes:** App should remain usable (on yesterday's data) even when pipeline fails.

---

## Claude's Discretion

- **Local dev data strategy** — not discussed; Claude to decide approach (recommended: local file cache in dev, Vercel Blob in prod, toggled by env var)
- **FPL proxy design** — not discussed; Claude to decide (recommended: single catch-all `/api/fpl/[...proxy]` route)

## Deferred Ideas

None.
