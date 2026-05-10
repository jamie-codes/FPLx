# Phase 93: Sensitivity Analysis Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 93-sensitivity-analysis-enhancements
**Areas discussed:** Reversal thresholds, Fixture tier scope, Badge placement

---

## Reversal Thresholds

### mins_60_prob threshold

| Option | Description | Selected |
|--------|-------------|----------|
| < 0.60 | Symmetric with start_prob: 60-min probability below 60% after perturbation; undefined field skips | ✓ |
| < 0.50 | Majority-probability boundary; more conservative, fewer KNIFE EDGE flags | |
| You decide | Leave to builder based on start_prob consistency | |

**User's choice:** `< 0.60`
**Notes:** If `mins_60_prob` is undefined (Phase 52 MIN-01 optional field), skip this perturbation — no reversal counted.

### Cost perturbation reversal logic

| Option | Description | Selected |
|--------|-------------|----------|
| Tighter hit threshold | Transfer-only; check xPtsGain < 5.0 (4.0 + 1.0); captain path skips | ✓ |
| Value-per-£m drop | Check if xPts_1gw / (now_cost + 5) drops below a threshold; works for both paths | |
| Transfer-only, same 4.0 threshold | Higher-level "expensive player" flag rather than hit cost re-check | |

**User's choice:** Tighter hit threshold — `xPtsGain < 5.0`
**Notes:** The 0.5m premium is worth ~1 expected pt at typical FPL value ratios. Uses the same `isTransfer` guard as Phase 64 D-09.

---

## Fixture Tier Scope

### Which tiers trigger reversal on +1 perturbation

| Option | Description | Selected |
|--------|-------------|----------|
| easy→medium AND medium→hard | Both transitions trigger; 'hard' skipped (no tier above) | ✓ |
| easy→medium only | Only triggers when crossing the medium threshold; medium→hard considered redundant | |
| You decide | Leave tier boundary to builder | |

**User's choice:** Both easy→medium and medium→hard trigger. 'hard' skipped (can't increment). BGW guard already handles empty fixtures.

### Reason string for fixture perturbation

| Option | Description | Selected |
|--------|-------------|----------|
| 'harder fixture' for both | Consistent Phase 64 vocabulary regardless of starting tier | ✓ |
| Differentiate copy | Show 'medium fixture worsens to hard' when starting from medium | |

**User's choice:** `'harder fixture'` for both transitions.

---

## Badge Placement

### GemTable row-expand panel

| Option | Description | Selected |
|--------|-------------|----------|
| After news section | Rejection → news → fragility; forward-looking "what if" after "why not now" context | ✓ |
| Before rejection panel | Fragility first; may feel out of place for players not in the candidate list | |
| Between rejection and news | Groups warning signals; splits rejection from news | |

**User's choice:** After `RowExpandNewsSection`.

### OCS PlayerMoveCell

| Option | Description | Selected |
|--------|-------------|----------|
| New line below flex row | Below 'Sell X → Buy Y + badges' flex row; matches Phase 64 D-02 spirit | ✓ |
| Inline after NewsBanner | Appended to flex row; risks wrapping on narrow screens | |

**User's choice:** New line below the flex row.

---

## Claude's Discretion

- Exact Tailwind class for KNIFE EDGE stronger amber/red tone
- Whether `FragilityBadge` is a thin wrapper around `FragilityNote` or a separate component
- Whether `data-testid` uses `fragility-badge` or reuses `fragility-note`
- Whether news doubt reversal uses `computeNewsSeverity(50, ...)` or direct `chance > 50` comparison

## Deferred Ideas

None — discussion stayed within phase scope.
