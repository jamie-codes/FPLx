# Phase 40: Accuracy Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 40-accuracy-pipeline
**Areas discussed:** Historical prediction source, proj_pts inclusion, Output file scope

---

## Historical Prediction Source

| Option | Description | Selected |
|--------|-------------|----------|
| Reconstruct from history | Re-run xPts formula against element-summary history[] xG/xA/minutes + FPL fixture difficulty | ✓ |
| Snapshot going forward | Save predictions at each pipeline run, accumulate over 5 GWs | ✓ |

**User's choice:** Both — reconstruct for immediate data, also start snapshotting going forward.
**Notes:** User explicitly wanted both approaches. Reconstruction gives Phase 41 data today; snapshotting builds a proper historical record that improves accuracy over time.

### Fixture Difficulty for Reconstruction

| Option | Description | Selected |
|--------|-------------|----------|
| FPL standard difficulty | Use difficulty field from fpl_fixtures.json for historical GW | ✓ |
| Neutral difficulty (0.5) | Assume no adjustment, simpler code | |

**User's choice:** FPL standard difficulty.

---

## proj_pts Inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Skip proj_pts in Phase 40 | Backtest xPts only | |
| Use current proj_pts as proxy | Record current proj_pts_1gw as stand-in (acknowledged wrong) | |
| Compute from GW-by-GW form | Reconstruct rolling form by slicing history[] at each GW boundary | ✓ |

**User's choice:** Compute from GW-by-GW form.
**Notes:** User wants both models compared properly. Phase 40 will reconstruct historical proj_pts using rolling PPG from the 5 history entries before each GW.

### Rolling Form Window

| Option | Description | Selected |
|--------|-------------|----------|
| 5 GWs (Recommended) | Matches FPL's form convention and form_pts_per90 in merge.py | ✓ |
| 3 GWs | More reactive, more noise | |

**User's choice:** 5 GWs.

---

## Output File Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-aggregated (Recommended) | Pipeline writes per-GW summary + per-player detail; Phase 41 is pure UI | ✓ |
| Raw only | Write raw rows; Phase 41 computes hit rates in TypeScript | |

**User's choice:** Pre-aggregated.

### Haulter Ranking Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Top 10 predicted (Recommended) | Haulter "flagged" if in top 10 predicted players before that GW | ✓ |
| Top 5 predicted | Stricter, lower hit rates | |
| Above-median | Too broad | |

**User's choice:** Top 10 predicted that GW.

---

## Claude's Discretion

- Whether backtest computation lives in `merge.py` or a separate `accuracy.py` module
- Minimum minutes threshold for player inclusion in backtest
- Delta sign convention (decided: `actual - predicted`, positive = surprised haul)
- DGW handling (sum xG/xA/points across both fixtures in that GW)

## Deferred Ideas

None — discussion stayed within phase scope.
