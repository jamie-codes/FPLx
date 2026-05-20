---
phase: 128-pre-season-auto-activation
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - pipeline/run.py
  - pipeline/suggest_squad.py
  - pipeline/tests/test_run_offseason.py
  - pipeline/tests/test_suggest_squad.py
  - src/app/api/pre-season-active/route.ts
  - src/components/next-season/NextSeasonPlannerTab.test.tsx
  - src/components/next-season/NextSeasonPlannerTab.tsx
  - src/lib/hooks/usePreSeasonActive.test.ts
  - src/lib/hooks/usePreSeasonActive.ts
  - src/lib/types.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 128: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase adds the pre-season auto-activation pipeline path (AUTO-01/02), the `/api/pre-season-active` route (AUTO-03), a `usePreSeasonActive` hook, and the activation status pill + first-activation banner in `NextSeasonPlannerTab`. The implementation is largely well-structured and follows established project patterns (idempotency guards, non-fatal try/except, dual blob/local paths). One critical defect was found in `_derive_squad_dict`: under edge-case ILP output the formation-adjustment loops can silently produce a squad with the wrong number of starters, which is then written to storage without any size check. Four warnings cover a Tailwind CSS class conflict that breaks the left-border accent, a missing validation in `suggest_squad`, an unguarded `int()` cast on `deadline_time`, and no component-level tests for the new banner/pill feature. Two informational items cover a weak staleTime test and the incomplete `_season_id` test coverage.

---

## Critical Issues

### CR-01: `_derive_squad_dict` may silently write an invalid squad (wrong starter count)

**File:** `pipeline/suggest_squad.py:185-246`

**Issue:** The formation-adjustment loops at lines 187–208 both contain a `break` escape that fires when no further trimming or filling is possible. If either loop exits early, `total_field` is not 10, and the resulting `starters` list will have a length other than 11. The constructed `squad_dict` is then written to Blob/local storage with no downstream size check. In practice, ILP output with exactly 2 GKs + 13 field players will only hit the `break` if the field player counts are structurally impossible to reach 10 field starters under FPL XI constraints (DEF 3-5, MID 2-5, FWD 1-3); the ILP does not enforce XI constraints, only squad constraints (DEF 3-5 squad, MID 2-5 squad, FWD 1-3 squad). A valid squad could have, for example, DEF=5, MID=5, FWD=3 (total=13) — the trim loop handles that safely. However a squad with an unusual MIN_SLOTS combination such as DEF=3, MID=3, FWD=7 can never occur given `MAX_SLOTS[4]=3`, so the realistic risk is low but the code still writes whatever it produces without validation.

The absence of a post-call size check means that if the formation-adjustment logic ever produces the wrong number of starters (through a bug introduced in a future edit, or an ILP result that doesn't match expectations), an invalid squad would be silently persisted and served to users.

**Fix:** Add an assertion/guard after `_derive_squad_dict` returns, and optionally inside the function before returning:

```python
# In suggest_squad() after squad_dict = _derive_squad_dict(selected, score_map):
if len(squad_dict['starters']) != 11 or len(squad_dict['bench']) != 4:
    print(
        f"[suggest_squad] formation error: got {len(squad_dict['starters'])} starters, "
        f"{len(squad_dict['bench'])} bench — skipping write.",
        file=sys.stderr,
    )
    return

save(SQUAD_KEY, squad_dict)
```

Or, inside `_derive_squad_dict` at line 245 before returning:
```python
assert len(starters) == 11, f"expected 11 starters, got {len(starters)}"
assert len(bench) == 4, f"expected 4 bench, got {len(bench)}"
```

---

## Warnings

### WR-01: Tailwind border-color class conflict breaks left-border accent on player rows

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:62`

**Issue:** The player row `div` has the class string:
```
border-b border-zinc-100 dark:border-zinc-800 border-l-2 border-green-500 pl-2
```
In Tailwind, `border-zinc-100` and `border-green-500` both set `border-color`. The `border-green-500` class appears last and wins the cascade, overwriting the color applied by `border-zinc-100`. This means the bottom separator border renders green instead of zinc, creating an unintended visual artefact. The design intent is clearly zinc bottom border + green left accent.

**Fix:** Use the directional border-color utilities to scope each colour to its axis:
```tsx
className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 border-l-2 border-l-green-500 pl-2 text-sm"
```
`border-l-green-500` scopes the green color to the left border only; `border-zinc-100` then correctly governs the bottom border.

---

### WR-02: `deadline_time[:4]` cast to `int` is unguarded against short or non-numeric strings

**File:** `pipeline/run.py:272`

**Issue:** The activation block at line 272 does:
```python
_year = int(events[0]['deadline_time'][:4])
```
The predicate at line 255 only checks `bool(events[0].get('deadline_time'))`, which guarantees the key exists and the value is truthy (non-None, non-empty string). It does NOT guarantee the string is at least 4 characters long or that the first 4 characters are numeric digits. If the FPL API returned a malformed `deadline_time` (e.g. `"TBD"` or `"???"`) the slice produces a non-numeric string and `int(...)` raises `ValueError`. This is caught by the outer `except Exception as _pa_exc` at line 301 (non-fatal), but the `pre_season_active.json` artifact would already have been saved at line 274 with an empty `_season_id`. The write happens before the `_year` usage — actually looking at the code flow: `_year` is computed at line 272 and the artifact is written at lines 274-277, so if `int(...)` raises at line 272, the artifact is NOT written. However `_season_id` derivation at line 273 also uses `_year - 1`, so a non-numeric value causes a silent skip. No data corruption occurs, but the activation silently fails for an entire pipeline run with no clear signal beyond the generic non-fatal error.

**Fix:** Validate the format before converting:
```python
_dt_str = events[0].get('deadline_time', '')
if not _dt_str or len(_dt_str) < 4 or not _dt_str[:4].isdigit():
    print(f"[pipeline] Pre-season activation: malformed deadline_time {_dt_str!r} — skipping.", file=sys.stderr)
else:
    _year = int(_dt_str[:4])
    _season_id = f"{str(_year - 1)[-2:]}{str(_year)[-2:]}"
    save(_active_key, { 'activated_at': _dt.now(_tz.utc).isoformat(), 'season_id': _season_id })
    ...
```

---

### WR-03: No component tests for the activation status pill or first-activation banner

**File:** `src/components/next-season/NextSeasonPlannerTab.test.tsx:84-179`

**Issue:** `NextSeasonPlannerTab.test.tsx` adds the `usePreSeasonActiveMock` but then never varies it beyond the default `{ data: null, isLoading: false, isSuccess: true }` (Awaiting state). All nine existing tests run with the banner and "Live" pill permanently suppressed. The Phase 128 banner (lines 210-225 in the component) and the "Live" pill (lines 194-204) are entirely untested. This means:

1. A regression that breaks the pill render condition (`activeData !== undefined`) would not be caught.
2. A typo in the banner copy (e.g. the emoji or the dismiss button label) would not be caught.
3. The `dismissed` state transition (clicking the dismiss `<button>`) would not be caught.
4. The localStorage write in the dismiss handler would not be caught.

**Fix:** Add at minimum:
- A test that sets `usePreSeasonActiveMock.mockReturnValue({ data: { activated_at: '...', season_id: '2526' }, isLoading: false, isSuccess: true })` and asserts the "Live" pill text is visible and the banner text is visible.
- A test that mocks `localStorage.getItem` returning `'true'` and confirms the banner is suppressed.
- A test that simulates clicking the dismiss button, confirms `localStorage.setItem` was called with the correct key, and confirms the banner disappears.

---

### WR-04: `_season_id` derivation is not covered by any test in `test_run_offseason.py`

**File:** `pipeline/tests/test_run_offseason.py:167-270`

**Issue:** The activation-predicate tests in `test_run_offseason.py` verify only whether `_evaluate_activation_predicate` returns `True` or `False`. They do not test the `_season_id` derivation logic (`f"{str(_year - 1)[-2:]}{str(_year)[-2:]}"` from `events[0]['deadline_time'][:4]`). This is a non-trivial string manipulation that is susceptible to year-boundary bugs (e.g. year `2100` would give `season_id = "9900"` instead of the expected `"9900"` — actually correct; but a year like `2009` would yield `"0809"` which may or may not be the intended format). The derivation is correct for the expected 2025/2026 case, but since it is tested nowhere, a future refactor could silently break it.

**Fix:** Add a replica-function test for the `_season_id` derivation to `test_run_offseason.py`:
```python
def _derive_season_id(deadline_time: str) -> str:
    year = int(deadline_time[:4])
    return f"{str(year - 1)[-2:]}{str(year)[-2:]}"

def test_derive_season_id_2526():
    assert _derive_season_id('2026-08-15T11:30:00Z') == '2526'

def test_derive_season_id_2425():
    assert _derive_season_id('2025-08-09T10:00:00Z') == '2425'
```

---

## Info

### IN-01: `usePreSeasonActive` `staleTime` test does not actually verify the configured value

**File:** `src/lib/hooks/usePreSeasonActive.test.ts:73-93`

**Issue:** The test named `'uses staleTime of 60_000 ms'` verifies only that `result.current.isStale` is `false` immediately after resolution, which would be true for any positive `staleTime` value (including the default of 0). It does not confirm the configured value is actually 60,000 ms. A developer who changed `staleTime: 60_000` to `staleTime: 1` would not be caught by this test.

**Fix:** Assert the `staleTime` value directly by inspecting the query options, or document the test as verifying "immediately-resolved query is not stale" and add a separate test that mocks time elapsed beyond 60s to confirm staleness:
```typescript
// Verify the configured staleTime on the query
const cachedQuery = queryClient.getQueryCache().find({ queryKey: ['pre-season-active'] })
// TanStack Query stores observer options; this is an integration check:
expect(cachedQuery?.observers[0]?.options.staleTime).toBe(60_000)
```

---

### IN-02: `TODO` comment for deferred fixture data is untriggered dead code path in production

**File:** `src/components/next-season/NextSeasonPlannerTab.tsx:170-188`

**Issue:** Lines 172-173 declare:
```typescript
const nextSeasonFixtures: unknown[] = [] // deferred: no fixture data available until FPL publishes
const hasFixtures = nextSeasonFixtures.length > 0
```
`hasFixtures` is always `false`, making the `hasFixtures ? (...)` branch (lines 175-178) permanently dead code at ship time. The comment and `TODO` note this is intentional, but the live production render path always takes the empty-state branch. This is an accepted deferred state per the phase design, however the dead code will trigger linting warnings if the project enforces `no-constant-condition` or similar rules.

**Fix:** No code change required if this is intentional. Confirm the linter is configured to allow this pattern, or add an eslint-disable comment to suppress the warning when it surfaces:
```typescript
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const hasFixtures = nextSeasonFixtures.length > 0
```
The existing `// eslint-disable-next-line @typescript-eslint/no-unused-vars` at line 18 shows this pattern is already used in the file.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
