---
phase: 063-model-versioning-calibration-charts
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/accuracy.py
  - pipeline/tests/test_accuracy.py
  - src/lib/types.ts
  - src/components/accuracy/AccuracyTab.tsx
  - src/components/accuracy/AccuracyTab.test.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 063: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed covering the Phase 63 additions: model versioning (`VER-01/VER-02`) and
calibration charts (`CAL-01/CAL-02`) in `pipeline/accuracy.py`, their TypeScript type
definitions in `src/lib/types.ts`, and the React component `AccuracyTab.tsx` with its test
suite. The Python pipeline logic is sound for the happy path, but two correctness bugs were
found — one in the version dedup logic (silent duplicate appending when the matching version is
not the last entry) and one invisible-character defect in the rendered UI. Four warnings cover a
misleading section heading, repeated file I/O, a missing test, and an aria-sort gap. Two info
items flag minor style issues.

---

## Critical Issues

### CR-01: Version dedup checks only `versions[-1]`, allowing silent duplicates when the current version is not the tail

**File:** `pipeline/accuracy.py:345`

**Issue:** The dedup guard is:
```python
if not versions or versions[-1].get('formula_version') != FORMULA_VERSION:
    versions = versions + [new_version_record]
```
This only prevents appending when `FORMULA_VERSION` already occupies the **last** slot. If
`FORMULA_VERSION` is present anywhere else in the list (e.g. a developer rolls back the constant
to a previously used value, or another code path inserts a record out of order), the guard
passes and a duplicate is appended. The existing test `test_version_dedup` seeds a file whose
versions list already has the matching version as the tail, so it cannot catch this case.

The contract stated by D-03 / VER-01 is "no duplicate for the same `formula_version`",
not "no duplicate at the tail", making this a correctness bug.

**Fix:**
```python
existing_versions_set = {v.get('formula_version') for v in versions}
if FORMULA_VERSION not in existing_versions_set:
    versions = versions + [new_version_record]
```

---

### CR-02: Zero-width space characters embedded in `actual_pts` table cell corrupt displayed values

**File:** `src/components/accuracy/AccuracyTab.tsx:534`

**Issue:** Line 534 contains two U+200B ZERO WIDTH SPACE characters wrapping `{r.actual_pts}`:
```tsx
<td className={TD_CLS}>{'​'}{r.actual_pts}{'​'}</td>
```
These invisible characters appear as literal Unicode in the DOM between the zero-width-space
string literals and the number. While they are invisible to the eye, they:
1. Break `textContent`-based assertions — any test that does `textContent.includes('1')` on
   this cell will match the zero-width space wrapper, not a clean number.
2. Break any downstream copy-paste or programmatic extraction of the cell value from the DOM.
3. May confuse screen readers (VoiceOver/NVDA) depending on how they handle U+200B inside
   numeric content.

No similar pattern exists on any other numeric cell in the file, confirming this is not
intentional convention.

**Fix:**
```tsx
<td className={TD_CLS}>{r.actual_pts}</td>
```

---

## Warnings

### WR-01: `HaulterList` heading "Correctly Flagged Haulers" is factually incorrect — the table shows ALL haulters

**File:** `src/components/accuracy/AccuracyTab.tsx:420`

**Issue:** The section heading reads `"Correctly Flagged Haulers"`, but `HaulterList` renders
every entry in `data.haulters` — including those where `h.xpts_flagged === false` (model missed
them). The `FlaggedCell` column exists precisely to distinguish hits from misses, confirming
that unflagged haulters are expected in the table. The misleading heading will confuse users
interpreting the accuracy data: they will believe the table only shows correct predictions when
in fact it shows all players who hauled, regardless of whether the model flagged them.

**Fix:**
```tsx
<h2 className="text-lg font-semibold mb-2">All Haulers (GW Backtest)</h2>
```
Or, to make the "flagged" column self-explanatory:
```tsx
<h2 className="text-lg font-semibold mb-2">Haulers — xPts ✓ = model flagged, ✗ = model missed</h2>
```

---

### WR-02: `accuracy_backtest.json` is opened and parsed three times in one pipeline run

**File:** `pipeline/accuracy.py:327-333`

**Issue:** `compute_accuracy_backtest()` calls three separate helpers in sequence:
```python
xmins_v2_enabled = _read_existing_xmins_v2_flag(cache_dir)       # open + json.load
bonus_predictor_enabled = _read_existing_bonus_predictor_flag(cache_dir)  # open + json.load
versions = _read_existing_versions(cache_dir)                      # open + json.load
```
Each helper independently opens and parses the same file. On a busy or slow filesystem this
triples the I/O for a file that can be several MB (5 GWs × 500 players). Additionally,
`_empty_backtest()` adds two more redundant reads (`_read_existing_xmins_v2_flag` +
`_read_existing_bonus_predictor_flag`). If the file changes between reads (unlikely but
possible with concurrent pipeline runs), the three helpers may return inconsistent values from
different file snapshots.

**Fix:** Extract a single `_read_existing_cache(cache_dir)` helper that parses the file once
and returns the full dict, then derive all three values from it:
```python
def _read_existing_cache(cache_dir: str) -> dict:
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}

# In compute_accuracy_backtest:
prior = _read_existing_cache(cache_dir)
xmins_v2_enabled = bool(prior.get('summary', {}).get('xmins_v2_enabled', False))
bonus_predictor_enabled = bool(prior.get('summary', {}).get('bonus_predictor_enabled', False))
existing = prior.get('versions', [])
versions = existing if isinstance(existing, list) else []
```

---

### WR-03: `_empty_backtest` does not append a new `formula_version` record to the `versions` list

**File:** `pipeline/accuracy.py:418`

**Issue:** When `finished_gws < 1`, `compute_accuracy_backtest` returns the output of
`_empty_backtest`, which simply preserves the existing `versions` list verbatim without
appending the current `FORMULA_VERSION` record. This means the first pipeline run of a new
season (before any GW finishes) never records the initial version. The version history will
therefore show a gap from the pre-season run, and the first "current" badge will only appear
after GW 1 completes — possibly weeks into the season.

This diverges from the main path, which always appends a version record (subject to dedup).

**Fix:** Add the same dedup-append logic inside `_empty_backtest`, using `hit_rate: 0.0` since
no accuracy data is available:
```python
existing_versions = _read_existing_versions(cache_dir)
existing_set = {v.get('formula_version') for v in existing_versions}
if FORMULA_VERSION not in existing_set:
    existing_versions = existing_versions + [{
        'formula_version': FORMULA_VERSION,
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'hit_rate': 0.0,
        'gate_flags': {
            'form_signal_enabled': False,
            'xmins_v2_enabled': _read_existing_xmins_v2_flag(cache_dir),
            'bonus_predictor_enabled': _read_existing_bonus_predictor_flag(cache_dir),
        },
    }]
# Then return existing_versions in the result dict
```

---

### WR-04: `PlayerDeltaTable` `Team` column header is not sortable but has no `aria-sort` attribute, unlike the other non-sortable column in `HaulterList`

**File:** `src/components/accuracy/AccuracyTab.tsx:522`

**Issue:** In `PlayerDeltaTable`, the `Team` column header uses `TH_CLS` (non-interactive) but
the surrounding columns all have `aria-sort` via `ariaSort()`. The `Team` `<th>` has neither
`aria-sort` nor `onClick`. This inconsistency means:
1. Screen readers see a column header with no sort state declared among columns that do declare
   it — inconsistent landmark behaviour.
2. Users may be confused about why `Team` is not sortable (no visual cue).

The `DeltaRow` type already includes `team: string`, so sortability could be added. At minimum,
`aria-sort="none"` should be added to the static header for consistency.

**Fix (minimum):**
```tsx
<th scope="col" className={TH_CLS} aria-sort="none">Team</th>
```
**Fix (preferred):** Add `'team'` to `SortKey` and wire it to `handleSort`.

---

## Info

### IN-01: `test_version_dedup` only tests the tail-match case, leaving the interior-match regression uncovered

**File:** `pipeline/tests/test_accuracy.py:409`

**Issue:** The dedup test seeds a versions list where the matching version is already at
`versions[-1]`. As noted in CR-01, the production guard only inspects the tail, so a test that
also seeds a list where `FORMULA_VERSION` is at an interior position (not the last) would
expose the bug. Without this test, CR-01 will silently regress in future if the dedup logic is
refactored.

**Fix:** Add a complementary test case:
```python
def test_version_dedup_interior_match(tmp_path):
    """A FORMULA_VERSION record that is NOT at versions[-1] must not be duplicated."""
    import json as _json
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({
        'versions': [
            {'formula_version': FORMULA_VERSION, 'recorded_at': '2026-01-01T00:00:00+00:00',
             'hit_rate': 0.3, 'gate_flags': {'form_signal_enabled': False,
             'xmins_v2_enabled': False, 'bonus_predictor_enabled': False}},
            {'formula_version': 'v9.99-z', 'recorded_at': '2026-01-02T00:00:00+00:00',
             'hit_rate': 0.4, 'gate_flags': {'form_signal_enabled': False,
             'xmins_v2_enabled': False, 'bonus_predictor_enabled': False}},
        ],
    }))
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures, cache_dir=str(tmp_path))
    formula_versions = [v['formula_version'] for v in result['versions']]
    assert formula_versions.count(FORMULA_VERSION) == 1, \
        "Interior FORMULA_VERSION match must not be duplicated"
```

---

### IN-02: `formatRecordedAt` uses `new Date(iso).toISOString().slice(0, 10)` — silently converts to UTC, which may display the wrong date for non-UTC `recorded_at` strings

**File:** `src/components/accuracy/AccuracyTab.tsx:73`

**Issue:**
```ts
function formatRecordedAt(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}
```
`accuracy.py` writes `datetime.now(timezone.utc).isoformat()` which produces strings like
`2026-05-06T23:45:00+00:00`. Calling `.toISOString()` on a JS Date re-serialises to UTC, so
for UTC inputs this is safe. However, if the string ever comes from a non-UTC source (e.g., a
manually edited JSON), `toISOString()` will normalise to UTC and could produce a date one day
off from what was stored. More importantly, `new Date(iso)` with a malformed or empty string
returns an `Invalid Date` and `.toISOString()` throws a `RangeError`, crashing the component.

**Fix:**
```ts
function formatRecordedAt(iso: string): string {
  // Slice the date portion directly from the ISO string — no Date parse needed for UTC inputs
  return iso.slice(0, 10)
}
```
This is safe because `accuracy.py` always produces valid ISO 8601 UTC strings, and it avoids
the `Invalid Date` throw entirely.

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
