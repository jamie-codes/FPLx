---
phase: 126-next-season-planner
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - pipeline/archive_season.py
  - pipeline/requirements.txt
  - pipeline/run.py
  - pipeline/suggest_squad.py
  - pipeline/test_archive_season.py
  - src/app/api/pre-season-squad/route.ts
  - src/app/page.test.tsx
  - src/app/page.tsx
  - src/components/club-form/FixtureHeatMap.tsx
  - src/components/next-season/NextSeasonPlannerTab.test.tsx
  - src/components/next-season/NextSeasonPlannerTab.tsx
  - src/lib/hooks/usePreSeasonSquad.ts
  - src/lib/pre-season-squad.test.ts
  - src/lib/pre-season-squad.ts
  - src/lib/types.ts
findings:
  critical: 2
  warning: 2
  info: 3
  total: 7
status: issues_found
---

# Phase 126: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 126 introduces the Next Season Planner: a Python season-archive pipeline step (`archive_season.py`), an ILP squad builder (`suggest_squad.py`), a TS greedy fallback (`pre-season-squad.ts`), a route handler (`/api/pre-season-squad`), and a UI tab (`NextSeasonPlannerTab`).

The Python pipeline and TS library logic are generally well-structured and defensively written. Two blockers were found: a production dead-code path (the ILP squad builder is silently skipped in the Blob/production environment), and missing mocks in `page.test.tsx` that would cause test failures when any future test navigates to the affected sub-tabs. Two warnings cover an inconsistent null guard in `FixtureHeatMap.tsx` and the absent idempotency check in `suggest_squad`.

---

## Critical Issues

### CR-01: `NextSeasonPlannerTab` and `SeasonReviewTab` not mocked in `page.test.tsx`

**File:** `src/app/page.test.tsx:1`

**Issue:** `page.tsx` imports `NextSeasonPlannerTab` (line 31) and `SeasonReviewTab` (line 27). Neither component is mocked in `page.test.tsx`, unlike every other leaf component imported by `page.tsx` (all mocked via `vi.mock`). The tests currently pass only because no test navigates to `activeSubTab === 'next-season'` or `activeSubTab === 'season'`. However:

1. The test at line 211–229 asserts the Plan sub-tab order now includes `'Next Season'`, which means the tab button is rendered. Any future test that clicks that button will mount the real `NextSeasonPlannerTab`, triggering `usePreSeasonSquad` → `fetch('/api/pre-season-squad')` in jsdom without a network mock, causing an unhandled fetch error.
2. The same risk exists for the `'Season'` sub-tab in the Analyse section.
3. If either component has a transitive import that does not work in a jsdom environment, the entire `page.test.tsx` file will fail at import time — a silent landmine for the next developer adding a test.

**Fix:**
```tsx
// Add to page.test.tsx alongside the other vi.mock() calls at the top of the file
vi.mock('@/components/next-season/NextSeasonPlannerTab', () => ({
  NextSeasonPlannerTab: () => <div data-testid="next-season-planner-tab" />,
}))

vi.mock('@/components/season-review/SeasonReviewTab', () => ({
  SeasonReviewTab: (_props: { teamId: string | null }) => <div data-testid="season-review-tab" />,
}))
```

---

### CR-02: `suggest_squad` ILP is silently skipped in production (USE_BLOB=true)

**File:** `pipeline/run.py:218-226`

**Issue:** The `suggest_squad` block in `run.py` reads the archive from the local filesystem (`os.path.exists(archive_path)`). In production (`USE_BLOB=true`), `archive_season.py` writes the archive **only to Vercel Blob**, not to local disk. Therefore `archive_path` never exists on the Blob path and `suggest_squad` is skipped with a `stderr` message every single GW38 pipeline run. `pre_season_squad.json` is never written to Blob in production.

The consequence is that Resolution 1 of the route handler (`/api/pre-season-squad` lines 37–44 — "prefer pre-computed ILP result") fires for all local development runs but is **dead code in production**. In production the route always falls through to Resolution 2 (re-derives the squad from the raw archive on every request), defeating the purpose of the pre-computation.

```python
# run.py lines 213-226
# Only attempted on local (non-Blob) path; in production the archive Blob artifact
# is read back from disk if it was just written by archive_season().
try:
    from suggest_squad import suggest_squad
    archive_path = os.path.join(cache_dir, 'season_archive_gw38.json')
    if os.path.exists(archive_path):           # ← always False when USE_BLOB=true
        ...
        suggest_squad(bootstrap, _archive)
    else:
        print("[suggest_squad] ... skipping ILP.")  # ← always reached in production
```

**Fix:** After `archive_season()` succeeds on the Blob path, fetch the archive back from Blob (or pass the in-memory data directly) so `suggest_squad` can run. The cleanest fix is to have `archive_season` return the data it fetched, or to add a Blob-read path in `run.py`:

```python
if IS_GW38:
    try:
        from archive_season import archive_season
        archive_season(bootstrap)
        print("Season archive written.")
    except Exception as arc_exc:
        print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)

    try:
        from suggest_squad import suggest_squad
        archive_path = os.path.join(cache_dir, 'season_archive_gw38.json')
        _archive = None
        if os.path.exists(archive_path):
            with open(archive_path, 'r', encoding='utf-8') as _f:
                _archive = json.load(_f)
        elif os.getenv('USE_BLOB', '').lower() == 'true':
            # Blob path: read back the archive that was just written
            from upload import read_json  # or use vercel_blob.get directly
            _archive = read_json('season_archive_gw38.json')
        if _archive is not None:
            suggest_squad(bootstrap, _archive)
            print("Pre-season squad written.")
        else:
            print("[suggest_squad] archive not available — skipping ILP.", file=sys.stderr)
    except Exception as sq_exc:
        print(f"[suggest_squad] non-fatal error: {sq_exc}", file=sys.stderr)
```

Alternatively, refactor `archive_season` to return the fetched data so the caller can pass it directly to `suggest_squad` without a second read.

---

## Warnings

### WR-01: `suggest_squad` missing idempotency check (inconsistent with `archive_season`)

**File:** `pipeline/suggest_squad.py:253`

**Issue:** `archive_season.py` checks `_blob_exists(ARCHIVE_KEY)` as its first statement and returns immediately if the artifact already exists (idempotency guard). `suggest_squad` has no equivalent check: it re-runs the PuLP ILP solver and overwrites `pre_season_squad.json` on every `IS_GW38` pipeline run on the local path. This is inconsistent with the stated idempotency intent and performs unnecessary ILP work on repeated runs.

**Fix:** Add a blob/file existence check at the start of `suggest_squad`:
```python
def suggest_squad(bootstrap: dict, archive: dict) -> None:
    # Idempotency: skip if pre_season_squad.json already exists
    try:
        import vercel_blob
        result = vercel_blob.list({'prefix': SQUAD_KEY, 'limit': 1})
        if len(result.get('blobs', [])) > 0:
            print("[suggest_squad] already exists — skipping.")
            return
    except Exception:
        pass  # treat as absent; proceed
    ...
```
For the local path, check `os.path.exists(os.path.join('pipeline/cache', SQUAD_KEY))` before running the ILP.

---

### WR-02: Inconsistent null guard on `.toFixed(2)` in DGW tooltip path

**File:** `src/components/club-form/FixtureHeatMap.tsx:143`

**Issue:** In the single-fixture render path (line 168), the code defensively writes `(diff ?? 0).toFixed(2)` to guard against undefined values. In the DGW multi-fixture tooltip path (line 143), the same `.toFixed(2)` call is made without any null guard:

```tsx
// line 143 — no null guard:
.map(f => `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) ${(mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty).toFixed(2)}`)

// line 168 — null guard present:
const baseTooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${(diff ?? 0).toFixed(2)}`
```

`ClubFormFixture` currently declares both fields as required `number`. However, if a pipeline-produced cache file omits these fields (e.g., an older pipeline version or a partial-write), a runtime `TypeError: Cannot read properties of undefined (reading 'toFixed')` would be thrown inside the `useMemo` on line 222, crashing the entire `FixtureHeatMap` component with an unhandled error (no ErrorBoundary wraps it in the parent `ClubFormTab`).

**Fix:**
```tsx
// line 143 — match the defensive pattern used at line 168:
.map(f => {
  const d = (mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty) ?? 0
  return `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) ${d.toFixed(2)}`
})
```

---

## Info

### IN-01: `run.py` prints "Season archive written." even when idempotency guard skips the write

**File:** `pipeline/run.py:209`

**Issue:** `archive_season()` returns `None` on both the idempotency-skip path (blob already exists) and the success path. The `run.py` caller prints `"Season archive written."` after every non-exception return, so on repeated GW38 runs the log misleadingly reports a write that did not occur.

**Fix:**
```python
# Option A: change archive_season() to return a status bool
result = archive_season(bootstrap)
if result:
    print("Season archive written.")
else:
    print("[archive_season] skipped (already exists or insufficient data).")

# Option B (minimal): update the log message to be honest
print("Season archive step complete.")  # covers both skip and write
```

---

### IN-02: `_derive_squad_dict` can silently produce a malformed XI when field-position adjustment loops break early

**File:** `pipeline/suggest_squad.py:185-208`

**Issue:** The `while total_field < 10` loop at line 199 has a `break` escape (line 207) that fires when all three field positions are at their maximum. This can only happen if the ILP selected players in a formation where the sum of all field players is below 10 (e.g., a squad with only 6 field players). The ILP constraints (MIN_SLOTS/MAX_SLOTS) make this mathematically impossible for a valid 15-player squad with correct position quotas. However, if the `selected` list passed in is not a valid 15-player ILP output (e.g., from future callers), the loop would break silently and `starters` would contain fewer than 11 players, producing a malformed `PreSeasonSquad` without any error.

**Fix:** Add an assertion after the adjustment loops to catch this invariant violation loudly during testing:
```python
# After the while loops, before building starter_defs:
assert def_starters + mid_starters + fwd_starters == 10, (
    f"Formation adjustment failed: {def_starters}-{mid_starters}-{fwd_starters} != 10"
)
```

---

### IN-03: `test_archive_season.py` — `test_non_fatal_player_failures_do_not_abort` tests redundant code path

**File:** `pipeline/test_archive_season.py:88-112`

**Issue:** The test patches `_fetch_one` to raise `RuntimeError`. However, `_fetch_one` is designed to never raise — it catches all exceptions internally and returns `(player_id, None)`. The test therefore exercises only the redundant outer `except` in `_fetch_all_summaries` (lines 75-77 of `archive_season.py`), not the intended "non-fatal player failures" path described in the docstring. The real "non-fatal failure" path is tested by `test_partial_write_guard_failure`, which correctly patches `_fetch_one` to return `(player_id, None)`.

This does not affect correctness (the test still passes and verifies the outer guard), but the test description is misleading and the redundant outer `except` block in `_fetch_all_summaries` may itself be unnecessary if `_fetch_one` is truly guaranteed not to raise.

**Fix:** Either update the test to match its description (return `(player_id, None)` instead of raising), or rename it to accurately describe what it tests (`test_fetch_all_summaries_outer_exception_guard`). The redundant outer `except` in `_fetch_all_summaries` can remain as defence-in-depth, but should be documented as such.

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
