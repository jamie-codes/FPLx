# Phase 125: Summer Window Tracker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 125-summer-window-tracker
**Areas discussed:** Article card design, Filter pill behavior, Signing badge in GemTable, Signing badge in TransferPanel

---

## Article Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Title + source + date | Compact — headline, Sky/BBC badge, relative date | ✓ |
| Title + summary + source + date | Full card with summary text visible | |
| Title + summary expandable | Compact default, tap to expand summary | |

**External links:** Yes — titles link out to original article in new tab. ✓

**Stale feed handling:**

| Option | Selected |
|--------|----------|
| Show stale banner, display articles anyway | ✓ |
| Show articles silently | |
| Show empty state when stale | |

---

## Filter Pills

| Option | Selected |
|--------|----------|
| All / Confirmed / Rumour / Injury / Rotation | ✓ |
| Confirmed / Rumour / Injury / Rotation / General | |
| All / Confirmed / Rumour / Injury / Rotation / General | |

**Pill behaviour:** Single-select (radio style) ✓
**Default pill:** All ✓

*Note: `general` classification has no dedicated pill — visible under "All" only.*

---

## Signing Badge in GemTable

| Option | Selected |
|--------|----------|
| Expanded row only (like FragilityBadge) | ✓ |
| Inline in row (like DifferentialBadge) | |
| Both — small icon inline, full badge expanded | |

**Badge label:** "Confirmed Signing" ✓

---

## Signing Badge in TransferPanel

| Option | Selected |
|--------|----------|
| OpportunityCostTable buy-cell only | ✓ |
| SquadView rows only | |
| Both surfaces | |

**Tooltip on hover:** Yes — native title attribute with article headline + source ✓

---

## Claude's Discretion Items

- Badge visual styling (green background consistent with positive-signal badges) — open to planner's judgment
- Empty-state copy when no articles match filter
- Exact stale threshold enforced (24h confirmed by user)
