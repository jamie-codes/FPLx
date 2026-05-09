---
phase: 84-set-piece-threat-assisted-pipeline
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/set_piece_quality.py
  - pipeline/tests/test_set_piece_quality.py
  - pipeline/data_health.py
  - pipeline/tests/test_data_health.py
  - pipeline/run.py
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 84: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 84 adds `pipeline/set_piece_quality.py`, extends `pipeline/data_health.py` with a
`sp_unmatched_count` keyword argument, and wires both into `pipeline/run.py`. The core
correctness invariants (aggregate by deliverer not shooter, EB shrinkage k=20, D-07
no-overwrite on failure) are all implemented correctly. No security vulnerabilities or
data-loss bugs were found.

Four warnings were identified: the test suite has zero coverage of the public
`run_sp_quality()` API and the cache layer; tests write real files to `pipeline/cache/`
instead of the `tmp_path` they receive; the Understat season year is hardcoded (breaks next
season without a code change); and the prior-mean calculation in `_compute_per_taker_scores`
double-counts deliverers active in both set-piece situations, skewing the EB prior.

Four informational items cover dead code (`SP_QUALITY_PATH` unused constant), a stale
comment in `run.py`, an unconditional post-loop `time.sleep`, and an overly broad
`_ENV_VAR_PATTERN` that will redact common technical strings (e.g. `HTTP`, `JSON`) from
error messages.

---

## Warnings

### WR-01: Zero test coverage for `run_sp_quality()` and cache layer

**File:** `pipeline/tests/test_set_piece_quality.py:1`
**Issue:** The entire public surface of `set_piece_quality.py` is untested: `run_sp_quality()`,
`_scrape_all_teams()`, `_parse_shots()`, `_is_sp_cache_fresh()`, `_load_sp_cache()`, and
`_write_sp_cache()`. All 13 tests exercise only the three pure-function helpers
(`_aggregate_shots`, `_compute_per_taker_scores`, `_shrink`). A silent failure path exists:
if `_parse_shots()` fails to match the Understat HTML pattern for all teams,
`run_sp_quality()` succeeds (returns `0` unmatched) and writes an empty `sp_quality.json`
with no observable error. There is no guard against an empty `all_shots` list before
writing the output.

**Fix:** Add tests for at least:
1. `_parse_shots()` with a minimal HTML fixture containing `var shotsData = JSON.parse(...)`.
2. The empty-shots path in `run_sp_quality()` — guard or surface a warning when
   `all_shots` is empty after scraping, e.g.:
```python
if not all_shots:
    print("[set_piece_quality] all teams returned 0 shots; aborting", file=sys.stderr)
    return None
```
3. Cache round-trip: `_write_sp_cache` followed by `_is_sp_cache_fresh` and `_load_sp_cache`.

---

### WR-02: Test side-effects write to real `pipeline/cache/` directory

**File:** `pipeline/tests/test_data_health.py:36`
**Issue:** `compute_data_health()` calls `save('data_health.json', result)` (line 169 of
`data_health.py`), which — when `USE_BLOB` is unset — calls `save_local('data_health.json',
result)` and writes to the hard-coded path `pipeline/cache/data_health.json` regardless of
the `tmp_path` passed by tests. The `tmp_path` fixture is used only for reading the prior
health record. Every `test_data_health.py` test that calls `compute_data_health()` therefore
mutates the live `pipeline/cache/data_health.json` file on disk. A subsequent pipeline run
that reads the prior count from that file will see a test-generated value (3 to 820 players
depending on which test ran last), potentially triggering a false `missing_player_delta`
alert.

**Fix:** Either mock `save` in the test fixture, or set `USE_BLOB=false` and redirect
`cache_dir` to `tmp_path` — but note that `save()` ignores `cache_dir` entirely. The
cleanest fix is to monkeypatch `upload.save`:
```python
@pytest.fixture(autouse=True)
def no_save(monkeypatch):
    monkeypatch.setattr('data_health.save', lambda name, data: None)
```

---

### WR-03: Hardcoded season year `2025` in Understat URL

**File:** `pipeline/set_piece_quality.py:270`
**Issue:** The URL template `https://understat.com/team/{name}/2025` has the season year
hard-coded. When the 2025-26 season concludes and FPL 2026-27 begins, this module will
silently scrape the previous season's shot data, producing stale quality scores with no
error. The rest of the pipeline uses FPL API data which updates automatically; this is the
only place a year constant must be manually bumped.

**Fix:** Derive the season year dynamically, matching the approach used elsewhere:
```python
# At module level or passed as a parameter:
from datetime import datetime, timezone
_SEASON_START_YEAR = 2025  # bump each August when season rolls over

# Or derive from FPL bootstrap 'events' data (the current_event GW date)
```
At minimum, extract the magic number to a named constant so it is obvious and
searchable:
```python
UNDERSTAT_SEASON = '2025'  # UPDATE each August when season rolls over
# ...
url = f"https://understat.com/team/{team.replace(' ', '_')}/{UNDERSTAT_SEASON}"
```

---

### WR-04: Prior mean double-counts deliverers active in both set-piece buckets

**File:** `pipeline/set_piece_quality.py:160-169`
**Issue:** `_compute_per_taker_scores` builds `all_means` by appending the corner mean
AND the FK mean for any deliverer who has shots in both buckets. A player with 50 corners
and 3 FKs contributes two entries to `all_means`, while a pure corner taker contributes one.
This unequally weights the prior toward players who take both types of set piece, and is not
the shot-count-weighted global average that "prior mean over all takers" would typically imply.
No comment or reference to RESEARCH Pattern 5 explains this as intentional.

```python
# Current (lines 162-168) — double-counts multi-discipline takers:
for did in deliverer_ids:
    c_xgs = corner_shots.get(did, [])
    f_xgs = fk_shots.get(did, [])
    if c_xgs:
        all_means.append(statistics.mean(c_xgs))
    if f_xgs:
        all_means.append(statistics.mean(f_xgs))
```

**Fix:** If the intent is "mean xG per delivery across all observed set-piece shots",
compute it directly:
```python
all_xgs = []
for did in deliverer_ids:
    all_xgs.extend(corner_shots.get(did, []))
    all_xgs.extend(fk_shots.get(did, []))
prior_mean = statistics.mean(all_xgs) if all_xgs else 0.0
```
If the double-counting is intentional (e.g. to weight the prior toward versatile takers),
add a comment explaining the design choice.

---

## Info

### IN-01: Dead constant `SP_QUALITY_PATH` never used

**File:** `pipeline/set_piece_quality.py:33-35`
**Issue:** `SP_QUALITY_PATH` is defined at module level but referenced nowhere in the file.
The actual write is routed through `save('sp_quality.json', sp_quality)` (line 337) via the
upload module, which constructs its own path via `save_local`. The constant is dead code and
misleadingly implies that the module writes directly to that path.

**Fix:** Remove the constant.
```python
# Delete lines 33-35:
# SP_QUALITY_PATH = os.path.join(
#     os.path.dirname(os.path.abspath(__file__)), 'cache', 'sp_quality.json'
# )
```

---

### IN-02: Stale comment in `run.py` says kwarg will be added "in Plan 02"

**File:** `pipeline/run.py:235-236`
**Issue:** The comment reads:
> "Plan 02 (Phase 84) will extend the compute_data_health() call site below to pass
> sp_unmatched_count once data_health.py adds the matching kwarg."

This is factually wrong — the kwarg has already been added and the call at line 414-415
already passes `sp_unmatched_count=sp_unmatched_count`. The stale comment will mislead
future readers into thinking this wiring is still pending.

**Fix:** Remove or update the two stale lines:
```python
# Remove lines 235-236 entirely. The block comment from 231-234 is sufficient:
# Initialise sp_unmatched_count BEFORE try (CONTEXT.md D-05 / Pitfall 2)
# so the failure case never reaches compute_data_health() with a false 0.
```

---

### IN-03: Unnecessary `time.sleep` after final loop iteration in `_scrape_all_teams`

**File:** `pipeline/set_piece_quality.py:276`
**Issue:** `time.sleep(REQUEST_PACING_SECONDS)` is placed at the bottom of the `for team`
loop with no guard, so it executes unconditionally after the last team is scraped, adding
a gratuitous 0.5-second pause before the function returns. For 20 teams this wastes 0.5s
per pipeline run.

**Fix:** Skip the sleep after the last iteration:
```python
for i, team in enumerate(sorted(team_names)):
    url = f"https://understat.com/team/{team.replace(' ', '_')}/2025"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    team_shots = _parse_shots(resp.text)
    if team_shots:
        all_shots.extend(team_shots)
    if i < len(team_names) - 1:
        time.sleep(REQUEST_PACING_SECONDS)
```

---

### IN-04: `_ENV_VAR_PATTERN` over-redacts common technical tokens in error messages

**File:** `pipeline/data_health.py:20`
**Issue:** The pattern `r'\b[A-Z][A-Z0-9_]{3,}\b'` matches any all-uppercase word of 4 or
more characters. This will redact routine tokens like `HTTP`, `JSON`, `POST`, `READ`,
`NONE`, `TRUE` from exception messages, making sanitised errors harder to diagnose. For
example: `"HTTP 403 Forbidden"` becomes `"[REDACTED] 403 Forbidden"`. The pattern is
already guarded by the `{3,}` minimum to avoid two- and three-char tokens, but 4-char all-
uppercase words are common in technical messages.

**Fix:** The pattern is intentional (per D-19) and the test coverage is correct for the
stated goal (strip env-var tokens). No code change is strictly required, but a clarifying
comment that this is a known over-match accepted as an acceptable trade-off would help:
```python
# Note: pattern intentionally over-matches common uppercase tokens (HTTP, JSON, etc.)
# as an acceptable trade-off — false positives in sanitised error messages are
# preferable to accidentally leaking real token values.
_ENV_VAR_PATTERN = re.compile(r'\b[A-Z][A-Z0-9_]{3,}\b')
```

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
