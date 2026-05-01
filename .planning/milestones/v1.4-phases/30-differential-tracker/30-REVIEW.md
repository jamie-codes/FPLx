---
phase: 30-differential-tracker
reviewed: 2026-04-28T12:27:05Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - pipeline/merge.py
  - src/lib/types.ts
  - tests/lib/differential-flag.test.ts
  - src/components/gem-table/DifferentialBadge.tsx
  - src/components/gem-table/columns.tsx
  - src/components/gem-table/GwToggle.tsx
  - src/components/gem-table/GemTable.tsx
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-04-28T12:27:05Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 30 adds the differential-flag pipeline step (`_compute_differential_flag` in `merge.py`), a `DifferentialBadge` component, and a new sortable "Diff" column in `GemTable`. The core classification logic is sound and the badge component is correctly implemented. Three issues were found: one pre-existing column-ID mismatch that Phase 30 inherited and perpetuated (causing the Signal column's mobile-expand row and the new Diff column's mobile-expand row to be silently invisible), one BGW false-TRAP classification bug introduced in Phase 30, and one at-median boundary asymmetry that may be unintentional.

---

## Warnings

### WR-01: Column ID mismatch — `regression_signal` vs `signal` breaks mobile expand row for Signal and Diff columns

**File:** `src/components/gem-table/GwToggle.tsx:19`, `src/components/gem-table/GemTable.tsx:40`

**Issue:** The regression-signal column is defined via `col.accessor('regression_signal', ...)` in `columns.tsx` (line 161). TanStack Table derives the column `id` from the accessor key, so the column ID is `'regression_signal'`. However, both visibility maps use the key `'signal'`:

- `GwToggle.tsx` `MOBILE_HIDDEN_COLUMNS` map (line 19): `signal: false`
- `GemTable.tsx` `HIDDEN_COLUMN_LABELS` map (line 40): `signal: 'Signal'`

Because these maps are keyed by column ID, the lookup `HIDDEN_COLUMN_LABELS[cell.column.id]` in `GemTable.tsx` line 184 will never match `'regression_signal'` against `'signal'`. The result is:

1. The Signal column is **never included in the mobile expand row** — users tapping a row on mobile cannot see the regression signal.
2. Phase 30 followed the same broken pattern (`differential_flag: false` in `MOBILE_HIDDEN_COLUMNS` was correctly added), but the Signal column's entry being wrong means the pattern being "followed" was already incorrect.

The `differential_flag` key itself is correct because the `col.accessor('differential_flag', ...)` accessor produces column ID `'differential_flag'`, which matches the map entry. Only the Signal column (and its mobile-label entry) are wrong.

**Fix:** Rename the `'signal'` key to `'regression_signal'` in both maps:

```tsx
// GwToggle.tsx — MOBILE_HIDDEN_COLUMNS
regression_signal: false,   // was: signal: false
differential_flag: false,
```

```tsx
// GemTable.tsx — HIDDEN_COLUMN_LABELS
regression_signal: 'Signal',   // was: signal: 'Signal'
differential_flag: 'Diff',
```

---

### WR-02: BGW false-TRAP classification — no-fixture players incorrectly flagged

**File:** `pipeline/merge.py:807-822`

**Issue:** Players with no upcoming fixture in the current gameweek (blank gameweek / BGW) have `xPts_1gw = 0.0` (returned by `_xpts_ngw` when `fixtures` is empty). These zeroes are included in the position-group median calculation at lines 807-813. In a BGW affecting many players, the median for that position can be pulled close to or equal to 0.0.

For a player with no fixture (`xPts_1gw = 0.0`) and ownership > 15%:

```python
above_median = 0.0 > position_median  # False when median >= 0 (always)
not above_median                        # True
ownership > 15.0                        # True for a template player
# => TRAP fires
```

This produces a TRAP flag for a player who simply has no fixture this week — not because their projections are genuinely weak relative to peers who do have fixtures. Template players with a BGW will be incorrectly labelled as sell candidates every week they blank, even if they are otherwise excellent holds.

**Fix:** Add a no-fixture guard in `_compute_differential_flag`, or exclude zero-xPts BGW players from the position median and TRAP gate:

```python
def _compute_differential_flag(
    xpts_1gw: float,
    selected_by_percent: str,
    status: str,
    position_median: float,
    has_fixture: bool = True,   # NEW
) -> str | None:
    # BGW players have no fixture — neither DIFF nor TRAP applies.
    if not has_fixture:
        return None
    ...
```

Then pass `has_fixture = bool(player_fixtures)` when calling `_compute_differential_flag` in `merge_players`. Alternatively, only include players with at least one upcoming fixture when computing the position median.

---

### WR-03: At-median players asymmetrically eligible for TRAP but not DIFF

**File:** `pipeline/merge.py:406-411`

**Issue:** The DIFF gate uses strict greater-than (`xpts_1gw > position_median`), and the TRAP gate uses `not above_median` which evaluates to `True` when `xpts_1gw <= position_median` (i.e., at or below the median). A player exactly at the median (`xpts_1gw == position_median`) is therefore:

- Ineligible for DIFF (correct — not above average)
- Eligible for TRAP if ownership > 15% (potentially surprising — median-average performance is not "weak projections")

The TRAP tooltip says "below-average xPts for position" but a player at exactly the median is average, not below average. When large cohorts of players share identical `xPts_1gw` values (e.g., multiple players with BGW = 0.0 after the BGW fix, or rounded identical values), several template players could receive a TRAP flag despite being at exactly the median.

The docstring at line 395 states `xpts_1gw < position_median` (strict less-than) for TRAP, but the implementation uses `not above_median` which is `<=`. There is a contradiction between the docstring and the code.

**Fix:** Make the TRAP gate use strict less-than to match the docstring contract:

```python
at_or_below_median = xpts_1gw <= position_median
below_median = xpts_1gw < position_median   # strict, matches docstring

if above_median and ownership < 5.0 and status == 'a':
    return 'diff'
if below_median and ownership > 15.0:    # changed from `not above_median`
    return 'trap'
return None
```

---

## Info

### IN-01: All integration tests are skipped — no automated coverage for pipeline classification correctness

**File:** `tests/lib/differential-flag.test.ts:13-64`

**Issue:** Five of the six tests in the pipeline-output describe block are marked `it.skip(...)` because they require a pipeline run. The only active test (`Wave 0 stub file created`) is a trivially passing assertion (`expect(true).toBe(true)`). Component-level tests for `DifferentialBadge` are active and correctly cover the badge's rendering behaviour, but the gate logic in `_compute_differential_flag` has zero test coverage in the test suite.

The BGW false-TRAP bug (WR-02) and at-median boundary issue (WR-03) would both have been caught by a simple unit test of `_compute_differential_flag` with a `has_fixture=False` case and an exact-median-value case.

**Fix:** Add a Python unit test file (`tests/pipeline/test_differential_flag.py`) that directly exercises `_compute_differential_flag` with boundary inputs:
- ownership = 4.9 / 5.0 / 5.1 at various xPts vs median positions
- ownership = 14.9 / 15.0 / 15.1 at various xPts vs median positions
- xpts exactly at median — verify no DIFF and no TRAP
- status != 'a' — verify DIFF blocked, TRAP still fires
- BGW/no-fixture case (once WR-02 is fixed)

---

_Reviewed: 2026-04-28T12:27:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
