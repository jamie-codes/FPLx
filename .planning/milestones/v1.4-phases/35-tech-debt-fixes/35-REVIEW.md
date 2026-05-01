---
phase: 35-tech-debt-fixes
reviewed: 2026-04-29T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pipeline/merge.py
  - pipeline/insights.py
  - pipeline/upload.py
  - src/components/gem-table/GwToggle.tsx
  - src/components/insights/InsightsTab.test.tsx
  - src/components/planner/ChipStrategyPanel.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-04-29T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 35 was a tech-debt fix sprint targeting six defects across the Python pipeline and TypeScript frontend. The fixes for `pipeline/insights.py` (sample_n > 0 guards), `pipeline/upload.py` (type annotation), and `src/components/insights/InsightsTab.test.tsx` (Insight[] cast) are correct and complete.

The `pipeline/merge.py` BGW exclusion from median calculation (WR-03) is only half-fixed: while BGW players are now correctly excluded from the position median, they are still eligible to receive a TRAP flag in the second loop that calls `_compute_differential_flag`. The fix addressed the symptom (skewed median) but not the consequence (BGW players misclassified as TRAP). This is a logic error that produces incorrect output in any week where some teams have a blank gameweek.

The `src/components/planner/ChipStrategyPanel.tsx` comment added for WR-07 is factually incorrect: the guard `bestGw > 0` can never evaluate to false because `computeFHResult` always returns a GW number >= 1. This makes the guard dead code with a misleading explanation.

The `GwToggle.tsx` rename (WR-01) correctly aligns the key with the TanStack column accessor, but the corresponding test in `GwToggle.test.ts` does not cover `regression_signal`, meaning this fix has no test regression protection.

---

## Warnings

### WR-01: BGW players still receive TRAP flag after median-exclusion fix

**File:** `pipeline/merge.py:898-906`

**Issue:** The WR-03 fix correctly excludes BGW players (`xPts_1gw = 0` or `None`) from the position median calculation at lines 890-893. However, the subsequent flag-assignment loop at lines 898-906 still passes every player — including BGW players — into `_compute_differential_flag`. A BGW player has `xPts_1gw = 0.0` (via the `or 0.0` coercion at line 900). With a non-zero median (which now only reflects active players, making the gap larger), `0.0 < position_median` is always true. Any widely-held BGW player (ownership > 15%) will be incorrectly flagged as `'trap'` and written to `merged_players.json`. This is the very scenario the fix claimed to address.

Concretely: if Man City have a BGW and Erling Haaland (widely held, ownership ~65%) has `xPts_1gw = 0.0`, Haaland will be emitted as `differential_flag: 'trap'` — a sell signal — purely because he has no fixture this week.

**Fix:** Skip BGW players in the flag loop, mirroring the same condition used for median exclusion:

```python
for p in result:
    xpts_val = p.get('xPts_1gw') or 0.0
    if xpts_val == 0.0:
        # BGW player — no fixture this week; do not classify as diff or trap
        continue
    flag = _compute_differential_flag(
        xpts_val,
        p.get('selected_by_percent', '0'),
        p.get('status', ''),
        pos_median[p['element_type']],
    )
    if flag is not None:
        p['differential_flag'] = flag
```

---

### WR-02: `bestGw > 0` guard is a dead condition with an incorrect comment

**File:** `src/components/planner/ChipStrategyPanel.tsx:304-307`

**Issue:** The comment added in this phase reads: `/* bestGw > 0: FPL GW numbers are always >= 1; 0 only if engine received no fixture data */`. The claim that `bestGw` can be `0` is false. In `computeFHResult` (`src/lib/chip-strategy-engine.ts:280-296`), the zero-data early-return path sets `bestGw = resolvedStartGw`, which is always `>= 1` (derived from `Math.min(...allGws)` with a fallback of `1`). The non-zero-data path sets `bestGw = bestGwResult.gw` from `horizonGws`, which are also real GW numbers `>= 1`. The guard `fhResult.bestGw > 0 ? fhResult.bestGw : null` can therefore never evaluate the false branch, making it dead code. The comment will mislead future maintainers about the engine's contract.

**Fix:** Either remove the dead guard and pass `bestGw` directly, or — if the guard is intended as a defensive check against future engine changes — document the correct invariant:

```tsx
{/* bestGw: FHResult.bestGw is always >= 1; null passed here only to suppress
    the 'Best: GW{n}' label when all ease scores are zero (all-BGW scenario).
    Use scores.every(s => s.isBGW) for a semantically correct check. */}
<FHChipRow
  scores={fhResult.scores}
  bestGw={fhResult.scores.every(s => s.isBGW) ? null : fhResult.bestGw}
  suggestedSquad={fhResult.suggestedSquad}
  usedAtGw={usedChips.get('freehit')}
/>
```

Alternatively, if the guard is kept as a cheap future-proofing sentinel, at minimum remove the false claim in the comment:

```tsx
{/* bestGw > 0: guard against a future engine change that could return 0 */}
```

---

### WR-03: `regression_signal` mobile-hidden column has no test coverage

**File:** `src/components/gem-table/GwToggle.tsx:19` / `src/components/gem-table/GwToggle.test.ts:43-62`

**Issue:** The WR-01 fix renamed the key in `MOBILE_HIDDEN_COLUMNS` from `signal` to `regression_signal`. The old `signal` key was a dead entry — it matched no TanStack column ID, meaning the regression signal column was always visible on mobile. The fix is correct, but `GwToggle.test.ts` (line 43) only asserts that 15 specific columns are hidden on mobile; neither `regression_signal` nor `differential_flag` is tested. The test count comment says "15 non-priority columns" but `MOBILE_HIDDEN_COLUMNS` now contains 17 keys. Without a regression test, a future rename or accidental removal will go undetected again.

**Fix:** Add assertions for both columns to the existing mobile test:

```typescript
it('hides non-priority columns when isMobile is true', () => {
  // ... existing assertions ...
  expect(result.regression_signal).toBe(false)
  expect(result.differential_flag).toBe(false)
})
```

Also update the comment to match the actual count (17 columns).

---

## Info

### IN-01: `save_local` and `save` lack type annotations after `upload_json` fix

**File:** `pipeline/upload.py:15,25`

**Issue:** The WR-06 fix correctly updated `upload_json`'s `data` parameter from `dict` to `list | dict`. However, `save_local` (line 15) and `save` (line 25) still use bare `data` with no annotation. All three functions are part of the same public API and accept the same payload types. The inconsistency means a type checker will flag callers of `upload_json` but silently accept incorrect types passed to `save` or `save_local`.

**Fix:**
```python
def save_local(pathname: str, data: list | dict, cache_dir: str = 'pipeline/cache') -> None:
    ...

def save(pathname: str, data: list | dict) -> None:
    ...
```

---

### IN-02: Stale Wave 0 stub test block not removed from InsightsTab.test.tsx

**File:** `src/components/insights/InsightsTab.test.tsx:204-208`

**Issue:** The `describe('Phase 33: InsightsTab — Wave 0 stub')` block at lines 204-208 contains a trivially passing test (`expect(true).toBe(true)`) with the comment "replace with real tests after implementation." The real tests were added in commit `f09a730` (Phase 33), but the stub was never removed. It adds noise to the test suite and may cause confusion about whether it still represents unfilled implementation work. This block was pre-existing but is included in the reviewed file and was not cleaned up during this phase.

**Fix:** Remove the stale describe block:
```typescript
// Delete lines 204-208:
describe('Phase 33: InsightsTab — Wave 0 stub', () => {
  it('Wave 0 stub file created — replace with real tests after implementation', () => {
    expect(true).toBe(true)
  })
})
```

---

_Reviewed: 2026-04-29T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
