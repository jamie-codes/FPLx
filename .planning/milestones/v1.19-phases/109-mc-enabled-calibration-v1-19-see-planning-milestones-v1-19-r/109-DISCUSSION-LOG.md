# Phase 109: MC-Enabled Calibration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 109-MC-Enabled Calibration
**Areas discussed:** haul_prob data flow, Bucketing approach, CalibrationHealthIndicator label

---

## haul_prob Data Flow

### How haul_prob reaches _compute_calibration_data

| Option | Description | Selected |
|--------|-------------|----------|
| New merged param | Add merged_haul_lookup: dict[int, float] to compute_accuracy_backtest. run.py builds from current merged list. Clean, no new storage. | ✓ |
| New param + extend snapshot | Same as above, PLUS extend predictions_snapshot.json to save haul_prob per player for future historical accuracy. | |

**User's choice:** New merged param (no snapshot extension)

---

### Per-player fallback for missing haul_prob

| Option | Description | Selected |
|--------|-------------|----------|
| Use bucket_mid | Fall back to decile bucket midpoint (0.05–0.95) for departed/missing players. Consistent with Phase 109 'analytical proxy per-player' rule. | ✓ |
| Exclude entirely | Skip the player from calibration. Cleaner mean per bucket but thins historical deciles. | |

**User's choice:** Use bucket_mid (effective_haul_prob = 0.0 in sort, absorbed into bottom decile)

---

### 80% threshold population

| Option | Description | Selected |
|--------|-------------|----------|
| Players in merged_haul_lookup | Count fraction of current merged list with haul_prob != None. Simple. Already implied by MC_ENABLED=True. | ✓ |
| Players in per_gw_rows | Count fraction of historical backtest rows resolving a haul_prob. More precise but iterates full row set. | |

**User's choice:** Players in merged_haul_lookup

---

### calibration_mode placement

| Option | Description | Selected |
|--------|-------------|----------|
| In summary, computed in backtest fn | Written to accuracy_backtest.json.summary alongside mc_enabled. Component reads data.summary.calibration_mode. Matches ROADMAP spec. | ✓ |
| Inside calibration dict | Nested in calibration object alongside by_position. Keeps calibration concerns co-located. | |

**User's choice:** In summary, computed in compute_accuracy_backtest

---

## Bucketing Approach

### How players are bucketed in MC mode

| Option | Description | Selected |
|--------|-------------|----------|
| Re-sort by haul_prob | Sort by haul_prob descending → 10 deciles → predicted_rate = mean(haul_prob) per bucket. Proper reliability diagram. | ✓ |
| Keep xPts rank, swap bucket_mid | Keep existing xPts-rank sort, replace predicted_rate = bucket_mid with mean(haul_prob) per bucket. Less disruptive. | |

**User's choice:** Re-sort by haul_prob (proper reliability diagram)

---

### Sort key for players missing haul_prob

| Option | Description | Selected |
|--------|-------------|----------|
| Sort as 0.0 | effective_haul_prob = 0.0, placed at bottom decile. Simple, no special-casing. | ✓ |
| Exclude entirely | Skip from MC calibration computation. Cleaner but complex. | |

**User's choice:** Sort as 0.0

---

### How _compute_calibration_data distinguishes MC vs analytical

| Option | Description | Selected |
|--------|-------------|----------|
| mc_enabled flag param | Pass use_mc: bool (pre-computed in outer function from mc_enabled + 80% check). Explicit, testable. | ✓ |
| Auto-detect from lookup coverage | No flag param — function checks coverage internally. DRY but hides threshold logic inside transform. | |

**User's choice:** Explicit use_mc flag param

---

## CalibrationHealthIndicator Label

### Mode label placement

| Option | Description | Selected |
|--------|-------------|----------|
| Second badge alongside tier | Add [MC] or [Analytical] badge after tier badge. Existing sentence unchanged. | ✓ |
| Append to sentence | Keep one badge, extend sentence with "(MC-grounded)" suffix. Simpler but label buried. | |

**User's choice:** Second badge alongside tier

---

### Badge text

| Option | Description | Selected |
|--------|-------------|----------|
| MC / Analytical | Short, clear, matches conceptual distinction. | ✓ |
| MC / Est. | "Est." more compact but ambiguous to new users. | |

**User's choice:** MC / Analytical

---

### Mode badge colour scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Teal for MC, zinc for Analytical | Matches existing MC visual language (MCDistributionBar teal fills). | ✓ |
| Blue for MC, zinc for Analytical | More distinct from other teal uses but breaks teal = MC association. | |

**User's choice:** Teal for MC, zinc for Analytical

---

## Claude's Discretion

- Whether to name the parameter `merged_haul_lookup` or `haul_prob_lookup` (both clear; choose whichever reads better in context)
- Whether `predicted_mean`/`actual_mean` accumulators (Phase 91 CAL-01) are retained in MC mode — `predicted_mean` semantics shift from mean(xPts) to still mean(xPts); planner decides whether to zero out or preserve

## Deferred Ideas

None — discussion stayed within phase scope.
