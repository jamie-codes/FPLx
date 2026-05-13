---
phase: 102-mc-gate-activation-mcdistributionbar-display
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pipeline/run.py
  - pipeline/tests/test_simulate.py
  - .github/workflows/pipeline.yml
  - src/components/mc/MCDistributionBar.tsx
  - src/components/mc/MCDistributionBar.test.tsx
  - src/components/gem-table/columns.tsx
  - src/components/gem-table/columns.test.tsx
  - src/components/captaincy/CaptainPicksPanel.tsx
  - src/components/captaincy/CaptainPicksPanel.test.tsx
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 102: Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 102 ships three deliverables: (1) a permanent MC gate activation in `run.py`, (2) the `MCDistributionBar` component replacing the old text-row hover card format, and (3) inline P10/P90 range display in `CaptainPicksPanel`. The implementation is largely coherent, but two issues rise to blocker severity: the MC gate read from `accuracy_backtest.json` is dead code (the value is always overwritten before use), and the `MCDistributionBar` renders a solid full-width fill that does not visually encode the P10–P90 range. Three warnings cover a test that passes on false premises, an unguarded NaN path into `toFixed()`, and a simulation ordering issue with `rotation_risk`.

---

## Critical Issues

### CR-01: `mc_enabled` value read from `accuracy_backtest.json` is dead code — gate always ON

**File:** `pipeline/run.py:193-204`

**Issue:** Line 193 initialises `mc_enabled = False`. Line 194 introduces `MC_ENABLED = True`. Inside the `try` block that reads `accuracy_backtest.json`, lines 199–203 correctly read `form_signal_enabled`, `blend_alpha_used`, `xmins_v2_enabled`, `bonus_predictor_enabled`, and `save_predictor_enabled` from the backtest JSON. But line 204 unconditionally sets `mc_enabled = MC_ENABLED` (True), discarding any value that might have been read from `prev_backtest.get('summary', {}).get('mc_enabled', ...)`. The backtest JSON's `mc_enabled` field is never consulted. This means the MC simulation gate cannot be turned off via the backtest mechanism even if future logic requires it — it is permanently hardwired to `True`.

This also makes the `except (FileNotFoundError, json.JSONDecodeError): pass` branch correct for all flags _except_ `mc_enabled`; on a cold start `mc_enabled` ends up `True` instead of `False` (the default documented in line 193 and test `test_accuracy_mc_enabled_cold_start`).

**Fix:**
```python
# Replace line 204:
mc_enabled = MC_ENABLED  # <-- overwrites backtest value unconditionally

# With explicit read then override:
# Phase 102: MC permanently ON; read from backtest for logging parity only.
mc_enabled = MC_ENABLED  # permanent ON per Phase 102 D-05
# If reverting to gate-off semantics in future, read the backtest value:
#   mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)
```

If the intent is truly permanent ON, the backtest read loop should be cleaned up to remove the phantom `mc_enabled` read path (or the comment at line 193 should note the field is now vestigial). As written, the code implies the gate reads the backtest but does not.

---

### CR-02: `MCDistributionBar` fill always spans 100% of track — no P10/P90 range encoding

**File:** `src/components/mc/MCDistributionBar.tsx:27`

**Issue:** The inner fill `div` has `className="absolute inset-y-0 left-0 w-full rounded-full bg-teal-500 dark:bg-teal-400"`. `inset-y-0 left-0 w-full` means the fill is anchored at the left edge and spans 100% of the parent track width regardless of `p10Pts` and `p90Pts` values. Every player, from a 1-point floor to a 20-point ceiling, displays an identical fully-filled bar. The component is described as a "visual horizontal range bar" (file header comment, line 1) but conveys no information about the actual uncertainty range. The P10 and P90 values appear only as text labels flanking the track.

The visual design does not match the stated specification. For a bar to show the range from p10 to p90, the fill would need left offset and width computed from the ratio of the values to some scale (e.g. the maximum p90 across the cohort, or a fixed scale like 0–20 pts).

**Fix:** Either (a) implement a proportional fill using inline `style` (requires a scale parameter from the parent), or (b) document explicitly in the component that the bar is a static decoration and the range is conveyed by text only — and update the component header comment to remove "visual horizontal range bar" language that implies proportional encoding. Option (b) is the simpler fix for now if true proportional encoding is deferred.

```tsx
// Option (b) — document-only fix: update header comment at line 1 from:
// "visual horizontal range bar for the xPts hover card"
// to:
// "P10/P90 range label display for the xPts hover card"
// AND change the component body to remove misleading full-width fill:
<div
  className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-600 relative"
  role="img"
  aria-label={`MC range: ${p10Pts.toFixed(1)} to ${p90Pts.toFixed(1)} pts`}
>
  {/* Static accent strip — no proportional encoding; range is in text labels */}
  <div className="absolute inset-y-0 left-1/4 right-1/4 rounded-full bg-teal-500 dark:bg-teal-400" />
</div>
```

Option (a) proper proportional implementation would require a `scale` prop (e.g. `maxPts: number`) to compute `leftPct` and `widthPct` from `p10Pts / maxPts` and `(p90Pts - p10Pts) / maxPts`.

---

## Warnings

### WR-01: `test_mc_enabled_off_skip` passes on false premises — gate contract no longer tested

**File:** `pipeline/tests/test_simulate.py:222-264`

**Issue:** This test synthesises an `accuracy_backtest.json` with `mc_enabled: false`, reads the flag using the same logic as `run.py` lines 241–243, and asserts it evaluates to `False`. The test then inspects the `run.py` source text and verifies the constants `MC_ENABLED = True` and `mc_enabled = MC_ENABLED` exist (lines 259–264). The test passes, but it does not test what it claims: because `run.py` line 204 always sets `mc_enabled = MC_ENABLED` regardless of the backtest value, the "gate OFF" path is never exercised by the pipeline. The test validates that the source text contains the right constants, which is a text-search assertion with no behavioural value for the actual gate-off path.

If the gate is permanently ON by design (Phase 102 intent), this test should be updated to document that the backtest value is ignored. If the gate should remain controllable, then CR-01 must be fixed and this test should invoke `run()` with a mocked backtest and verify `compute_simulations` is not called.

**Fix:** Either update the test comment to reflect that the gate is now permanently ON, or add a real integration-level mock that verifies `compute_simulations` is bypassed when the gate is off.

---

### WR-02: `XPtsCell` does not guard for `NaN` MC props before passing to `MCDistributionBar`

**File:** `src/components/gem-table/columns.tsx:95-99`

**Issue:** `showMC` at line 95 checks that all four MC props (`blankProb`, `haulProb`, `p10Pts`, `p90Pts`) are not `undefined`. It does not check `Number.isFinite()`. If the pipeline writes `NaN` or `Infinity` for any MC field (e.g. due to a division-by-zero edge case in `simulate.py` or a JSON parse anomaly), these values will pass the `!== undefined` gate, reach `MCDistributionBar`, and `.toFixed(1)` will produce the string `"NaN"` or `"Infinity"` in the UI — visible to users.

`XPtsCell` already applies `Number.isFinite` to `value` at line 69. The same pattern should be applied to the MC props.

**Fix:**
```tsx
// Replace lines 95-99:
const showMC = window === 1
  && blankProb !== undefined && Number.isFinite(blankProb)
  && haulProb !== undefined && Number.isFinite(haulProb)
  && p10Pts !== undefined && Number.isFinite(p10Pts)
  && p90Pts !== undefined && Number.isFinite(p90Pts)
```

---

### WR-03: MC simulation runs before `_apply_rotation_risk` — rotation-affected `xmins` not reflected in MC fields

**File:** `pipeline/run.py:224-233`

**Issue:** `compute_simulations(merged, xmins_v2_enabled)` is called at line 225 using the pre-rotation-risk `merged` list. `_apply_rotation_risk` is called at line 231 and writes the `rotation_risk` flag to each player, but it may also be expected to affect downstream decisions about whether a player's `xmins` is reliable. Players with `rotation_risk=True` could have inflated `xmins` values that should reduce their MC point distributions, but those values are already baked into `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` before `rotation_risk` is computed.

The `rotation_risk` flag is only a boolean annotation (per `_apply_rotation_risk` in `gw_intel.py`) and does not modify `xmins`, so the practical impact may be minimal. However, the ordering creates an implicit dependency risk: any future change to `_apply_rotation_risk` that also modifies `xmins` or `start_prob` would silently produce stale MC values without triggering an obvious failure. The comments at lines 230–233 do not acknowledge this dependency.

**Fix:** Add an inline comment at the simulation call site acknowledging the ordering constraint:

```python
# MC simulation uses pre-rotation-risk xmins/start_prob (intentional: _apply_rotation_risk
# only sets the rotation_risk flag, does not modify xmins). If _apply_rotation_risk is ever
# changed to adjust xmins, this call must move to after line 232.
if mc_enabled:
    merged = compute_simulations(merged, xmins_v2_enabled)
```

---

## Info

### IN-01: Dead local variable `mc_enabled = False` at line 193 should be removed or renamed

**File:** `pipeline/run.py:193`

**Issue:** `mc_enabled = False` at line 193 is immediately shadowed by `MC_ENABLED = True` at line 194 and then overwritten unconditionally at line 204. The initialisation serves no purpose. If the intent is to document the historical default, a comment is clearer than a live assignment that will be read by future maintainers as load-bearing initialisation code.

**Fix:** Remove line 193 entirely, or replace with a comment:
```python
# Phase 90 MC-01: mc_enabled was historically OFF-by-default; permanently ON since Phase 102 (D-05).
MC_ENABLED = True
```

---

_Reviewed: 2026-05-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
