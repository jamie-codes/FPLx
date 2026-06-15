# EUR-01 Midweek-Congestion Rotation Signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate, on the 2025/26 archive, whether penalising the expected minutes of players whose club had a midweek fixture (European or domestic cup) 1–4 days before a PL gameweek improves predictions — promote only on a measured win.

**Architecture:** A committed, source-cited congestion calendar (`congestion_dates.py`), a pure join that turns it into a `(team_id, gw)` clash set against the archive fixtures (`congestion_join.py`), a no-op-by-default penalty hook in `backtest.py`, and a sweep experiment (`exp10_congestion.py`) that emits a deterministic verdict. No live behaviour changes; live `xmins.py` wiring is a gated follow-up.

**Tech Stack:** Python 3.11, pytest, `datetime`/stdlib. PowerShell shell; tests run `cd pipeline; python -m pytest -q`.

**Spec:** `docs/superpowers/specs/2026-06-15-eur01-congestion-rotation-design.md` (authoritative — read it).

**Project rules:** No `Co-Authored-By` trailers. Do NOT push. Commit after each task.

---

### Task 1: `pipeline/congestion_dates.py` — research + commit the 2025/26 calendar

**Files:**
- Create: `pipeline/congestion_dates.py`
- Test: `pipeline/tests/test_congestion_dates.py`

This is a **research + data-entry** task. Produce `MIDWEEK_FIXTURE_DATES: dict[int, list[str]]` mapping FPL `team_id` → ISO `"YYYY-MM-DD"` dates of that club's **2025/26** UCL/UEL/UECL + Carabao Cup (EFL Cup) + FA Cup matches.

**FPL team_id table (2025/26 — authoritative, from the archive bootstrap):**
`1 Arsenal, 2 Aston Villa, 3 Burnley, 4 Bournemouth, 5 Brentford, 6 Brighton, 7 Chelsea, 8 Crystal Palace, 9 Everton, 10 Fulham, 11 Leeds, 12 Liverpool, 13 Man City, 14 Man Utd, 15 Newcastle, 16 Nott'm Forest, 17 Sunderland, 18 Spurs, 19 Wolves(WOL=20)` — full: `{1:Arsenal,2:Aston Villa,3:Burnley,4:Bournemouth,5:Brentford,6:Brighton,7:Chelsea,8:Crystal Palace,9:Everton,10:Fulham,11:Leeds,12:Liverpool,13:Man City,14:Man Utd,15:Newcastle,16:Nott'm Forest,17:Sunderland,18:Spurs,19:West Ham,20:Wolves}`.

**Research sources (use WebSearch/WebFetch):** Wikipedia "2025–26 UEFA Champions League", "2025–26 UEFA Europa League", "2025–26 UEFA Conference League", "2025–26 EFL Cup", "2025–26 FA Cup", and each participating club's "2025–26 season" page. For each English club: record every UCL/UEL/UECL match date AND every Carabao/FA Cup match date. Clubs eliminated early have short lists; clubs not in Europe still have domestic-cup dates. Cross-check kickoff dates against at least two of those pages.

- [ ] **Step 1: Research and write `pipeline/congestion_dates.py`** with this exact structure (one block per club, source comment + count). Example shape (REPLACE with researched real dates — these illustrative lines are NOT real data):

```python
"""EUR-01: 2025/26 midweek-fixture congestion calendar (European + domestic cups).

Maps FPL team_id -> ISO dates of UCL/UEL/UECL + Carabao Cup + FA Cup matches,
used to detect rotation risk when a club plays midweek 1-4 days before a PL GW.
Hand-researched from Wikipedia season pages (cited per club). 2025/26 only;
the 2026/27 calendar is entered at launch if EUR-01 validates.
"""

# team_id -> [ISO date strings]. Sources cited per club.
MIDWEEK_FIXTURE_DATES: dict[int, list[str]] = {
    # Liverpool (id 12) — UCL + Carabao + FA Cup. Source: en.wikipedia.org/wiki/2025–26_Liverpool_F.C._season
    12: [
        "2025-09-17",  # UCL MD1
        # ... real researched dates ...
    ],
    # Arsenal (id 1) — UCL + cups. Source: 2025–26_Arsenal_F.C._season
    1: [
        # ... real researched dates ...
    ],
    # ... every club with midweek cup/European fixtures ...
}

# Total dates across all clubs — asserted in tests to catch accidental truncation.
TOTAL_DATES = sum(len(v) for v in MIDWEEK_FIXTURE_DATES.values())
```

- [ ] **Step 2: Write the structural test** `pipeline/tests/test_congestion_dates.py`:

```python
import datetime
from congestion_dates import MIDWEEK_FIXTURE_DATES, TOTAL_DATES


def test_keys_are_valid_team_ids():
    assert MIDWEEK_FIXTURE_DATES, "calendar must not be empty"
    for tid in MIDWEEK_FIXTURE_DATES:
        assert isinstance(tid, int) and 1 <= tid <= 20, f"bad team_id {tid}"


def test_values_are_iso_dates_in_season_window():
    for tid, dates in MIDWEEK_FIXTURE_DATES.items():
        assert isinstance(dates, list)
        for d in dates:
            parsed = datetime.date.fromisoformat(d)  # raises if not ISO YYYY-MM-DD
            # 2025/26 season window (Aug 2025 .. Jun 2026)
            assert datetime.date(2025, 7, 1) <= parsed <= datetime.date(2026, 7, 1), (tid, d)


def test_no_duplicate_dates_per_team():
    for tid, dates in MIDWEEK_FIXTURE_DATES.items():
        assert len(dates) == len(set(dates)), f"duplicate date for team {tid}"


def test_total_count_matches_constant():
    assert TOTAL_DATES == sum(len(v) for v in MIDWEEK_FIXTURE_DATES.values())
    # Sanity floor: the season had many midweek cup/euro rounds across ~8 European
    # clubs + all 20 in domestic cups; a real calendar has well over 60 dates.
    assert TOTAL_DATES >= 60, f"calendar suspiciously small ({TOTAL_DATES}) — research incomplete"
```

- [ ] **Step 3: Run the test, verify pass.** Run: `cd pipeline; python -m pytest tests/test_congestion_dates.py -q`. If `TOTAL_DATES < 60`, the research is incomplete — continue researching, do NOT lower the floor.
- [ ] **Step 4: Commit.**
```bash
git add pipeline/congestion_dates.py pipeline/tests/test_congestion_dates.py
git commit -m "feat(eur-01): 2025/26 midweek-congestion calendar (euro + domestic cups)"
```

**Reviewer note (for spec/quality review):** verify a sample of dates against the cited Wikipedia pages — the experiment's validity depends on calendar accuracy.

---

### Task 2: `pipeline/congestion_join.py` — `(team_id, gw)` clash set

**Files:**
- Create: `pipeline/congestion_join.py`
- Test: `pipeline/tests/test_congestion_join.py`

- [ ] **Step 1: Write the failing tests** `pipeline/tests/test_congestion_join.py`:

```python
from congestion_join import build_congestion_lookup


def _fix(fid, gw, h, a, kickoff):
    return {'id': fid, 'event': gw, 'team_h': h, 'team_a': a, 'kickoff_time': kickoff}


def test_euro_3_days_before_is_clash():
    # team 12 plays a midweek match Thu 2025-09-18; PL fixture Sun 2025-09-21 (3 days)
    cal = {12: ['2025-09-18']}
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    clashes = build_congestion_lookup(cal, fixtures)
    assert (12, 6) in clashes
    assert (4, 6) not in clashes  # opponent had no midweek match


def test_six_days_before_is_not_clash():
    cal = {12: ['2025-09-15']}
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    assert build_congestion_lookup(cal, fixtures) == set()


def test_same_day_or_after_is_not_clash():
    cal = {12: ['2025-09-21'], 4: ['2025-09-23']}  # same day; after
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    assert build_congestion_lookup(cal, fixtures) == set()


def test_away_team_clash_detected():
    cal = {4: ['2025-09-18']}  # the away team had the midweek match
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    clashes = build_congestion_lookup(cal, fixtures)
    assert (4, 6) in clashes


def test_window_bounds_1_and_4():
    cal = {12: ['2025-09-20', '2025-09-17']}  # 1 day before, 4 days before
    fixtures = [_fix(100, 6, 12, 4, '2025-09-21T15:00:00Z')]
    assert (12, 6) in build_congestion_lookup(cal, fixtures)  # both within 1..4
```

- [ ] **Step 2: Run, verify fail** (module missing). `cd pipeline; python -m pytest tests/test_congestion_join.py -q`.

- [ ] **Step 3: Implement `pipeline/congestion_join.py`:**

```python
"""EUR-01: join the midweek-congestion calendar to archive fixtures, producing a
set of (team_id, gw) where the team played a midweek match 1-4 days before its
PL gameweek fixture."""
import datetime


def build_congestion_lookup(calendar: dict[int, list[str]], fixtures: list) -> set:
    """calendar: {team_id: [ISO date str]}. fixtures: archive fixtures with
    'event', 'team_h', 'team_a', 'kickoff_time'. Returns {(team_id, gw), ...}.
    A clash = a congestion date d with 1 <= (pl_date - d).days <= 4."""
    # Pre-parse calendar dates once.
    parsed = {tid: [datetime.date.fromisoformat(d) for d in ds]
              for tid, ds in calendar.items()}
    clashes = set()
    for fix in fixtures:
        ko = fix.get('kickoff_time')
        gw = fix.get('event')
        if not ko or gw is None:
            continue
        pl_date = datetime.date.fromisoformat(ko[:10])
        for team_id in (fix.get('team_h'), fix.get('team_a')):
            for d in parsed.get(team_id, []):
                gap = (pl_date - d).days
                if 1 <= gap <= 4:
                    clashes.add((team_id, gw))
                    break
    return clashes
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_congestion_join.py -q`.

- [ ] **Step 5: Smoke-test against the real archive** (PowerShell, from `pipeline/`):
```powershell
python -c "from capture_season import load_season_archive; from congestion_dates import MIDWEEK_FIXTURE_DATES; from congestion_join import build_congestion_lookup; a=load_season_archive(); c=build_congestion_lookup(MIDWEEK_FIXTURE_DATES, a['fixtures']); print('clashes:', len(c)); import collections; print('by gw:', dict(sorted(collections.Counter(gw for _,gw in c).items())))"
```
Expected: a non-trivial clash count (tens of `(team,gw)` pairs spread across GWs). If 0, the calendar dates don't align with PL fixtures — investigate the calendar before proceeding.

- [ ] **Step 6: Commit.**
```bash
git add pipeline/congestion_join.py pipeline/tests/test_congestion_join.py
git commit -m "feat(eur-01): congestion_join — (team_id, gw) clash set from calendar"
```

---

### Task 3: `backtest.py` — no-op-by-default congestion penalty

**Files:**
- Modify: `pipeline/backtest.py` (`DEFAULT_PARAMS` ~31-51; `run_backtest` signature ~364; deploy `xm` assignment ~453-457; row append ~498-510)
- Test: `pipeline/tests/test_backtest.py` (add cases)

**3a — `DEFAULT_PARAMS`** (add after `'odds_goalexp_weight': 0.0,`):
```python
    'congestion_penalty': 0.0,    # EUR-01: xmins penalty when a midweek-congestion clash precedes the GW
```

**3b — `run_backtest` signature** (add param):
```python
def run_backtest(archive: dict | None = None, params: dict | None = None,
                 mode: str = 'deploy', first_gw: int = 7,
                 last_gw: int = 38, odds_lookup: dict | None = None,
                 congestion_clashes: set | None = None) -> dict:
```

**3c — penalty application + row flag.** In the per-fixture loop, the deploy branch at ~453-457 currently reads:
```python
                if mode == 'deploy':
                    # DGW note: ...
                    xm, sp_ = sig['xmins'], sig['start_prob']
```
Before the `pred = 0.0` / entries loop (where `row_clash` must be initialised once per player-GW), add `row_clash = False` alongside `pred = 0.0` (find the `pred = 0.0` line just before `for e in entries:`). Then change the deploy branch to:
```python
                if mode == 'deploy':
                    # DGW note: same predicted xmins per fixture.
                    xm, sp_ = sig['xmins'], sig['start_prob']
                    # EUR-01: penalise xmins on a midweek-congestion clash (no-op at 0.0).
                    if congestion_clashes is not None and (team_id, gw) in congestion_clashes:
                        row_clash = True
                        xm = xm * (1.0 - p['congestion_penalty'])
```
(`team_id` and `gw` are already in scope: `team_id` at ~425-428, `gw` is the outer loop var.)

**3d — tag the row.** In the `rows.append({...})` dict (~498-510), add:
```python
                'congestion_clash': row_clash,
```

- [ ] **Step 1: Write the failing tests** in `pipeline/tests/test_backtest.py`:

```python
def test_congestion_penalty_zero_is_noop():
    from backtest import run_backtest
    from capture_season import load_season_archive
    from congestion_dates import MIDWEEK_FIXTURE_DATES
    from congestion_join import build_congestion_lookup
    archive = load_season_archive()
    clashes = build_congestion_lookup(MIDWEEK_FIXTURE_DATES, archive['fixtures'])
    base = run_backtest(archive, mode='deploy')
    same = run_backtest(archive, params={'congestion_penalty': 0.0},
                        mode='deploy', congestion_clashes=clashes)
    assert base['metrics'] == same['metrics']


def test_congestion_penalty_changes_metrics_and_flags_rows():
    from backtest import run_backtest
    from capture_season import load_season_archive
    from congestion_dates import MIDWEEK_FIXTURE_DATES
    from congestion_join import build_congestion_lookup
    archive = load_season_archive()
    clashes = build_congestion_lookup(MIDWEEK_FIXTURE_DATES, archive['fixtures'])
    base = run_backtest(archive, mode='deploy')
    pen = run_backtest(archive, params={'congestion_penalty': 0.20},
                       mode='deploy', congestion_clashes=clashes)
    assert base['metrics'] != pen['metrics']            # penalty moves predictions
    assert any(r['congestion_clash'] for r in pen['rows'])  # some rows flagged


def test_congestion_clashes_none_is_noop():
    from backtest import run_backtest
    from capture_season import load_season_archive
    archive = load_season_archive()
    base = run_backtest(archive, mode='deploy')
    same = run_backtest(archive, params={'congestion_penalty': 0.20},
                        mode='deploy', congestion_clashes=None)
    assert base['metrics'] == same['metrics']  # no clash set -> no-op even at penalty>0
```

- [ ] **Step 2: Run, verify fail.** `cd pipeline; python -m pytest tests/test_backtest.py -q -k congestion`.
- [ ] **Step 3: Implement 3a–3d.**
- [ ] **Step 4: Run, verify pass + no regression.** `cd pipeline; python -m pytest tests/test_backtest.py -q`.
- [ ] **Step 5: Commit.**
```bash
git add pipeline/backtest.py pipeline/tests/test_backtest.py
git commit -m "feat(eur-01): backtest congestion-penalty hook (no-op default) + row clash flag"
```

---

### Task 4: `pipeline/experiments/exp10_congestion.py` — the sweep + verdict

**Files:**
- Create: `pipeline/experiments/exp10_congestion.py`
- Create (output): `pipeline/experiments/exp10_congestion.json`
- Test: `pipeline/tests/test_exp10_congestion.py`

- [ ] **Step 1: Write the failing test** `pipeline/tests/test_exp10_congestion.py`:

```python
def test_exp10_runs_and_produces_verdict():
    from experiments import exp10_congestion
    result = exp10_congestion.run()
    assert 'sweep' in result and len(result['sweep']) == 6
    assert 'clash_count' in result and result['clash_count'] > 0
    assert result['verdict'] in ('SHIP', 'NO_SHIP')
    base = next(a for a in result['sweep'] if a['congestion_penalty'] == 0.0)
    assert 'top10_mean_pts' in base and 'clash_rmse' in base


def test_rmse_helper():
    from experiments.exp10_congestion import _rmse
    assert _rmse([(2.0, 2.0), (3.0, 3.0)]) == 0.0
    assert abs(_rmse([(0.0, 2.0)]) - 2.0) < 1e-9
```

- [ ] **Step 2: Run, verify fail.** `cd pipeline; python -m pytest tests/test_exp10_congestion.py -q`.

- [ ] **Step 3: Implement `pipeline/experiments/exp10_congestion.py`:**

```python
"""EUR-01 / exp10: does penalising xmins on midweek-congestion clashes beat the
baseline on the leakage-free 2025/26 backtest?

Run:  cd pipeline; python -m experiments.exp10_congestion
Verdict: SHIP only if a positive penalty beats penalty=0 on deploy top10_mean_pts
AND lowers clash-subset points RMSE. Else NO_SHIP (record in the rejected table).
"""
import json
import math
import os

from capture_season import load_season_archive
from congestion_dates import MIDWEEK_FIXTURE_DATES
from congestion_join import build_congestion_lookup
from backtest import run_backtest

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp10_congestion.json')
_PENALTIES = [0.0, 0.05, 0.10, 0.15, 0.20, 0.25]


def _rmse(pairs):
    if not pairs:
        return float('nan')
    return math.sqrt(sum((p - a) ** 2 for p, a in pairs) / len(pairs))


def _clash_rmse(res):
    """Points RMSE (predicted xPts vs actual) over clash-flagged rows only."""
    pairs = [(r['xpts_pred'], r['actual_pts']) for r in res['rows']
             if r.get('congestion_clash')]
    return _rmse(pairs)


def run():
    archive = load_season_archive()
    clashes = build_congestion_lookup(MIDWEEK_FIXTURE_DATES, archive['fixtures'])

    sweep = []
    for pen in _PENALTIES:
        res = run_backtest(archive, params={'congestion_penalty': pen},
                           mode='deploy', congestion_clashes=clashes)
        sweep.append({
            'congestion_penalty': pen,
            'top10_mean_pts': res['metrics']['top10_mean_pts'],
            'clash_rmse': _clash_rmse(res),
        })

    base = next(a for a in sweep if a['congestion_penalty'] == 0.0)
    # best positive-penalty arm by top10
    positives = [a for a in sweep if a['congestion_penalty'] > 0.0]
    best = max(positives, key=lambda a: a['top10_mean_pts'])

    ships = (best['top10_mean_pts'] >= base['top10_mean_pts']
             and best['clash_rmse'] < base['clash_rmse'])
    verdict = 'SHIP' if ships else 'NO_SHIP'

    result = {
        'sweep': sweep,
        'clash_count': len(clashes),
        'baseline_top10': base['top10_mean_pts'],
        'baseline_clash_rmse': base['clash_rmse'],
        'best_penalty': best['congestion_penalty'],
        'best_top10': best['top10_mean_pts'],
        'best_clash_rmse': best['clash_rmse'],
        'verdict': verdict,
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


if __name__ == '__main__':
    r = run()
    print(json.dumps(r, indent=2))
    print('VERDICT:', r['verdict'])
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_exp10_congestion.py -q`.
- [ ] **Step 5: Run the experiment for real + commit the result.**
```powershell
python -m experiments.exp10_congestion
```
Report the printed sweep table + clash count + VERDICT verbatim.
```bash
git add pipeline/experiments/exp10_congestion.py pipeline/experiments/exp10_congestion.json pipeline/tests/test_exp10_congestion.py
git commit -m "exp(eur-01): exp10 congestion-rotation sweep + verdict"
```

---

### Task 5: Full-suite verification + record the verdict

- [ ] **Step 1:** Run the full suite: `cd pipeline; python -m pytest -q`. All green (new params no-op by default).
- [ ] **Step 2:** Report the exp10 verdict verbatim to the controller. Do NOT change any live default regardless of verdict (live wiring is a gated follow-up per the spec). The controller records SHIP → spec the gated live wiring; NO_SHIP → add a rejected-ideas-table row.
- [ ] **Step 3:** Commit any final fixups.

---

## Out of scope (do NOT build here)
- Live `xmins.py` / `compute_xmins_stats` wiring, `accuracy.py` constant, `tune.py` sweep entry (gated follow-up if exp10 SHIPs).
- The 2026/27 calendar.
- Touching `european_cup_dates.py` / the `gw_intel` display flag.
- Competition-graded or rest-day-graded penalties; European-vs-cup decomposition.
- Any UI change.
