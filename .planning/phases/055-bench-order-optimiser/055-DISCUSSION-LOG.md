# Phase 55: Bench Order Optimiser - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 55-bench-order-optimiser
**Areas discussed:** Integration path, EV formula base, BGW detection method, BB chip message placement

---

## Integration Path

| Option | Description | Selected |
|--------|-------------|----------|
| Replace inside optimiseLineup() | benchOrder() called internally; OptimisedLineup.bench already correctly ordered; no OptimiserPanel changes | ✓ |
| Separate export called from OptimiserPanel | UI controls when/whether to apply ordering | |
| Both — internal call + export | Exported AND called internally for dual use | |

**User's choice:** Replace inside optimiseLineup() (Recommended)
**Notes:** Signature agreed: `benchOrder(benchOutfield: MergedPlayer[], starters: MergedPlayer[], horizon: OptimiserHorizon): MergedPlayer[]`

---

## EV Formula Base

| Option | Description | Selected |
|--------|-------------|----------|
| start_prob × xPts_1gw directly | Intentional double-weight: rotation risks ranked lower even with same xPts | ✓ |
| Normalize first | Compute per-appearance xPts; start_prob cancels out — effectively just xPts ranking | |

**User's choice:** start_prob × xPts_1gw directly (Recommended)

### Formation-legality follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Heuristic: position-flex check | Position-count bounds check (same logic as optimiseLineup); formation-invalid candidates demoted, not excluded | ✓ |
| Full simulation: check each candidate vs each starter | Check every substitution scenario | |

**User's choice:** Heuristic (Recommended)

---

## BGW Detection Method

| Option | Description | Selected |
|--------|-------------|----------|
| fixtures.length === 0 | Precise: no fixture this GW; injured players with fixtures still rank normally | ✓ |
| xPts_1gw === 0 | Existing convention; conflates BGW with injured/unavailable | |

**User's choice:** fixtures.length === 0 (Recommended)

### DGW double-weighting follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Multiply EV by fixtures.length | score = start_prob × xPts_horizon × fixtures.length; DGW=×2 automatically | ✓ |
| Use xPts_3gw as proxy for DGW | Less explicit; xPts_3gw covers future GWs beyond current DGW | |

**User's choice:** Multiply EV by fixtures.length (Recommended)

---

## BB Chip Message Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline note in bench section header | Muted italic line above bench rows; contextual, non-intrusive | ✓ |
| Reuse existing BB info banner | Append to "All 15 players score points" message | |
| New inline chip-info row | Styled row below BB toggle; more prominent | |

**User's choice:** Inline note in bench section header (Recommended)

### BB function interface follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Message logic in OptimiserPanel only | benchOrder() is pure; OptimiserPanel checks chipMode === 'bench-boost' | ✓ |
| benchOrder() returns null/sentinel when BB | Pass isBenchBoost to benchOrder(); more complex interface | |

**User's choice:** Message logic in OptimiserPanel only (Recommended)

---

## Claude's Discretion

- Exact wording of BB inline note (per ROADMAP: "Bench order doesn't affect score with Bench Boost active")
- Visual style of BB inline note (suggested: `text-xs text-zinc-400 dark:text-zinc-500 italic`)
- Whether formation-invalid candidates get a visual indicator (default: no indicator)
- Internal implementation of position-flex check (mirror existing `optimiseLineup()` count bounds)

## Deferred Ideas

None — discussion stayed within phase scope.
