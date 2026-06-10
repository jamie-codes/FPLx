# ATF-01: Attack Team Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the player's own team's recent goals-scored rate as a symmetric multiplicative scale on `xg_per90` and `xa_per90` in the xPts model, tunable via two new TUNE-01 parameters (`atf_slope`, `atf_window_gws`).

**Architecture:** Pipeline-only change. The new `atf_scale = 1.0 + (norm_attack_rate - 0.5) × atf_slope` factor is applied inside `_compute_xpts_fixture` before computing Poisson rates. `norm_attack_rate` flows from `merge_players` (via `team_atf_form` fixture dict key) and from `build_team_atf_lookup` (backtest/tuner path). Default `atf_slope=0.0` is a perfect no-op.

**Tech Stack:** Python 3.11, pytest. No UI or `types.ts` changes.

---

## Spec correction note

The design spec listed `_cs_prob_1gw_for_fixtures` as needing modification. This is incorrect — that function calls `_cs_prob` (CS probability only) and is unaffected by ATF-01. Only the xPts computation functions (`_compute_xpts_fixture`, `_xpts_ngw`, `_xpts_per_gw`, `merge_players`) and the backtest/tuner path need changes.

---

## File map

| File | Change |
|---|---|
| `pipeline/merge.py` | `_compute_xpts_fixture` +2 params + atf_scale formula; `_xpts_ngw` + `_xpts_per_gw` each gain `atf_slope` + extract `team_atf_form` per fixture; `merge_players` gains 2 params, computes `norm_atf_form`, injects `team_atf_form` into fixture dicts |
| `pipeline/accuracy.py` | 2 new constants; `build_team_atf_lookup`; `_reconstruct_xpts` +2 params; `_reconstruct_xpts_with_form` +2 params; `build_per_gw_rows` +lookup +slope; `compute_accuracy_backtest` builds lookup once |
| `pipeline/tune.py` | 2 new imports + 2 candidate lists; `_read_prior_params` both branches; `params` dict + `sweep_order` +2 entries; both `build_per_gw_rows` calls in `_sweep_param` |
| `pipeline/run.py` | Init defaults; read from prev_backtest; pass to `merge_players`; write to `backtest_data['summary']`; extend print lines |
| `pipeline/tests/test_merge_xpts_components.py` | 3 new tests |
| `pipeline/tests/test_accuracy.py` | 4 new tests + import |
| `pipeline/tests/test_tune.py` | 2 new tests; 4 updated tests |
| `pipeline/tests/test_run.py` | Extend `_read_tuner_params` helper; update 2 contract tests |

---

## Task 1: `merge.py` — thread `norm_attack_rate` + `atf_slope` through xPts chain

**Files:**
- Modify: `pipeline/merge.py`
- Test: `pipeline/tests/test_merge_xpts_components.py`

Working directory for all commands: `pipeline/`

### Background

The xPts chain is: `merge_players` → `_xpts_ngw` / `_xpts_per_gw` → `_compute_xpts_fixture`.

`_compute_xpts_fixture` is the leaf function where `xg_per90` and `xa_per90` are turned into Poisson rates. ATF-01 inserts a symmetric scale factor before this conversion. `norm_attack_rate` is a per-fixture local variable (extracted from `fix.get('team_atf_form', 0.5)`) — exactly the same pattern as `norm_concede_rate` / `team_def_form` from CSF-01.

`_cs_prob_1gw_for_fixtures` is NOT modified — it only calls `_cs_prob` (CS probability), which ATF-01 does not affect.

### Step 1: Write the failing tests

Add these three tests to the end of `pipeline/tests/test_merge_xpts_components.py`:

```python
# ── ATF-01: attack team form ─────────────────────────────────────────────── #

def test_atf_slope_zero_no_change():
    """atf_slope=0.0 with any norm_attack_rate → identical xpts to baseline."""
    from merge import _compute_xpts_fixture
    baseline = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=4, defensive_difficulty=0.3,
    )
    with_atf = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=4, defensive_difficulty=0.3,
        norm_attack_rate=0.99, atf_slope=0.0,
    )
    assert abs(with_atf['total'] - baseline['total']) < 1e-9


def test_atf_best_attack_increases_xpts():
    """norm_attack_rate=1.0 + atf_slope=0.30 → higher xpts than slope=0 baseline."""
    from merge import _compute_xpts_fixture
    baseline = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=4, defensive_difficulty=0.3,
        atf_slope=0.0,
    )
    boosted = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=4, defensive_difficulty=0.3,
        norm_attack_rate=1.0, atf_slope=0.30,
    )
    assert boosted['total'] > baseline['total']


def test_atf_worst_attack_decreases_xpts():
    """norm_attack_rate=0.0 + atf_slope=0.30 → lower xpts than slope=0 baseline."""
    from merge import _compute_xpts_fixture
    baseline = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=4, defensive_difficulty=0.3,
        atf_slope=0.0,
    )
    penalised = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=4, defensive_difficulty=0.3,
        norm_attack_rate=0.0, atf_slope=0.30,
    )
    assert penalised['total'] < baseline['total']
```

### Step 2: Run tests to verify they fail

```
cd pipeline && python -m pytest tests/test_merge_xpts_components.py::test_atf_slope_zero_no_change tests/test_merge_xpts_components.py::test_atf_best_attack_increases_xpts tests/test_merge_xpts_components.py::test_atf_worst_attack_decreases_xpts -v
```

Expected: 3 FAILED (TypeError: unexpected keyword argument `norm_attack_rate`/`atf_slope`)

### Step 3: Add params to `_compute_xpts_fixture` and apply ATF scale

In `pipeline/merge.py`, find `_compute_xpts_fixture` at line ~269. Add two new parameters after `cs_team_form_slope: float = 0.0,` (currently the last param before `-> dict:`):

```python
    norm_attack_rate: float = 0.5,    # ATF-01: own team's goals-scored rate (normalised)
    atf_slope: float = 0.0,           # ATF-01: weight for team attack form
) -> dict:
```

Then find lines ~309-315 (the `xg`/`xa` local variables and Poisson rate computation):

```python
    xg = xg_per90 if xg_per90 is not None else 0.0
    xa = xa_per90 if xa_per90 is not None else 0.0

    # Poisson rates: scale per-90 rate to expected for this fixture's minutes.
    # xmins is unconditional expected minutes — start_prob already embedded.
    lam_g = xg * (xmins / 90.0)
    lam_a = xa * (xmins / 90.0)
```

Replace with:

```python
    xg = xg_per90 if xg_per90 is not None else 0.0
    xa = xa_per90 if xa_per90 is not None else 0.0

    # ATF-01: symmetric multiplicative scale — best attack (norm=1) boosts xg/xa,
    # worst attack (norm=0) reduces them. No-op when atf_slope=0.0 or norm=0.5.
    atf_scale = 1.0 + (norm_attack_rate - 0.5) * atf_slope   # ATF-01
    xg = max(0.0, xg * atf_scale)
    xa = max(0.0, xa * atf_scale)

    # Poisson rates: scale per-90 rate to expected for this fixture's minutes.
    # xmins is unconditional expected minutes — start_prob already embedded.
    lam_g = xg * (xmins / 90.0)
    lam_a = xa * (xmins / 90.0)
```

### Step 4: Run tests to verify they pass

```
cd pipeline && python -m pytest tests/test_merge_xpts_components.py::test_atf_slope_zero_no_change tests/test_merge_xpts_components.py::test_atf_best_attack_increases_xpts tests/test_merge_xpts_components.py::test_atf_worst_attack_decreases_xpts -v
```

Expected: 3 PASSED

### Step 5: Add `atf_slope` to `_xpts_ngw` and extract `team_atf_form` per fixture

In `pipeline/merge.py`, find `_xpts_ngw` (line ~367). Add `atf_slope: float = 0.0,  # ATF-01` after `cs_team_form_slope: float = 0.0,  # CSF-01`:

```python
    cs_team_form_slope: float = 0.0,        # CSF-01
    atf_slope: float = 0.0,                 # ATF-01
) -> tuple:
```

Inside the per-fixture loop (the `for fix in gw_fixtures:` block), find line ~409:
```python
            norm_concede_rate = fix.get('team_def_form', 0.5)   # CSF-01
```

Add the ATF-01 extraction immediately after it:
```python
            norm_concede_rate = fix.get('team_def_form', 0.5)   # CSF-01
            norm_attack_rate = fix.get('team_atf_form', 0.5)    # ATF-01
```

In the `_compute_xpts_fixture(...)` call (lines ~410-428), add two new keyword args after the existing `cs_team_form_slope=cs_team_form_slope,  # CSF-01` line:

```python
                norm_concede_rate=norm_concede_rate,                                     # CSF-01
                cs_team_form_slope=cs_team_form_slope,                                   # CSF-01
                norm_attack_rate=norm_attack_rate,                                        # ATF-01
                atf_slope=atf_slope,                                                      # ATF-01
```

### Step 6: Add `atf_slope` to `_xpts_per_gw` and extract `team_atf_form` per fixture

Apply the identical change to `_xpts_per_gw` (line ~441). Add `atf_slope: float = 0.0,  # ATF-01` after `cs_team_form_slope: float = 0.0,  # CSF-01`. Inside the per-fixture loop (find `norm_concede_rate = fix.get('team_def_form', 0.5)   # CSF-01` at line ~479), add after it:

```python
            norm_concede_rate = fix.get('team_def_form', 0.5)   # CSF-01
            norm_attack_rate = fix.get('team_atf_form', 0.5)    # ATF-01
```

Add to the `_compute_xpts_fixture(...)` call (lines ~480-498):

```python
                norm_concede_rate=norm_concede_rate,                                     # CSF-01
                cs_team_form_slope=cs_team_form_slope,                                   # CSF-01
                norm_attack_rate=norm_attack_rate,                                        # ATF-01
                atf_slope=atf_slope,                                                      # ATF-01
```

### Step 7: Add `atf_slope` and `atf_window_gws` to `merge_players`, compute `norm_atf_form`, inject into fixture dicts

In `merge_players` (line ~852), add two new params after `cs_def_form_window_gws: int = 6,  # CSF-01`:

```python
    cs_def_form_window_gws: int = 6,        # CSF-01: rolling window for goals-conceded average
    atf_slope: float = 0.0,                 # ATF-01: weight for team attack form, tunable via TUNE-01
    atf_window_gws: int = 6,                # ATF-01: rolling window for goals-scored average
) -> tuple[list, dict]:
```

After the CSF-01 `norm_def_form` block (lines ~1005-1019, ending with `# ── CSF-01 block end`), add the ATF-01 block:

```python
    # ── ATF-01: own-team goals-scored form (normalised) ───────────────────── #
    team_xgs_atf: dict[int, float] = {}
    for t_id, scored_list in team_goals_scored.items():
        last_n = scored_list[-atf_window_gws:]
        team_xgs_atf[t_id] = sum(last_n) / len(last_n) if last_n else 0.0

    xgs_atf_values = list(team_xgs_atf.values())
    min_xgs_atf = min(xgs_atf_values) if xgs_atf_values else 0.0
    max_xgs_atf = max(xgs_atf_values) if xgs_atf_values else 1.0
    norm_atf_form: dict[int, float] = {}
    for t_id, xgs in team_xgs_atf.items():
        if max_xgs_atf - min_xgs_atf > 1e-6:
            norm_atf_form[t_id] = (xgs - min_xgs_atf) / (max_xgs_atf - min_xgs_atf)
        else:
            norm_atf_form[t_id] = 0.5  # all equal → neutral (cold-start guard)
    # ─────────────────────────────────────────────────────────────────────── #
```

In the fixture dict building loop (the `for fix in upcoming:` block, lines ~1069-1102), add `'team_atf_form'` alongside `'team_def_form'` in both the home and away dicts:

Home dict (after `'team_def_form': norm_def_form.get(h_id, 0.5),  # CSF-01`):
```python
                'team_def_form': norm_def_form.get(h_id, 0.5),                              # CSF-01
                'team_atf_form': norm_atf_form.get(h_id, 0.5),                              # ATF-01
```

Away dict (after `'team_def_form': norm_def_form.get(a_id, 0.5),  # CSF-01`):
```python
                'team_def_form': norm_def_form.get(a_id, 0.5),                              # CSF-01
                'team_atf_form': norm_atf_form.get(a_id, 0.5),                              # ATF-01
```

Now find every call to `_xpts_ngw` and `_xpts_per_gw` inside `merge_players` (there are 3 calls to `_xpts_ngw` for n_gws=1/3/5 and 1 call to `_xpts_per_gw`). Add `atf_slope=atf_slope,  # ATF-01` to each call, after `cs_team_form_slope=cs_team_form_slope,  # CSF-01`.

### Step 8: Run full test suite

```
cd pipeline && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all existing tests pass (490+) plus the 3 new ATF-01 tests = 493 passing, 0 failed.

### Step 9: Commit

```
git add pipeline/merge.py pipeline/tests/test_merge_xpts_components.py
git commit -m "feat(atf-01): thread norm_attack_rate + atf_slope through merge.py xPts chain"
```

---

## Task 2: `accuracy.py` — add constants + `build_team_atf_lookup`

**Files:**
- Modify: `pipeline/accuracy.py`
- Test: `pipeline/tests/test_accuracy.py`

### Background

`build_team_atf_lookup` is structurally identical to `build_team_def_form_lookup` — same strict-prior algorithm, same min-max normalisation, same cold-start guards — but reads goals **scored** instead of goals conceded. Home team scored = `team_h_score`; away team scored = `team_a_score`. This is the opposite mapping from CSF-01 (home team conceded = `team_a_score`).

### Step 1: Write the failing tests

Find the CSF-01 tests in `pipeline/tests/test_accuracy.py`. They use a `_finished_fix` helper. Reuse that helper (it should already be defined; if not, add it). Add these four tests immediately after the CSF-01 tests:

```python
# ── ATF-01: build_team_atf_lookup ────────────────────────────────────────── #

def test_build_team_atf_lookup_basic():
    """Team with more goals scored → higher norm_attack_rate than team with fewer."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        _finished_fix(1, h_id=1, a_id=2, h_score=3, a_score=0),
        {'event': 2, 'team_h': 1, 'team_a': 2,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures)
    rate_1 = lookup.get((2, 1), 0.5)
    rate_2 = lookup.get((2, 2), 0.5)
    assert rate_1 > rate_2


def test_build_team_atf_lookup_cold_start():
    """No prior finished fixtures → returns 0.5 for all teams."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        {'event': 1, 'team_h': 1, 'team_a': 2,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures)
    assert lookup.get((1, 1), 0.5) == 0.5
    assert lookup.get((1, 2), 0.5) == 0.5


def test_build_team_atf_lookup_sparse():
    """Only 2 prior games with window=6 → denominator = 2 (actual entries, sparse-safe)."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        _finished_fix(1, h_id=3, a_id=4, h_score=2, a_score=0),
        _finished_fix(2, h_id=3, a_id=4, h_score=2, a_score=0),
        {'event': 3, 'team_h': 3, 'team_a': 4,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures, window_gws=6)
    rate_3 = lookup.get((3, 3), 0.5)
    # team 3 scores 2+2=4 over 2 games → avg 2.0 (denominator=2, not 6)
    # team 4 scores 0+0=0 → avg 0.0; normalised: team 3 = 1.0 > 0.5
    assert rate_3 > 0.5


def test_build_team_atf_lookup_all_equal():
    """All teams identical scoring rate → returns 0.5 for all (division guard)."""
    from accuracy import build_team_atf_lookup
    fixtures = [
        _finished_fix(1, h_id=1, a_id=2, h_score=1, a_score=1),
        {'event': 2, 'team_h': 1, 'team_a': 2,
         'team_h_score': None, 'team_a_score': None, 'finished': False},
    ]
    lookup = build_team_atf_lookup(fixtures)
    assert lookup.get((2, 1), 0.5) == 0.5
    assert lookup.get((2, 2), 0.5) == 0.5
```

**Note:** `_finished_fix` helper (already present in test_accuracy.py from CSF-01). If absent, add this near the top of the test file:

```python
def _finished_fix(event, h_id, a_id, h_score, a_score):
    return {
        'event': event, 'team_h': h_id, 'team_a': a_id,
        'team_h_score': h_score, 'team_a_score': a_score,
        'finished': True,
    }
```

### Step 2: Run tests to verify they fail

```
cd pipeline && python -m pytest tests/test_accuracy.py::test_build_team_atf_lookup_basic tests/test_accuracy.py::test_build_team_atf_lookup_cold_start tests/test_accuracy.py::test_build_team_atf_lookup_sparse tests/test_accuracy.py::test_build_team_atf_lookup_all_equal -v
```

Expected: 4 FAILED (ImportError: cannot import `build_team_atf_lookup`)

### Step 3: Add constants to `accuracy.py`

In `pipeline/accuracy.py`, after line 44 (`CS_DEF_FORM_WINDOW_GWS = 6  # CSF-01`), add:

```python
ATF_SLOPE      = 0.0  # ATF-01: default no-op; tunable via TUNE-01
ATF_WINDOW_GWS = 6    # ATF-01: rolling window for team goals-scored
```

### Step 4: Add `build_team_atf_lookup` to `accuracy.py`

Add this function immediately after `build_team_def_form_lookup` (after line ~135):

```python
def build_team_atf_lookup(fixtures: list, window_gws: int = ATF_WINDOW_GWS) -> dict:
    """(gw, team_id) → norm_attack_rate for each GW a team plays.

    For each (gw, team_id) pair: collects the last window_gws finished fixtures
    for that team STRICTLY BEFORE gw (no leakage), computes mean goals scored.
    Denominator = actual entries seen (sparse-safe, matches xmins.py convention).
    Min-max normalises across all teams for that GW.
    Returns 0.5 for teams with no prior fixtures (neutral/unknown).
    Returns 0.5 for all teams if all have identical scoring rates (cold-start guard).
    """
    # Collect finished fixtures, sorted by GW
    finished = sorted(
        [f for f in fixtures if f.get('finished') and f.get('event') is not None
         and f.get('team_h_score') is not None and f.get('team_a_score') is not None],
        key=lambda f: f['event'],
    )

    # Per team: list of (gw, goals_scored) in chronological order
    # Note: home team scored = h_score; away team scored = a_score (opposite of CSF-01)
    team_history: dict[int, list[tuple[int, int]]] = {}
    for fix in finished:
        gw    = fix['event']
        h_id  = fix['team_h']
        a_id  = fix['team_a']
        h_score = fix.get('team_h_score') or 0
        a_score = fix.get('team_a_score') or 0
        team_history.setdefault(h_id, []).append((gw, h_score))  # home team scored h_score
        team_history.setdefault(a_id, []).append((gw, a_score))  # away team scored a_score

    # Identify every (gw, team_id) pair we need to compute
    gw_team_pairs: list[tuple[int, int]] = []
    for fix in fixtures:
        gw = fix.get('event')
        if gw is None:
            continue
        gw_team_pairs.append((gw, fix['team_h']))
        gw_team_pairs.append((gw, fix['team_a']))
    gw_team_pairs = list(set(gw_team_pairs))

    # Group by GW so we can normalise per-GW
    raw_by_gw: dict[int, dict[int, float]] = defaultdict(dict)

    for gw, team_id in gw_team_pairs:
        history = team_history.get(team_id, [])
        # Strictly prior games only (no leakage)
        prior = [(g, gs) for g, gs in history if g < gw]
        last_n = prior[-window_gws:]
        if not last_n:
            raw_by_gw[gw][team_id] = None  # type: ignore[assignment]  # sentinel for cold start
        else:
            raw_by_gw[gw][team_id] = sum(gs for _, gs in last_n) / len(last_n)

    # Min-max normalise per GW; default 0.5 for cold-start and all-equal
    lookup: dict = {}
    for gw, team_rates in raw_by_gw.items():
        known = {t_id: rate for t_id, rate in team_rates.items() if rate is not None}
        if not known:
            for t_id in team_rates:
                lookup[(gw, t_id)] = 0.5
            continue
        min_xgs = min(known.values())
        max_xgs = max(known.values())
        denom = max_xgs - min_xgs
        for t_id, rate in team_rates.items():
            if rate is None:
                lookup[(gw, t_id)] = 0.5
            elif denom > 1e-6:
                lookup[(gw, t_id)] = (rate - min_xgs) / denom
            else:
                lookup[(gw, t_id)] = 0.5  # all equal → neutral
    return lookup
```

### Step 5: Run tests to verify they pass

```
cd pipeline && python -m pytest tests/test_accuracy.py::test_build_team_atf_lookup_basic tests/test_accuracy.py::test_build_team_atf_lookup_cold_start tests/test_accuracy.py::test_build_team_atf_lookup_sparse tests/test_accuracy.py::test_build_team_atf_lookup_all_equal -v
```

Expected: 4 PASSED

### Step 6: Run full test suite

```
cd pipeline && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: 497 passing (493 from Task 1 + 4 new), 0 failed.

### Step 7: Commit

```
git add pipeline/accuracy.py pipeline/tests/test_accuracy.py
git commit -m "feat(atf-01): add ATF_SLOPE/ATF_WINDOW_GWS constants + build_team_atf_lookup"
```

---

## Task 3: `accuracy.py` — thread `norm_attack_rate` / `atf_slope` through backtest path

**Files:**
- Modify: `pipeline/accuracy.py`

### Background

Three functions form the backtest reconstruction chain: `_reconstruct_xpts` → `_reconstruct_xpts_with_form` → both called from `build_per_gw_rows`. `compute_accuracy_backtest` builds the lookup once and passes it to `build_per_gw_rows`. No new tests are needed — the existing integration tests cover correctness through the chain.

### Step 1: Add params to `_reconstruct_xpts`

Find `_reconstruct_xpts` at line ~956. Add two params after `cs_team_form_slope: float = 0.0,  # CSF-01`:

```python
def _reconstruct_xpts(entry: dict, element_type: int, difficulty_score: float,
                       cs_prob_base: float = CS_PROB_BASE, cs_prob_slope: float = CS_PROB_SLOPE,
                       mins_60_prob: float | None = None,   # APM-01
                       sub_appear_prob: float = 0.0,        # APM-01
                       norm_concede_rate: float = 0.5,      # CSF-01
                       cs_team_form_slope: float = 0.0,     # CSF-01
                       norm_attack_rate: float = 0.5,       # ATF-01
                       atf_slope: float = 0.0,              # ATF-01
                       ) -> float:
```

In the `_compute_xpts_fixture(...)` call inside `_reconstruct_xpts` (lines ~989-1002), add after `cs_team_form_slope=cs_team_form_slope,  # CSF-01`:

```python
        norm_concede_rate=norm_concede_rate,    # CSF-01
        cs_team_form_slope=cs_team_form_slope,  # CSF-01
        norm_attack_rate=norm_attack_rate,       # ATF-01
        atf_slope=atf_slope,                     # ATF-01
```

### Step 2: Add params to `_reconstruct_xpts_with_form`

Find `_reconstruct_xpts_with_form` at line ~1066. Add the same two params after `cs_team_form_slope: float = 0.0,  # CSF-01`:

```python
def _reconstruct_xpts_with_form(
    entry: dict,
    element_type: int,
    difficulty_score: float,
    form_per90: 'float | None',
    blend_alpha: float = BLEND_ALPHA,
    cs_prob_base: float = CS_PROB_BASE,
    cs_prob_slope: float = CS_PROB_SLOPE,
    mins_60_prob: float | None = None,   # APM-01
    sub_appear_prob: float = 0.0,        # APM-01
    norm_concede_rate: float = 0.5,      # CSF-01
    cs_team_form_slope: float = 0.0,     # CSF-01
    norm_attack_rate: float = 0.5,       # ATF-01
    atf_slope: float = 0.0,              # ATF-01
) -> float:
```

In the `form_per90 is None` fallback call to `_reconstruct_xpts` (lines ~1090-1095), add after `cs_team_form_slope=cs_team_form_slope`:

```python
        return _reconstruct_xpts(entry, element_type, difficulty_score,
                                  cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
                                  mins_60_prob=mins_60_prob,
                                  sub_appear_prob=sub_appear_prob,
                                  norm_concede_rate=norm_concede_rate,
                                  cs_team_form_slope=cs_team_form_slope,
                                  norm_attack_rate=norm_attack_rate,    # ATF-01
                                  atf_slope=atf_slope)                  # ATF-01
```

In the `_compute_xpts_fixture(...)` call (lines ~1122-1135), add after `cs_team_form_slope=cs_team_form_slope,  # CSF-01`:

```python
        norm_concede_rate=norm_concede_rate,    # CSF-01
        cs_team_form_slope=cs_team_form_slope,  # CSF-01
        norm_attack_rate=norm_attack_rate,       # ATF-01
        atf_slope=atf_slope,                     # ATF-01
```

### Step 3: Add params to `build_per_gw_rows`

Find `build_per_gw_rows` at line ~203. Add two params after `cs_team_form_slope: float = CS_TEAM_FORM_SLOPE,  # CSF-01`:

```python
    team_def_form_lookup: dict = {},                          # CSF-01
    cs_team_form_slope: float = CS_TEAM_FORM_SLOPE,          # CSF-01
    team_atf_lookup: dict = {},                               # ATF-01: pre-built per (gw, team_id)
    atf_slope: float = ATF_SLOPE,                             # ATF-01
) -> dict:
```

Also update the docstring to include the two new params (after the CSF-01 lines):

```
        team_atf_lookup:       (gw, team_id) -> norm_attack_rate pre-built lookup (ATF-01).
        atf_slope:             team attack form slope coefficient (ATF-01).
```

Inside the per-player, per-GW loop, after line ~271 (`norm_concede_rate_at_gw = team_def_form_lookup.get((gw, player_team_id), 0.5)  # CSF-01`), add:

```python
            norm_concede_rate_at_gw = team_def_form_lookup.get((gw, player_team_id), 0.5)  # CSF-01
            norm_attack_rate_at_gw = team_atf_lookup.get((gw, player_team_id), 0.5)        # ATF-01
```

In the `_reconstruct_xpts(...)` call (lines ~289-296), add after `cs_team_form_slope=cs_team_form_slope,  # CSF-01`:

```python
            xpts_predicted = _reconstruct_xpts(
                entry, element_type, difficulty_score,
                cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
                mins_60_prob=mins_60_prob_at_gw,
                sub_appear_prob=sub_appear_prob_at_gw,
                norm_concede_rate=norm_concede_rate_at_gw,
                cs_team_form_slope=cs_team_form_slope,
                norm_attack_rate=norm_attack_rate_at_gw,    # ATF-01
                atf_slope=atf_slope,                         # ATF-01
            )
```

In the `_reconstruct_xpts_with_form(...)` call (lines ~302-311), add the same two args after `cs_team_form_slope=cs_team_form_slope,  # CSF-01`:

```python
            xpts_blended_predicted = _reconstruct_xpts_with_form(
                entry, element_type, difficulty_score, form_per90_at_gw,
                blend_alpha=blend_alpha,
                cs_prob_base=cs_prob_base,
                cs_prob_slope=cs_prob_slope,
                mins_60_prob=mins_60_prob_at_gw,
                sub_appear_prob=sub_appear_prob_at_gw,
                norm_concede_rate=norm_concede_rate_at_gw,
                cs_team_form_slope=cs_team_form_slope,
                norm_attack_rate=norm_attack_rate_at_gw,    # ATF-01
                atf_slope=atf_slope,                         # ATF-01
            )
```

### Step 4: Update `compute_accuracy_backtest` to build and pass `team_atf_lookup`

Find the CSF-01 line in `compute_accuracy_backtest` (line ~458):
```python
    team_def_form_lookup = build_team_def_form_lookup(fixtures, CS_DEF_FORM_WINDOW_GWS)  # CSF-01
```

Add immediately after it:
```python
    team_atf_lookup = build_team_atf_lookup(fixtures, ATF_WINDOW_GWS)  # ATF-01
```

In the `build_per_gw_rows(...)` call (lines ~461-472), add after `team_def_form_lookup=team_def_form_lookup,  # CSF-01`:

```python
        team_def_form_lookup=team_def_form_lookup,  # CSF-01
        team_atf_lookup=team_atf_lookup,             # ATF-01
```

(Note: `atf_slope` is NOT passed to `compute_accuracy_backtest`'s `build_per_gw_rows` call — it uses the constant default `ATF_SLOPE`. This matches the CSF-01 pattern where `cs_team_form_slope` is also not passed. The tuner's sweep evaluations use the per-candidate slope via `_sweep_param`.)

### Step 5: Run full test suite

```
cd pipeline && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: 497 passing, 0 failed.

### Step 6: Commit

```
git add pipeline/accuracy.py
git commit -m "feat(atf-01): thread norm_attack_rate/atf_slope through accuracy.py backtest path"
```

---

## Task 4: `tune.py` — add `atf_slope` and `atf_window_gws` to coordinate descent

**Files:**
- Modify: `pipeline/tune.py`
- Test: `pipeline/tests/test_tune.py`

### Background

The tuner runs coordinate descent over all parameters in sequence. ATF-01 adds parameters 10 and 11. `_sweep_param` already receives `fixtures` (added for CSF-01) and rebuilds `team_def_form_lookup` per-candidate window. ATF-01 extends this with `build_team_atf_lookup` rebuilt per-candidate `atf_window_gws`. Both `build_per_gw_rows` calls in `_sweep_param` gain the new lookup and slope.

### Step 1: Write the failing tests

Find the CSF-01 default-read tests in `pipeline/tests/test_tune.py` (e.g. `test_cs_team_form_slope_default_in_read_prior_params`). Add immediately after them:

```python
def test_atf_slope_default_in_read_prior_params():
    """Missing key in summary → returns ATF_SLOPE default."""
    from tune import _read_prior_params
    from accuracy import ATF_SLOPE
    result = _read_prior_params(cache_dir='nonexistent_dir_xyz')
    assert result['atf_slope'] == ATF_SLOPE


def test_atf_window_default_in_read_prior_params():
    """Missing key in summary → returns ATF_WINDOW_GWS default."""
    from tune import _read_prior_params
    from accuracy import ATF_WINDOW_GWS
    result = _read_prior_params(cache_dir='nonexistent_dir_xyz')
    assert result['atf_window_gws'] == ATF_WINDOW_GWS
```

### Step 2: Run tests to verify they fail

```
cd pipeline && python -m pytest tests/test_tune.py::test_atf_slope_default_in_read_prior_params tests/test_tune.py::test_atf_window_default_in_read_prior_params -v
```

Expected: 2 FAILED (KeyError: 'atf_slope')

### Step 3: Add imports and candidate lists to `tune.py`

In `pipeline/tune.py`, update the `from accuracy import (...)` block to add:

```python
from accuracy import (
    build_fixture_difficulty_lookup,
    build_per_gw_rows,
    compute_metrics_for_gws,
    GATE_MARGIN_PP,
    BLEND_ALPHA,
    FORM_WINDOW_GWS,
    CS_PROB_BASE,
    CS_PROB_SLOPE,
    FORM_ACTUAL_BETA,
    FORM_DIFFICULTY_GAMMA,
    SUB_APPEAR_WINDOW_GWS,
    CS_TEAM_FORM_SLOPE,
    CS_DEF_FORM_WINDOW_GWS,
    build_team_def_form_lookup,
    ATF_SLOPE,           # ATF-01
    ATF_WINDOW_GWS,      # ATF-01
    build_team_atf_lookup,  # ATF-01
)
```

After `CS_DEF_FORM_WINDOW_CANDIDATES = [3, 5, 6, 8, 10]  # CSF-01`, add:

```python
ATF_SLOPE_CANDIDATES   = [0.0, 0.10, 0.20, 0.30, 0.40]  # ATF-01
ATF_WINDOW_CANDIDATES  = [3, 5, 6, 8, 10]                # ATF-01
```

### Step 4: Update `_read_prior_params` both branches

In the `try` branch of `_read_prior_params`, after `'cs_def_form_window_gws': int(summary.get('cs_def_form_window_gws_used', CS_DEF_FORM_WINDOW_GWS)),  # CSF-01`, add:

```python
            'atf_slope':      float(summary.get('atf_slope_used',      ATF_SLOPE)),      # ATF-01
            'atf_window_gws': int(summary.get('atf_window_gws_used',   ATF_WINDOW_GWS)), # ATF-01
```

In the `except` branch, after `'cs_def_form_window_gws': CS_DEF_FORM_WINDOW_GWS,  # CSF-01`, add:

```python
            'atf_slope':      ATF_SLOPE,      # ATF-01
            'atf_window_gws': ATF_WINDOW_GWS, # ATF-01
```

### Step 5: Update `params` dict and `sweep_order` in `run_tuner`

In `run_tuner`, in the `params = { ... }` dict, after `'cs_def_form_window_gws': prior['cs_def_form_window_gws'],  # CSF-01`, add:

```python
        'atf_slope':      prior['atf_slope'],      # ATF-01
        'atf_window_gws': prior['atf_window_gws'], # ATF-01
```

In `sweep_order`, after the `('cs_def_form_window_gws', ...)` entry, add:

```python
        ('atf_slope',      ATF_SLOPE_CANDIDATES,  prior['atf_slope']),      # ATF-01
        ('atf_window_gws', ATF_WINDOW_CANDIDATES, prior['atf_window_gws']), # ATF-01
```

### Step 6: Update both `build_per_gw_rows` calls in `_sweep_param`

In `_sweep_param`, find the baseline `build_per_gw_rows` call. After the existing CSF-01 `team_def_form_lookup` rebuild and pass, add the ATF-01 rebuild and pass.

**Baseline section** (after `baseline_team_def_form = build_team_def_form_lookup(fixtures, params['cs_def_form_window_gws'])  # CSF-01`):

```python
    baseline_team_def_form = build_team_def_form_lookup(
        fixtures, params['cs_def_form_window_gws']
    )  # CSF-01
    baseline_team_atf = build_team_atf_lookup(
        fixtures, params['atf_window_gws']
    )  # ATF-01
    baseline_rows = build_per_gw_rows(
        ...
        team_def_form_lookup=baseline_team_def_form,             # CSF-01
        cs_team_form_slope=params['cs_team_form_slope'],         # CSF-01
        team_atf_lookup=baseline_team_atf,                       # ATF-01
        atf_slope=params['atf_slope'],                           # ATF-01
    )
```

**Candidate section** (after `candidate_team_def_form = build_team_def_form_lookup(fixtures, candidate_params['cs_def_form_window_gws'])  # CSF-01`):

```python
    candidate_team_def_form = build_team_def_form_lookup(
        fixtures, candidate_params['cs_def_form_window_gws']
    )  # CSF-01
    candidate_team_atf = build_team_atf_lookup(
        fixtures, candidate_params['atf_window_gws']
    )  # ATF-01
    candidate_rows = build_per_gw_rows(
        ...
        team_def_form_lookup=candidate_team_def_form,                      # CSF-01
        cs_team_form_slope=candidate_params['cs_team_form_slope'],         # CSF-01
        team_atf_lookup=candidate_team_atf,                                # ATF-01
        atf_slope=candidate_params['atf_slope'],                           # ATF-01
    )
```

### Step 7: Update the 4 existing tune tests

**`test_run_tuner_sweep_covers_all_parameters`**: add `'atf_slope'` and `'atf_window_gws'` to the set of expected sweep keys.

**`test_run_tuner_promoted_params_contains_all_params`**: add `'atf_slope'` and `'atf_window_gws'` to the assertion.

**`test_coordinate_locking_uses_prior_sweep_value`**: update docstring from "nine sweeps" to "eleven sweeps"; add assertions:
```python
assert result['promoted_params']['atf_slope'] == 0.0
assert result['promoted_params']['atf_window_gws'] == 6
```

**All `TestSweepParam` `params` dicts**: add `'atf_slope': 0.0, 'atf_window_gws': 6` to every params dict used in `_sweep_param` test calls.

### Step 8: Run full test suite

```
cd pipeline && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: 499 passing (497 from Task 3 + 2 new ATF-01 default tests), 0 failed.

### Step 9: Commit

```
git add pipeline/tune.py pipeline/tests/test_tune.py
git commit -m "feat(atf-01): add atf_slope + atf_window_gws to TUNE-01 coordinate descent"
```

---

## Task 5: `run.py` — read / init / pass / write both new params

**Files:**
- Modify: `pipeline/run.py`
- Test: `pipeline/tests/test_run.py`

### Background

Identical pattern to all previous tunable parameters. Init defaults before `try`, read from `prev_backtest` inside `try`, pass to `merge_players`, write to `backtest_data['summary']` after tuner, extend both print lines.

### Step 1: Write the failing tests

In `pipeline/tests/test_run.py`, find the `_read_tuner_params` helper function. It initialises defaults and reads from a mock `prev_backtest` dict. Add the two ATF-01 entries to match the CSF-01 entries:

In the defaults section (before `try:`):
```python
    atf_slope_used      = accuracy.ATF_SLOPE       # ATF-01: default
    atf_window_gws_used = accuracy.ATF_WINDOW_GWS  # ATF-01: default
```

In the `try:` block (reading from `prev_backtest`):
```python
    atf_slope_used      = float(prev_backtest.get('summary', {}).get(
        'atf_slope_used', accuracy.ATF_SLOPE))
    atf_window_gws_used = int(prev_backtest.get('summary', {}).get(
        'atf_window_gws_used', accuracy.ATF_WINDOW_GWS))
```

Return both new keys:
```python
    return {
        ...
        'atf_slope_used':      atf_slope_used,
        'atf_window_gws_used': atf_window_gws_used,
    }
```

**`test_read_tuner_params_defaults_on_missing_file`**: add assertions:
```python
    assert result['atf_slope_used'] == accuracy.ATF_SLOPE
    assert result['atf_window_gws_used'] == accuracy.ATF_WINDOW_GWS
```

**`test_read_tuner_params_reads_promoted_values`**: add to the fixture `summary` dict:
```python
    'atf_slope_used':      0.2,
    'atf_window_gws_used': 5,
```
Add assertions:
```python
    assert result['atf_slope_used'] == 0.2
    assert result['atf_window_gws_used'] == 5
```

### Step 2: Run tests to verify they fail

```
cd pipeline && python -m pytest tests/test_run.py::test_read_tuner_params_defaults_on_missing_file tests/test_run.py::test_read_tuner_params_reads_promoted_values -v
```

Expected: 2 FAILED (KeyError: 'atf_slope_used')

### Step 3: Update `run.py` — init defaults

In `pipeline/run.py`, after `cs_def_form_window_gws_used = accuracy.CS_DEF_FORM_WINDOW_GWS  # CSF-01: default` (line ~346), add:

```python
            atf_slope_used      = accuracy.ATF_SLOPE       # ATF-01: default
            atf_window_gws_used = accuracy.ATF_WINDOW_GWS  # ATF-01: default
```

### Step 4: Update `run.py` — read from `prev_backtest`

After the CSF-01 read lines (lines ~361-364), add:

```python
                atf_slope_used      = float(prev_backtest.get('summary', {}).get(
                    'atf_slope_used', accuracy.ATF_SLOPE))         # ATF-01
                atf_window_gws_used = int(prev_backtest.get('summary', {}).get(
                    'atf_window_gws_used', accuracy.ATF_WINDOW_GWS))  # ATF-01
```

### Step 5: Update `run.py` — extend the startup print line

Find the print line at ~373:
```python
            print(f"TUNE-01 params: form_window={form_window_gws_used}, cs_prob_base={cs_prob_base_used}, cs_prob_slope={cs_prob_slope_used}, form_actual_beta={form_actual_beta_used}, form_difficulty_gamma={form_difficulty_gamma_used}, sub_appear_window_gws={sub_appear_window_gws_used}, cs_team_form_slope={cs_team_form_slope_used}, cs_def_form_window_gws={cs_def_form_window_gws_used}")
```

Extend it by appending `, atf_slope={atf_slope_used}, atf_window_gws={atf_window_gws_used}` to the f-string.

### Step 6: Update `run.py` — pass to `merge_players`

Find the `merge_players(...)` call (lines ~395-412). After `cs_def_form_window_gws=cs_def_form_window_gws_used,  # CSF-01`, add:

```python
                cs_def_form_window_gws=cs_def_form_window_gws_used, # CSF-01
                atf_slope=atf_slope_used,                            # ATF-01
                atf_window_gws=atf_window_gws_used,                  # ATF-01
```

### Step 7: Update `run.py` — write to `backtest_data['summary']` after tuner

Find the tuner promotion block (lines ~524-542). After `backtest_data['summary']['cs_def_form_window_gws_used'] = pp['cs_def_form_window_gws']  # CSF-01`, add:

```python
                    backtest_data['summary']['atf_slope_used']      = pp['atf_slope']      # ATF-01
                    backtest_data['summary']['atf_window_gws_used'] = pp['atf_window_gws'] # ATF-01
```

### Step 8: Extend the `[tune]` print line

Find the `print(f"[tune] params: ...")` line (~534-542). Append `, atf_slope={pp['atf_slope']}, atf_window_gws={pp['atf_window_gws']}` before the closing `"`.

### Step 9: Run full test suite

```
cd pipeline && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: 499 passing (all previous + 2 contract tests still passing), 0 failed.

### Step 10: Commit

```
git add pipeline/run.py pipeline/tests/test_run.py
git commit -m "feat(atf-01): read/pass/write atf_slope + atf_window_gws in run.py"
```
