# Phase 122: Polish Carry-Forwards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 122-polish-carry-forwards
**Areas discussed:** ChipToggle wiring, Transfer card badge placement

---

## Pre-discussion Finding

Codebase scan revealed 3 of 6 requirements already implemented before Phase 122 execution began:
- POL-03 (`SquadView.tsx:224`) — already done
- POL-05 (`columns.tsx:271–276`) — already done
- POL-06 (`PlayerComparisonModal.tsx:172`) — already done

Effective work scope reduced to POL-01, POL-02 (one-liner), and POL-04 (partial).

---

## ChipToggle Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 chips (WC/FH/BB/TC) | Engine already accepts all four via buildTransferRouteTree. Same scope as ManualPlanTab. | ✓ |
| BB + TC only | Restrict to chips that only affect scoring, not transfer logic (simpler semantics). | |

**User's choice:** All 4 chips (Recommended)
**Notes:** Toggle-deselect behavior applies (click active chip → null). Wire useState, remove disabled prop.

---

## Transfer Card Badge Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Buy player only | After StatusLabelBadge in the buy cluster. Tells you the risk of who you're bringing in. | ✓ |
| Both sell and buy | Also adds badge next to sell player name. Sell reasons already cover this signal. | |

**User's choice:** Buy player only (Recommended)
**Notes:** Append after StatusLabelBadge at OpportunityCostTable.tsx:142 in the buy cluster.

---

## Claude's Discretion

- Exact ordering of MinsRiskBadge within the buy cluster (before or after StatusLabelBadge) — follow existing signal ordering convention

## Deferred Ideas

None — discussion stayed within phase scope.
