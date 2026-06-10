# FAS-01 + DC-01: Model Upgrades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the two backtest-validated model upgrades (fixture attack scaling, DefCon expected points) plus honest-tuned defaults into the live pipeline, as TUNE-01 parameters 12 and 13.

**Architecture:** Identical promotion pattern to ATF-01. The ATF-01 commit series `3f4ee26, 85e531c, 0e00334, def0046, 34eb59a` is the canonical mechanical template — when this plan says "thread X exactly like atf_slope", run `git show <sha>` and replicate the diff shape for the new parameter names.

**Tech Stack:** Python 3.11, pytest.

---

## Formulas (from the approved spec)

```
fas_scale = max(0.0, 1.0 + (0.5 - attack_difficulty) * fas_slope)   # FAS-01
xg = xg * fas_scale        # after ATF-01 scale, before Poisson rates
xa = xa * fas_scale

defcon_pts = 2.0 * defcon_rate * defcon_scale * min(1.0, xmins / 90.0)   # DC-01
total += defcon_pts        # and components dict gains 'defcon'
```

`attack_difficulty` ∈ [0,1] (0 = easiest opponent). Live fixture dicts already carry it as `'attacking_difficulty'`. `defcon_rate` = prior P(defensive_contribution ≥ threshold | minutes ≥ 60); thresholds `{2: 10, 3: 12, 4: 12}` (GKP → rate 0.0). Defaults: `fas_slope = FAS_SLOPE = 0.4`, `defcon_scale = DEFCON_SCALE = 0.0`.

## File map

| File | Change |
|---|---|
| `pipeline/merge.py` | leaf params + FAS/DC formulas; wiring through `_xpts_ngw`/`_xpts_per_gw`/`merge_players`; per-player `defcon_rate` from summaries; `BLEND_ALPHA` 0.4→0.2 + `FORM_WINDOW` default 5→4 if defined here (check — accuracy.py:35 says "matches merge.BLEND_ALPHA") |
| `pipeline/accuracy.py` | `FAS_SLOPE=0.4`, `DEFCON_SCALE=0.0`, `BLEND_ALPHA` 0.4→0.2, `FORM_WINDOW_GWS` 5→4; `build_defcon_rate_lookup`; thread through backtest path |
| `pipeline/tune.py` | params 12 + 13 |
| `pipeline/run.py` | read/init/pass/write both |
| tests | see per task |

Working directory for all commands: `pipeline/`

---

## Task 1: merge.py leaf — FAS + DC in `_compute_xpts_fixture`

**Files:** Modify `pipeline/merge.py`; Test `pipeline/tests/test_merge_xpts_components.py`

### Step 1: Failing tests (add at end of test_merge_xpts_components.py)

```python
# ── FAS-01 + DC-01: fixture attack scaling & DefCon EV ───────────────────── #

def _fx(**over):
    base = dict(xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
                element_type=4, defensive_difficulty=0.3)
    base.update(over)
    from merge import _compute_xpts_fixture
    return _compute_xpts_fixture(**base)


def test_fas_slope_zero_no_change():
    assert abs(_fx(attack_difficulty=0.9, fas_slope=0.0)['total']
               - _fx()['total']) < 1e-9


def test_fas_easy_opponent_increases_xpts():
    assert (_fx(attack_difficulty=0.0, fas_slope=0.4)['total']
            > _fx(fas_slope=0.0)['total'])


def test_fas_hard_opponent_decreases_xpts():
    assert (_fx(attack_difficulty=1.0, fas_slope=0.4)['total']
            < _fx(fas_slope=0.0)['total'])


def test_defcon_scale_zero_no_change():
    assert abs(_fx(defcon_rate=0.8, defcon_scale=0.0)['total']
               - _fx()['total']) < 1e-9


def test_defcon_adds_exact_ev():
    base = _fx()
    with_dc = _fx(defcon_rate=0.5, defcon_scale=1.0)  # xmins=90 -> factor 1.0
    assert with_dc['total'] - base['total'] == pytest.approx(1.0)  # 2*0.5*1.0*1.0
    assert with_dc['defcon'] == pytest.approx(1.0)
    assert base['defcon'] == 0.0


def test_defcon_scaled_by_xmins():
    with_dc = _fx(defcon_rate=0.5, defcon_scale=1.0, xmins=45.0)
    base = _fx(xmins=45.0)
    assert with_dc['total'] - base['total'] == pytest.approx(0.5)  # 2*0.5*1*0.5
```

(Ensure `import pytest` exists at the top of the test file; add if missing.)

### Step 2: Verify FAIL (TypeError: unexpected keyword argument)

`cd pipeline && python -m pytest tests/test_merge_xpts_components.py -k "fas or defcon" -v`

### Step 3: Implement in `_compute_xpts_fixture`

Add params after `atf_slope: float = 0.0,` (keep ordering — new params LAST):

```python
    attack_difficulty: float = 0.5,   # FAS-01: opponent strength (0=easiest, 1=hardest)
    fas_slope: float = 0.0,           # FAS-01: weight for fixture attack scaling
    defcon_rate: float = 0.0,         # DC-01: prior P(DC threshold | 60+ mins)
    defcon_scale: float = 0.0,        # DC-01: weight for DefCon EV
```

Immediately after the ATF-01 block (`xa = max(0.0, xa * atf_scale)`):

```python
    # FAS-01: opponent-difficulty scaling of attacking EV — symmetric around
    # the average opponent. Easy fixture boosts xg/xa, hard fixture penalises.
    fas_scale = max(0.0, 1.0 + (0.5 - attack_difficulty) * fas_slope)   # FAS-01
    xg = xg * fas_scale
    xa = xa * fas_scale
```

Find where the components are summed into `total` (line ~363: `total = goal_pts + assist_pts + cs_pts + bonus_pts + appearance_pts + save_pts`). Before it add:

```python
    # DC-01: DefCon expected points — 2 pts at the per-position threshold,
    # scaled by prior threshold rate and expected minutes share.
    defcon_pts = 2.0 * defcon_rate * defcon_scale * min(1.0, xmins / 90.0)   # DC-01
```

Change the sum to include `+ defcon_pts` and add `'defcon': round(defcon_pts, 3),` to the returned components dict (match the existing dict's rounding style; check how 'goal'/'assist' keys are rounded and mirror it).

### Step 4: Verify the 6 tests PASS, then full suite

`cd pipeline && python -m pytest tests/ -q 2>&1 | tail -3` → expect 525 + 6 = 531 passed.
(If any OTHER test fails because it asserts the exact components-dict key set, update that test to include 'defcon' — report it.)

### Step 5: Commit

`git add pipeline/merge.py pipeline/tests/test_merge_xpts_components.py && git commit -m "feat(fas-01,dc-01): attack scaling + DefCon EV in _compute_xpts_fixture"`

---

## Task 2: merge.py wiring — `_xpts_ngw`, `_xpts_per_gw`, `merge_players`

**Files:** Modify `pipeline/merge.py`; Test `pipeline/tests/test_merge.py` (one integration test)

Follow the ATF-01 wiring pattern (`git show 3f4ee26`) exactly, with these specifics:

1. **`_xpts_ngw` and `_xpts_per_gw`** each gain THREE params after `atf_slope: float = 0.0,  # ATF-01`:
   ```python
       fas_slope: float = 0.0,                 # FAS-01
       defcon_rate: float = 0.0,               # DC-01 (player-level, not per-fixture)
       defcon_scale: float = 0.0,              # DC-01
   ```
   In each per-fixture loop, after `norm_attack_rate = fix.get('team_atf_form', 0.5)    # ATF-01`:
   ```python
       attack_difficulty = fix.get('attacking_difficulty', 0.5)   # FAS-01
   ```
   And pass all four to `_compute_xpts_fixture` after the ATF-01 kwargs:
   ```python
       attack_difficulty=attack_difficulty,   # FAS-01
       fas_slope=fas_slope,                   # FAS-01
       defcon_rate=defcon_rate,               # DC-01
       defcon_scale=defcon_scale,             # DC-01
   ```

2. **`merge_players`** gains after `atf_window_gws: int = 6,  # ATF-01`:
   ```python
       fas_slope: float = 0.4,                 # FAS-01: default per honest backtest
       defcon_scale: float = 0.0,              # DC-01: tuner-controlled
   ```
   NOTE the 0.4 default for fas_slope (matches accuracy.FAS_SLOPE added in Task 3).

3. **Per-player `defcon_rate`** — inside the main per-player loop of `merge_players`, where the player's `summary`/history is available (find where form signal reads `summaries`; the player's element-summary history is accessible there). Add a module-level helper near the top of merge.py (after the existing constants):
   ```python
   DEFCON_THRESHOLD = {2: 10, 3: 12, 4: 12}   # DC-01 (mirrors defcon.py)


   def _defcon_rate(history: list, element_type: int) -> float:
       """DC-01: P(defensive_contribution >= positional threshold | minutes >= 60).

       Denominator = prior 60+ minute games. GKP (and unknown types) -> 0.0.
       """
       threshold = DEFCON_THRESHOLD.get(element_type)
       if threshold is None:
           return 0.0
       played = [e for e in history
                 if (e.get('minutes', 0) or 0) >= 60]
       if not played:
           return 0.0
       hits = sum(1 for e in played
                  if (e.get('defensive_contribution', 0) or 0) >= threshold)
       return hits / len(played)
   ```
   In the per-player loop compute `defcon_rate = _defcon_rate(history, element_type)` from the same history list the form signal uses (if the player has no summary, 0.0). Pass `defcon_rate=defcon_rate, defcon_scale=defcon_scale, fas_slope=fas_slope` to every `_xpts_ngw` call (3 of them) and the `_xpts_per_gw` call if present in merge_players (ATF-01 found `_xpts_per_gw` is called from gw_intel.py, not merge_players — defaults keep it backward compatible).

4. **Integration test** (add to `pipeline/tests/test_merge.py`, following whatever fixture style its existing merge_players tests use — read the file first; if constructing a full merge_players call is impractical there, put the test in test_merge_xpts_components.py against `_xpts_ngw` instead):
   ```python
   def test_fas_threading_through_xpts_ngw():
       """attacking_difficulty in fixture dicts changes xpts when fas_slope > 0."""
       from merge import _xpts_ngw
       fixtures = [{'event_id': 1, 'difficulty_score': 0.5,
                    'defensive_difficulty': 0.5, 'attacking_difficulty': 0.0,
                    'opponent_team': 'X', 'is_home': True}]
       easy = _xpts_ngw(fixtures, xg_per90=0.5, xa_per90=0.2, start_prob=1.0,
                        xmins=90.0, element_type=4, n_gws=1, fas_slope=0.4)
       fixtures[0]['attacking_difficulty'] = 1.0
       hard = _xpts_ngw(fixtures, xg_per90=0.5, xa_per90=0.2, start_prob=1.0,
                        xmins=90.0, element_type=4, n_gws=1, fas_slope=0.4)
       assert easy[0] > hard[0]
   ```
   **IMPORTANT:** read `_xpts_ngw`'s actual signature first (positional args/order/return shape — it returns a tuple) and adapt the call/assertion to reality; the assertion intent (easy > hard) must hold. Same for the fixture-dict keys it actually reads.

5. **`BLEND_ALPHA` default**: `grep -n "BLEND_ALPHA" pipeline/merge.py` — if merge.py defines its own (accuracy.py:35 comment says it matches), change 0.4 → 0.2 there too; also `grep -n "FORM_WINDOW" pipeline/merge.py` and change a 5 default → 4 where it's the form-window default. Report what you found and changed.

Run full suite (expect 531 + 1 = 532), commit:
`git commit -m "feat(fas-01,dc-01): thread attack scaling + DefCon through merge.py; honest-tuned form defaults"`

---

## Task 3: accuracy.py — constants, `build_defcon_rate_lookup`, backtest threading

**Files:** Modify `pipeline/accuracy.py`; Test `pipeline/tests/test_accuracy.py`

1. **Constants** (after `ATF_WINDOW_GWS = 6`):
   ```python
   FAS_SLOPE    = 0.4  # FAS-01: fixture attack scaling, validated in BT-02 honest backtest
   DEFCON_SCALE = 0.0  # DC-01: DefCon EV weight; tunable via TUNE-01
   ```
   And change `BLEND_ALPHA = 0.4` → `0.2`, `FORM_WINDOW_GWS = 5` → `4` (update their comments to mention "honest-tuned 2026-06 (BT-02)").

2. **`build_defcon_rate_lookup`** (new, after `build_team_atf_lookup`):
   ```python
   DEFCON_THRESHOLD = {2: 10, 3: 12, 4: 12}  # DC-01 (mirrors defcon.py)


   def build_defcon_rate_lookup(summaries: dict, elements: list) -> dict:
       """(gw, player_id) -> prior P(defensive_contribution >= threshold | 60+ mins).

       Strictly prior: for target GW g uses only history rounds < g (no leakage).
       Denominator = prior 60+ minute games; no prior such games -> 0.0.
       GKP -> no entries (rate 0.0 via caller's .get default).
       """
       et_by_id = {e['id']: e.get('element_type') for e in elements}
       lookup: dict = {}
       for pid, summary in summaries.items():
           threshold = DEFCON_THRESHOLD.get(et_by_id.get(pid))
           if threshold is None:
               continue
           history = sorted(summary.get('history', []),
                            key=lambda e: e.get('round', 0))
           rounds = sorted({e.get('round') for e in history
                            if e.get('round') is not None})
           played = 0
           hits = 0
           idx = 0
           entries = history
           for g in rounds:
               # accumulate entries with round < g BEFORE recording lookup
               while idx < len(entries) and entries[idx].get('round', 0) < g:
                   e = entries[idx]
                   if (e.get('minutes', 0) or 0) >= 60:
                       played += 1
                       if (e.get('defensive_contribution', 0) or 0) >= threshold:
                           hits += 1
                   idx += 1
               lookup[(g, pid)] = hits / played if played else 0.0
       return lookup
   ```

3. **Thread through the backtest chain** following the ATF-01 pattern (`git show 0e00334` is the template):
   - `_reconstruct_xpts` and `_reconstruct_xpts_with_form` gain `fas_slope: float = 0.0`, `defcon_rate: float = 0.0`, `defcon_scale: float = 0.0` (after the ATF-01 params) and pass them to `_compute_xpts_fixture` — **plus** pass `attack_difficulty=difficulty_score` (the function's existing difficulty arg; it is the same normalised opponent score the live fixture dicts carry).
   - `build_per_gw_rows` gains `defcon_lookup: dict = {}`, `fas_slope: float = FAS_SLOPE`, `defcon_scale: float = DEFCON_SCALE`; inside the loop `defcon_rate_at_gw = defcon_lookup.get((gw, player_id), 0.0)` (find the actual player-id variable name in the loop) and passes all three to both reconstruct calls.
   - `compute_accuracy_backtest` builds `defcon_lookup = build_defcon_rate_lookup(summaries, elements)` (find the actual variable holding bootstrap elements in that function — read it) and passes `defcon_lookup=defcon_lookup` to `build_per_gw_rows` (NOT fas_slope/defcon_scale — constants flow as defaults, same as the ATF pattern).

4. **Tests** (after the ATF-01 lookup tests; reuse `_finished_fix`-style helpers where applicable):
   ```python
   def _dc_summary(pid, rates):
       """rates: list of (round, minutes, dc)."""
       return {pid: {'history': [
           {'round': r, 'minutes': m, 'defensive_contribution': d}
           for r, m, d in rates]}}


   def test_build_defcon_rate_lookup_strictly_prior():
       from accuracy import build_defcon_rate_lookup
       summaries = _dc_summary(7, [(1, 90, 12), (2, 90, 12), (3, 90, 0)])
       elements = [{'id': 7, 'element_type': 3}]
       lookup = build_defcon_rate_lookup(summaries, elements)
       assert lookup[(1, 7)] == 0.0          # nothing prior
       assert lookup[(2, 7)] == 1.0          # 1/1 prior hits
       assert lookup[(3, 7)] == 1.0          # 2/2
       # GW3's own miss not visible at GW3; a GW4 key doesn't exist (no GW4 entry)


   def test_build_defcon_rate_lookup_sixty_minute_denominator():
       from accuracy import build_defcon_rate_lookup
       summaries = _dc_summary(8, [(1, 90, 12), (2, 30, 12), (3, 90, 0)])
       elements = [{'id': 8, 'element_type': 3}]
       lookup = build_defcon_rate_lookup(summaries, elements)
       # At GW3: prior 60+ games = GW1 only (GW2 was 30 mins) -> 1/1
       assert lookup[(3, 8)] == 1.0


   def test_build_defcon_rate_lookup_def_threshold_and_gkp():
       from accuracy import build_defcon_rate_lookup
       summaries = {}
       summaries.update(_dc_summary(1, [(1, 90, 10), (2, 90, 10)]))
       summaries.update(_dc_summary(2, [(1, 90, 10), (2, 90, 10)]))
       elements = [{'id': 1, 'element_type': 2},   # DEF: threshold 10 -> hits
                   {'id': 2, 'element_type': 1}]   # GKP: excluded entirely
       lookup = build_defcon_rate_lookup(summaries, elements)
       assert lookup[(2, 1)] == 1.0
       assert (2, 2) not in lookup
   ```

Run full suite (expect 532 + 3 = 535), commit:
`git commit -m "feat(fas-01,dc-01): accuracy.py constants, defcon lookup, backtest threading + honest-tuned defaults"`

---

## Task 4: tune.py — parameters 12 + 13

**Files:** Modify `pipeline/tune.py`; Test `pipeline/tests/test_tune.py`

Template: `git show def0046` (the ATF-01 tune commit). Replicate for:

```python
FAS_SLOPE_CANDIDATES    = [0.0, 0.2, 0.4, 0.6]          # FAS-01
DEFCON_SCALE_CANDIDATES = [0.0, 0.25, 0.5, 0.75, 1.0]   # DC-01
```

- Imports: `FAS_SLOPE`, `DEFCON_SCALE`, `build_defcon_rate_lookup`
- `_read_prior_params` both branches: `'fas_slope'` (float, key `fas_slope_used`), `'defcon_scale'` (float, key `defcon_scale_used`)
- `params` dict + `sweep_order` entries 12 and 13
- `_sweep_param`: build `defcon_lookup = build_defcon_rate_lookup(summaries, elements)` ONCE near the top (NOT per-candidate — it has no tunable window; check what summaries/elements variables `_sweep_param` already receives — if it doesn't receive them, build the lookup in `run_tuner` once and pass it into `_sweep_param` as a new parameter, which is cleaner anyway). Both `build_per_gw_rows` calls gain `defcon_lookup=...`, `fas_slope=...params['fas_slope']`, `defcon_scale=...params['defcon_scale']` (baseline) / `candidate_params[...]` (candidate).
- Tests: 2 new default tests (`test_fas_slope_default_in_read_prior_params`, `test_defcon_scale_default_in_read_prior_params`, same shape as the ATF ones); update `test_run_tuner_sweep_covers_all_parameters`, `test_run_tuner_promoted_params_contains_all_params`, `test_coordinate_locking_uses_prior_sweep_value` (docstring "eleven"→"thirteen", assert `fas_slope == 0.4` — note the non-zero default! — and `defcon_scale == 0.0`), and add `'fas_slope': 0.4, 'defcon_scale': 0.0` to all `TestSweepParam` params dicts. If `run_tuner`/`_sweep_param` signatures change (defcon_lookup pass-through), update their tests accordingly.

Run full suite (expect 535 + 2 = 537), commit:
`git commit -m "feat(fas-01,dc-01): fas_slope + defcon_scale as TUNE-01 parameters 12-13"`

---

## Task 5: run.py — read / init / pass / write

**Files:** Modify `pipeline/run.py`; Test `pipeline/tests/test_run.py`

Template: `git show 34eb59a`. Replicate exactly for `fas_slope_used` (default `accuracy.FAS_SLOPE`, float) and `defcon_scale_used` (default `accuracy.DEFCON_SCALE`, float): init defaults, read from `prev_backtest` summary, extend startup print, pass `fas_slope=fas_slope_used, defcon_scale=defcon_scale_used` to `merge_players`, write `backtest_data['summary']['fas_slope_used'/'defcon_scale_used']` from `pp[...]` after the tuner, extend the `[tune]` print. Update `_read_tuner_params` helper + both contract tests in test_run.py (promoted-values test uses `fas_slope_used: 0.6`, `defcon_scale_used: 0.5`).

Run full suite (expect 537, all passing), commit:
`git commit -m "feat(fas-01,dc-01): read/pass/write fas_slope + defcon_scale in run.py"`

---

## Task 6: components-dict consumers sanity check

**Files:** possibly none (verification task)

The components dict gained a `'defcon'` key. Search consumers:
`grep -rn "xPts_components" pipeline/ src/ --include="*.py" --include="*.ts" --include="*.tsx" | grep -v test`
For each consumer verify it iterates keys generically or accesses named keys (in which case 'defcon' is simply ignored — fine). If any consumer hard-validates the key SET (e.g. a zod schema in src/lib/types.ts or a test asserting exact keys), extend it. Report findings. Run the full pipeline test suite one final time AND `npx tsc --noEmit` from the repo root if any TS file was touched (skip if none). Commit only if changes were needed:
`git commit -m "chore(dc-01): extend xPts components consumers for defcon key"`

---

## Self-review notes

- Spec coverage: FAS leaf ✓ (T1), DC leaf + components ✓ (T1), wiring ✓ (T2), per-player rate ✓ (T2), constants + defaults ✓ (T3), strictly-prior lookup ✓ (T3), backtest threading ✓ (T3), tuner 12+13 ✓ (T4), run.py ✓ (T5), UI-safety check ✓ (T6).
- fas_slope DEFAULT is 0.4 (non-zero!) everywhere: merge_players, accuracy constant, tuner prior, locking test. This is intentional (validated) — implementers must not "fix" it to 0.0.
- defcon_lookup is built ONCE (no tunable window) — differs from the ATF per-candidate rebuild; T4 explains why.
- Test-count arithmetic assumes no collateral test updates; if a count differs, investigate before proceeding (do not adjust blindly).
