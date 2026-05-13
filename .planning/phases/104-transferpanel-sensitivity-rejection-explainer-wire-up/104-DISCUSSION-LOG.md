# Phase 104: TransferPanel Sensitivity & Rejection Explainer Wire-Up - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 104-transferpanel-sensitivity-rejection-explainer-wire-up
**Areas discussed:** SENS-01 visual gap, WHY-01 expand UX, WHY-01 sell scope, computeRejection call site

---

## SENS-01 Visual Gap

| Option | Description | Selected |
|--------|-------------|----------|
| OCS text badge already satisfies SENS-01 | Phase 93 delivery (FragilityBadge text variant in OCS) is sufficient; no visual change needed. Phase 104 focuses on WHY-01 only. | ✓ |
| Update OCS badge to compact dot/pill | Replace text badge with compact visual (amber dot for fragile, amber pill for knife_edge) to match REQUIREMENTS literal spec. | |
| Add fragility in a new location | Keep OCS text badge AND add compact indicator in a separate part of TransferPanel. | |

**User's choice:** OCS text badge already satisfies SENS-01 (Recommended)
**Notes:** REQUIREMENTS said "dot/pill" but the existing FragilityBadge text (Phase 93) is the accepted implementation. Phase 104 scope = WHY-01 only.

---

## WHY-01 Expand UX — Trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible inline | Top rejection reasons shown directly below sell player name in each OCS row; no click or expand needed. | ✓ |
| Click-to-expand accordion | Sell player name becomes clickable; clicking reveals collapsible panel with reasons. | |
| Why? button | Small "Why?" button next to sell player name that reveals reasons on press. | |

**User's choice:** Always-visible inline (Recommended)
**Notes:** Reasons are supplementary context, not a primary action. Always-visible keeps the table scannable without interaction overhead.

---

## WHY-01 Expand UX — Visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Match buy-side fragility style | text-xs text-zinc-500 dark:text-zinc-400 — muted, small, consistent with buy-side fragility text. | ✓ |
| Amber tone to match fragility | text-amber-600 to pair visually with buy-side FragilityBadge. | |
| You decide | Builder picks a style that fits the OCS row. | |

**User's choice:** Match buy-side fragility style (Recommended)
**Notes:** Zinc/muted keeps sell reasons visually distinct from amber buy-side fragility; both use small text weight.

---

## WHY-01 Expand UX — Reason count

| Option | Description | Selected |
|--------|-------------|----------|
| Top-2 (first 2 in fixed order) | Matches REQUIREMENTS spec; keeps OCS compact. | |
| Top-3 | Slightly more context at a bit more height. | |
| All reasons up to 4 | Show all computeRejection reasons, capped at 4; more diagnostic context. | ✓ |

**User's choice:** All reasons up to 4
**Notes:** User explicitly widened from REQUIREMENTS' "top-2" to "all up to 4" for more diagnostic value.

---

## WHY-01 Expand UX — Empty reasons

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing | Render nothing when computeRejection returns empty reasons (strong player). | ✓ |
| Positive framing text | Show "No rejection signals — ranked #N at POS" using xPtsRank output. | |
| You decide | Builder picks. | |

**User's choice:** Nothing (Recommended)
**Notes:** xPts gain column already communicates the rationale when a strong player is being sold for an even better one.

---

## WHY-01 Sell Scope — Which players

| Option | Description | Selected |
|--------|-------------|----------|
| OCS suggested sells only | Only t.sell players in OCS rows — preserves ROADMAP SC-3 recommendation-set-only guard. | ✓ |
| All squad members below threshold | Broader diagnostic; risks verbosity in GW30+ squads. | |
| OCS sells + sell/sell_soon lifecycle members | Hybrid covering actively suggested sells plus lifecycle-flagged squad members. | |

**User's choice:** OCS suggested sells only (Recommended)
**Notes:** Recommendation-set-only rendering is non-negotiable per ROADMAP SC-3.

---

## WHY-01 Sell Scope — Multi-leg combos

| Option | Description | Selected |
|--------|-------------|----------|
| Each sell leg independently | Each sell player in a combo row renders reasons separately, symmetric with per-leg FragilityBadge. | ✓ |
| Only first/primary sell leg | Simpler; risks missing signals on the weaker sell player. | |
| You decide | Builder determines from OCS row structure. | |

**User's choice:** Yes, each sell leg independently (Recommended)
**Notes:** Symmetric with existing per-buy-leg FragilityBadge pattern in PlayerMoveCell.

---

## computeRejection Call Site — Location

| Option | Description | Selected |
|--------|-------------|----------|
| Inside OpportunityCostTable | Co-located with existing computeFragility call in PlayerMoveCell; two new props (allPlayers, lifecycleLabels) threaded from TransferPanel. | ✓ |
| Pre-computed in TransferPanel | TransferPanel calls computeRejection for each sell player, passes results down; keeps OCS pure but adds useMemo complexity. | |
| You decide | Builder picks cleanest call site. | |

**User's choice:** Inside OpportunityCostTable (Recommended)
**Notes:** Co-location with computeFragility keeps all per-transfer signal logic in one place.

---

## computeRejection Call Site — Empty lifecycleLabels guard

| Option | Description | Selected |
|--------|-------------|----------|
| No guard needed | computeRejection degrades gracefully with empty Map; OCS rows only render when squadData exists anyway. | ✓ |
| Skip sell reasons if lifecycleLabels empty | Explicit check: if lifecycleLabels.size === 0, skip rendering. | |
| You decide | Builder handles the edge case. | |

**User's choice:** No guard needed (Recommended)
**Notes:** computeRejection's lifecycle step simply produces no reasons when the map is empty — graceful degradation built in.

---

## Claude's Discretion

- Exact JSX structure within PlayerMoveCell for the sell-side reason list (e.g., `<ul>` vs stacked `<div>`s, gap spacing)
- Whether to use `data-testid="sell-rejection-reasons"` or a more specific testid
- Whether to import `computeRejection` directly in OpportunityCostTable or re-export from a barrel

## Deferred Ideas

None — discussion stayed within phase scope.
