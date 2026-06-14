# ODDS-01 Bookmaker-Odds Signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the historical-odds ingest + odds→CS-prob/goal-expectation conversion + the exp09 leakage-free backtest experiment that decides whether bookmaker closing odds beat the model's rolling-goals proxies.

**Architecture:** Three focused, mostly-pure modules — `odds_model.py` (de-vig + Poisson math, no I/O), `odds_client.py` (fetch/parse football-data.co.uk CSV), `odds_join.py` (team alias + `(gw, team_id)` lookup keyed to the season archive). A no-op-by-default blend is added to `backtest.py` (CS at the raw-prob stage, goal-exp on the attack-scaling difficulty only). `exp09_odds.py` orchestrates a coordinate sweep and writes a verdict. This build changes NO live default — it produces a measured verdict.

**Tech Stack:** Python 3.11, pytest, `math`/`csv` stdlib, `requests` (already a dep). PowerShell shell. Tests run with `cd pipeline; python -m pytest -q`.

**Spec:** `docs/superpowers/specs/2026-06-14-odds01-bookmaker-odds-signal-design.md` (authoritative — read it).

**Project rules:** No `Co-Authored-By` trailers. Do NOT push. Commit after each task.

---

### Task 1: `pipeline/odds_model.py` — de-vig + Poisson conversion (pure math)

**Files:**
- Create: `pipeline/odds_model.py`
- Test: `pipeline/tests/test_odds_model.py`

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_odds_model.py
import math
import pytest
from odds_model import devig, poisson_pmf, lambdas_from_odds, cs_prob, _p_over_25, _p_home_win


def _fair_odds_for(lam_h, lam_a):
    """Generate fair (vig-free) 1X2 and O/U2.5 decimal odds from known lambdas."""
    grid = 15
    ph = [poisson_pmf(i, lam_h) for i in range(grid)]
    pa = [poisson_pmf(j, lam_a) for j in range(grid)]
    p_home = sum(ph[i] * pa[j] for i in range(grid) for j in range(grid) if i > j)
    p_draw = sum(ph[i] * pa[i] for i in range(grid))
    p_away = sum(ph[i] * pa[j] for i in range(grid) for j in range(grid) if i < j)
    p_over = _p_over_25(lam_h + lam_a)
    p_under = 1.0 - p_over
    return (1/p_home, 1/p_draw, 1/p_away), (1/p_over, 1/p_under)


def test_devig_sums_to_one():
    out = devig([2.0, 4.0, 4.0])  # implied 0.5/0.25/0.25 = 1.0 already (no vig)
    assert abs(sum(out) - 1.0) < 1e-9
    # with vig (sums > 1), still normalises to 1
    out2 = devig([1.9, 3.6, 4.2])
    assert abs(sum(out2) - 1.0) < 1e-9
    assert out2[0] > out2[1]  # shortest price -> highest prob


def test_poisson_pmf_basic():
    assert abs(poisson_pmf(0, 1.0) - math.exp(-1.0)) < 1e-9
    assert poisson_pmf(0, 0.0) == 1.0
    assert poisson_pmf(2, 0.0) == 0.0


def test_p_over_25_monotonic():
    assert _p_over_25(0.5) < _p_over_25(3.0) < _p_over_25(6.0)


def test_lambdas_round_trip_recovers_known_values():
    for lam_h, lam_a in [(1.8, 1.0), (1.2, 1.2), (2.5, 0.6), (0.9, 1.7)]:
        o1x2, ou = _fair_odds_for(lam_h, lam_a)
        got_h, got_a = lambdas_from_odds(o1x2, ou)
        assert abs(got_h - lam_h) < 0.06, (lam_h, lam_a, got_h)
        assert abs(got_a - lam_a) < 0.06, (lam_h, lam_a, got_a)


def test_symmetric_odds_give_equal_lambdas():
    o1x2, ou = _fair_odds_for(1.3, 1.3)
    h, a = lambdas_from_odds(o1x2, ou)
    assert abs(h - a) < 1e-3


def test_heavy_favourite_high_home_lambda():
    o1x2, ou = _fair_odds_for(2.6, 0.5)
    h, a = lambdas_from_odds(o1x2, ou)
    assert h > a
    assert h > 2.0 and a < 1.0


def test_cs_prob_monotonic_decreasing_in_lambda():
    assert cs_prob(0.5) > cs_prob(1.5) > cs_prob(3.0)
    assert abs(cs_prob(0.0) - 1.0) < 1e-9
```

- [ ] **Step 2: Run, verify fail**

Run: `cd pipeline; python -m pytest tests/test_odds_model.py -q`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `pipeline/odds_model.py`**

```python
"""ODDS-01: convert bookmaker closing odds into per-team expected goals (lambda),
clean-sheet probability, and goal-expectation. Pure math, no I/O.

Approach A (independent Poisson, supremacy/total): de-vig the closing 1X2 and
over/under-2.5 markets, recover total-goals lambda from P(over 2.5), recover
supremacy (lam_home - lam_away) from the de-vigged home-win probability, then
split into per-team lambdas. CS-prob(team) = P(opponent scores 0) = exp(-lam_opp).
"""
import math

_GOAL_GRID = 11  # goals 0..10 — beyond this Poisson mass is negligible for EPL lambdas


def poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam) * lam ** k / math.factorial(k)


def devig(decimal_odds: list[float]) -> list[float]:
    """Normalise reciprocal decimal odds to sum to 1 (removes the bookmaker margin)."""
    inv = [1.0 / o for o in decimal_odds]
    s = sum(inv)
    return [x / s for x in inv]


def _p_over_25(lam_total: float) -> float:
    """P(total goals > 2.5) under Poisson(lam_total). Monotonic increasing in lam_total."""
    return 1.0 - sum(poisson_pmf(k, lam_total) for k in range(3))


def _p_home_win(lam_h: float, lam_a: float) -> float:
    ph = [poisson_pmf(i, lam_h) for i in range(_GOAL_GRID)]
    pa = [poisson_pmf(j, lam_a) for j in range(_GOAL_GRID)]
    return sum(ph[i] * pa[j] for i in range(_GOAL_GRID) for j in range(_GOAL_GRID) if i > j)


def _solve_lambda_total(p_over: float, lo: float = 0.05, hi: float = 10.0,
                        tol: float = 1e-7) -> float:
    """Bisection: find lam_total with _p_over_25(lam_total) == p_over."""
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if _p_over_25(mid) < p_over:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    return (lo + hi) / 2.0


def _solve_supremacy(p_home: float, lam_total: float, tol: float = 1e-7) -> float:
    """Bisection: find supremacy s in [-lam_total, lam_total] with
    _p_home_win((lam_total+s)/2, (lam_total-s)/2) == p_home. Monotonic increasing in s."""
    lo, hi = -lam_total, lam_total
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if _p_home_win((lam_total + mid) / 2.0, (lam_total - mid) / 2.0) < p_home:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    return (lo + hi) / 2.0


def lambdas_from_odds(odds_1x2, odds_ou25) -> tuple[float, float]:
    """odds_1x2 = (home, draw, away) decimal odds; odds_ou25 = (over2.5, under2.5).
    Returns (lam_home, lam_away)."""
    p_h, _p_d, _p_a = devig(list(odds_1x2))
    p_over, _p_under = devig(list(odds_ou25))
    lam_total = _solve_lambda_total(p_over)
    s = _solve_supremacy(p_h, lam_total)
    lam_h = max(0.0, (lam_total + s) / 2.0)
    lam_a = max(0.0, (lam_total - s) / 2.0)
    return lam_h, lam_a


def cs_prob(lam_opp: float) -> float:
    """Clean-sheet probability for a team = P(opponent scores 0) = exp(-lam_opp)."""
    return math.exp(-lam_opp)
```

- [ ] **Step 4: Run, verify pass**

Run: `cd pipeline; python -m pytest tests/test_odds_model.py -q`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/odds_model.py pipeline/tests/test_odds_model.py
git commit -m "feat(odds-01): odds_model — de-vig + Poisson supremacy/total conversion"
```

---

### Task 2: `pipeline/odds_client.py` — fetch + parse + commit the snapshot

**Files:**
- Create: `pipeline/odds_client.py`
- Create: `pipeline/data/odds/E0_2025_26.csv` (committed snapshot)
- Test: `pipeline/tests/test_odds_client.py`

The parser reads closing-average columns (`AvgCH/D/A`, `AvgC>2.5`/`AvgC<2.5`) with per-cell fallback to `B365H/D/A`, `B365>2.5`/`B365<2.5` when a closing cell is blank. Output row shape:
`{'date': 'DD/MM/YYYY', 'home': str, 'away': str, 'fthg': int, 'ftag': int, 'odds_1x2': (H, D, A), 'odds_ou25': (over, under)}`.

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_odds_client.py
import pytest
from odds_client import parse_odds_csv

_HEADER = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,AvgCH,AvgCD,AvgCA,AvgC>2.5,AvgC<2.5,B365H,B365D,B365A,B365>2.5,B365<2.5"

def _row(home, away, fthg, ftag, avgch, avgcd, avgca, avgo, avgu,
         b365h="", b365d="", b365a="", b365o="", b365u=""):
    return (f"E0,15/08/2025,20:00,{home},{away},{fthg},{ftag},H,"
            f"{avgch},{avgcd},{avgca},{avgo},{avgu},{b365h},{b365d},{b365a},{b365o},{b365u}")


def test_parse_basic_row():
    text = _HEADER + "\n" + _row("Liverpool", "Bournemouth", 4, 2, 1.29, 6.02, 8.68, 1.36, 3.05)
    rows = parse_odds_csv(text)
    assert len(rows) == 1
    r = rows[0]
    assert r['home'] == 'Liverpool' and r['away'] == 'Bournemouth'
    assert r['fthg'] == 4 and r['ftag'] == 2
    assert r['odds_1x2'] == (1.29, 6.02, 8.68)
    assert r['odds_ou25'] == (1.36, 3.05)


def test_blank_closing_falls_back_to_b365():
    text = _HEADER + "\n" + _row("Arsenal", "Wolves", 1, 0, "", "", "", "", "",
                                 b365h="1.40", b365d="4.5", b365a="8.0",
                                 b365o="1.50", b365u="2.6")
    rows = parse_odds_csv(text)
    assert rows[0]['odds_1x2'] == (1.40, 4.5, 8.0)
    assert rows[0]['odds_ou25'] == (1.50, 2.6)


def test_row_missing_both_sources_is_skipped():
    text = _HEADER + "\n" + _row("X", "Y", 0, 0, "", "", "", "", "")
    rows = parse_odds_csv(text)
    assert rows == []


def test_bom_header_handled():
    text = "﻿" + _HEADER + "\n" + _row("Chelsea", "Fulham", 2, 0, 1.5, 4.0, 6.0, 1.7, 2.1)
    rows = parse_odds_csv(text)
    assert rows[0]['home'] == 'Chelsea'
```

- [ ] **Step 2: Run, verify fail**

Run: `cd pipeline; python -m pytest tests/test_odds_client.py -q`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `pipeline/odds_client.py`**

```python
"""ODDS-01: fetch + parse football-data.co.uk EPL closing-odds CSV.

Verified source (2026-06-14): https://www.football-data.co.uk/mmz4281/2526/E0.csv
Uses closing-average columns (AvgC*) with per-cell fallback to B365*. For the
exp09 experiment, fetch_season_csv is run once to create the committed snapshot
at data/odds/E0_2025_26.csv; the experiment then reads the snapshot (offline/CI).
"""
import csv
import io
import os

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_PATH = os.path.join(_MODULE_DIR, 'data', 'odds', 'E0_2025_26.csv')
_URL_TMPL = 'https://www.football-data.co.uk/mmz4281/{code}/E0.csv'


def fetch_season_csv(season_code: str = '2526') -> str:
    """GET the season CSV text. Raises on non-200. Used to create the snapshot."""
    import requests
    resp = requests.get(_URL_TMPL.format(code=season_code),
                        headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
    resp.raise_for_status()
    return resp.text


def _num(row: dict, *keys) -> float | None:
    """First non-blank value among keys, as float; None if all blank/missing/bad."""
    for k in keys:
        v = (row.get(k) or '').strip()
        if v:
            try:
                return float(v)
            except ValueError:
                continue
    return None


def parse_odds_csv(text: str) -> list[dict]:
    """Parse CSV text into odds rows. Closing-average columns with B365 fallback.
    Rows missing a full 1X2 or O/U2.5 quote from BOTH sources are skipped."""
    reader = csv.DictReader(io.StringIO(text.lstrip('﻿')))
    out = []
    for row in reader:
        home = (row.get('HomeTeam') or '').strip()
        away = (row.get('AwayTeam') or '').strip()
        if not home or not away:
            continue
        h = _num(row, 'AvgCH', 'B365H')
        d = _num(row, 'AvgCD', 'B365D')
        a = _num(row, 'AvgCA', 'B365A')
        over = _num(row, 'AvgC>2.5', 'B365>2.5')
        under = _num(row, 'AvgC<2.5', 'B365<2.5')
        if None in (h, d, a, over, under):
            continue
        try:
            fthg = int(row.get('FTHG') or 0)
            ftag = int(row.get('FTAG') or 0)
        except ValueError:
            fthg, ftag = 0, 0
        out.append({
            'date': (row.get('Date') or '').strip(),
            'home': home,
            'away': away,
            'fthg': fthg,
            'ftag': ftag,
            'odds_1x2': (h, d, a),
            'odds_ou25': (over, under),
        })
    return out
```

- [ ] **Step 4: Run, verify pass**

Run: `cd pipeline; python -m pytest tests/test_odds_client.py -q`
Expected: PASS.

- [ ] **Step 5: Create the committed snapshot**

Run (PowerShell, from `pipeline/`):
```powershell
New-Item -ItemType Directory -Force data/odds | Out-Null
python -c "from odds_client import fetch_season_csv, SNAPSHOT_PATH; open(SNAPSHOT_PATH,'w',encoding='utf-8',newline='').write(fetch_season_csv()); print('wrote', SNAPSHOT_PATH)"
python -c "from odds_client import parse_odds_csv, SNAPSHOT_PATH; rows=parse_odds_csv(open(SNAPSHOT_PATH,encoding='utf-8').read()); print('parsed', len(rows), 'rows')"
```
Expected: `parsed 380 rows` (or 379–380 if a postponed fixture lacks odds; if <378, STOP and investigate — do not silently proceed).

- [ ] **Step 6: Commit**

```bash
git add pipeline/odds_client.py pipeline/tests/test_odds_client.py pipeline/data/odds/E0_2025_26.csv
git commit -m "feat(odds-01): odds_client fetch/parse + committed 2025/26 closing-odds snapshot"
```

---

### Task 3: `pipeline/odds_join.py` — team alias + `(gw, team_id)` lookup

**Files:**
- Create: `pipeline/odds_join.py`
- Test: `pipeline/tests/test_odds_join.py`

Builds a single unified lookup `odds_lookup[(gw, team_id)] = {'cs_prob': float, 'goal_exp': float, 'attack_difficulty': float}`:
- `cs_prob` = `exp(-lam_opponent)` (directly blendable into `cs_prob_raw`).
- `goal_exp` = `lam_team` (kept raw for the goal-exp RMSE metric).
- `attack_difficulty` = `1 - norm(lam_team)` per-GW min-max across the 20 teams (high λ → easy fixture → low difficulty), on the same 0–1 scale the proxy uses, blendable into the attack-scaling difficulty.

Join key: each odds row → its archived fixture via `(date, home_id, away_id)`. football-data `Date` is `DD/MM/YYYY`; the archive `kickoff_time` is ISO `YYYY-MM-DDThh:mm:ssZ` — compare on the date portion. Reads the fixture's `event` for the GW.

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_odds_join.py
import math
import pytest
from odds_join import FOOTBALL_DATA_TO_FPL, resolve_team_ids, build_odds_lookup


def _archive(teams, fixtures):
    return {'bootstrap': {'teams': teams}, 'fixtures': fixtures}


# Minimal 2-team archive across one GW
_TEAMS = [
    {'id': 1, 'name': 'Liverpool', 'short_name': 'LIV'},
    {'id': 2, 'name': 'Bournemouth', 'short_name': 'BOU'},
    {'id': 3, 'name': 'Manchester Utd', 'short_name': 'MUN'},
    {'id': 4, 'name': 'Tottenham Hotspur', 'short_name': 'TOT'},
]
_FIXTURES = [
    {'id': 10, 'event': 1, 'team_h': 1, 'team_a': 2, 'kickoff_time': '2025-08-15T19:00:00Z'},
    {'id': 11, 'event': 1, 'team_h': 3, 'team_a': 4, 'kickoff_time': '2025-08-16T14:00:00Z'},
]


def test_aliases_resolve_against_bootstrap():
    name_to_id = resolve_team_ids(_TEAMS)
    # football-data names map through the alias table to FPL team ids
    assert name_to_id['Liverpool'] == 1
    assert name_to_id['Man United'] == 3      # alias -> 'Manchester Utd'
    assert name_to_id['Tottenham'] == 4       # alias -> 'Tottenham Hotspur'


def test_build_lookup_keys_and_cs_prob():
    rows = [
        {'date': '15/08/2025', 'home': 'Liverpool', 'away': 'Bournemouth',
         'fthg': 4, 'ftag': 2, 'odds_1x2': (1.29, 6.02, 8.68), 'odds_ou25': (1.36, 3.05)},
        {'date': '16/08/2025', 'home': 'Man United', 'away': 'Tottenham',
         'fthg': 0, 'ftag': 1, 'odds_1x2': (2.1, 3.4, 3.5), 'odds_ou25': (2.0, 1.8)},
    ]
    lk = build_odds_lookup(rows, _archive(_TEAMS, _FIXTURES))
    # every team in both fixtures present, keyed by (gw, team_id)
    assert set(lk.keys()) == {(1, 1), (1, 2), (1, 3), (1, 4)}
    # Liverpool (heavy favourite) CS-prob = exp(-lam_bournemouth); Bournemouth low
    assert lk[(1, 1)]['cs_prob'] > lk[(1, 2)]['cs_prob']
    # attack_difficulty is 0..1 and inverse to goal_exp within the GW
    for v in lk.values():
        assert 0.0 <= v['attack_difficulty'] <= 1.0
        assert v['goal_exp'] >= 0.0
    # team with the highest goal_exp has the lowest attack_difficulty
    hi = max(lk.values(), key=lambda v: v['goal_exp'])
    lo_diff = min(lk.values(), key=lambda v: v['attack_difficulty'])
    assert hi is lo_diff


def test_unmapped_team_raises():
    rows = [{'date': '15/08/2025', 'home': 'Liverpool', 'away': 'Nonexistent FC',
             'fthg': 1, 'ftag': 0, 'odds_1x2': (1.5, 4.0, 6.0), 'odds_ou25': (1.7, 2.1)}]
    with pytest.raises(Exception):
        build_odds_lookup(rows, _archive(_TEAMS, _FIXTURES))


def test_unmatched_fixture_raises():
    rows = [{'date': '01/01/2099', 'home': 'Liverpool', 'away': 'Bournemouth',
             'fthg': 1, 'ftag': 0, 'odds_1x2': (1.5, 4.0, 6.0), 'odds_ou25': (1.7, 2.1)}]
    with pytest.raises(Exception):
        build_odds_lookup(rows, _archive(_TEAMS, _FIXTURES))
```

- [ ] **Step 2: Run, verify fail**

Run: `cd pipeline; python -m pytest tests/test_odds_join.py -q`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `pipeline/odds_join.py`**

```python
"""ODDS-01: join parsed odds rows to the season archive, producing a
(gw, team_id) -> {cs_prob, goal_exp, attack_difficulty} lookup.

cs_prob          market clean-sheet prob = exp(-lam_opponent)   (blend into cs_prob_raw)
goal_exp         the team's own market lambda                   (raw, for RMSE metric)
attack_difficulty 1 - per-GW-normalised(lam_team)               (blend into attack scaling)
"""
from collections import defaultdict
from odds_model import lambdas_from_odds, cs_prob

# football-data.co.uk team name -> the substring/exact FPL bootstrap name it maps to.
# Names that already match FPL exactly are still listed for an explicit, auditable table.
FOOTBALL_DATA_TO_FPL = {
    'Arsenal': 'Arsenal',
    'Aston Villa': 'Aston Villa',
    'Bournemouth': 'Bournemouth',
    'Brentford': 'Brentford',
    'Brighton': 'Brighton',
    'Burnley': 'Burnley',
    'Chelsea': 'Chelsea',
    'Crystal Palace': 'Crystal Palace',
    'Everton': 'Everton',
    'Fulham': 'Fulham',
    'Leeds': 'Leeds',
    'Liverpool': 'Liverpool',
    'Man City': 'Man City',
    'Man United': 'Man Utd',
    'Newcastle': 'Newcastle',
    "Nott'm Forest": "Nott'm Forest",
    'Sunderland': 'Sunderland',
    'Tottenham': 'Spurs',
    'West Ham': 'West Ham',
    'Wolves': 'Wolves',
}


def resolve_team_ids(teams: list[dict]) -> dict[str, int]:
    """Map each football-data name -> FPL team id, matching the alias target against
    the archive bootstrap team `name` (substring, case-insensitive) or `short_name`.
    Raises ValueError if any football-data name fails to resolve."""
    out = {}
    for fd_name, fpl_target in FOOTBALL_DATA_TO_FPL.items():
        target = fpl_target.lower()
        match = None
        for t in teams:
            name = (t.get('name') or '').lower()
            short = (t.get('short_name') or '').lower()
            if target == name or target == short or target in name or name in target:
                match = t['id']
                break
        if match is None:
            raise ValueError(f"ODDS-01: football-data team {fd_name!r} "
                             f"(-> {fpl_target!r}) did not resolve to any FPL team")
        out[fd_name] = match
    return out


def _iso_date(kickoff_time: str) -> str:
    """ISO 'YYYY-MM-DDThh:mm:ssZ' -> 'DD/MM/YYYY' to match football-data Date."""
    d = kickoff_time[:10]  # YYYY-MM-DD
    y, m, day = d.split('-')
    return f"{day}/{m}/{y}"


def build_odds_lookup(odds_rows: list[dict], archive: dict) -> dict:
    teams = archive['bootstrap']['teams']
    name_to_id = resolve_team_ids(teams)
    fixtures = archive['fixtures']
    # index fixtures by (date, home_id, away_id)
    fix_index = {}
    for f in fixtures:
        key = (_iso_date(f.get('kickoff_time', '')), f['team_h'], f['team_a'])
        fix_index[key] = f

    # First pass: per-GW raw lambdas so we can normalise attack_difficulty per GW.
    raw = []  # (gw, team_id, lam_team, lam_opp)
    for r in odds_rows:
        if r['home'] not in name_to_id:
            raise ValueError(f"ODDS-01: unmapped home team {r['home']!r}")
        if r['away'] not in name_to_id:
            raise ValueError(f"ODDS-01: unmapped away team {r['away']!r}")
        home_id = name_to_id[r['home']]
        away_id = name_to_id[r['away']]
        fix = fix_index.get((r['date'], home_id, away_id))
        if fix is None:
            raise ValueError(f"ODDS-01: no archived fixture for "
                             f"{r['date']} {r['home']} v {r['away']}")
        gw = fix['event']
        lam_h, lam_a = lambdas_from_odds(r['odds_1x2'], r['odds_ou25'])
        raw.append((gw, home_id, lam_h, lam_a))
        raw.append((gw, away_id, lam_a, lam_h))

    # per-GW min-max of lam_team for attack_difficulty
    by_gw = defaultdict(list)
    for gw, _tid, lam_team, _lam_opp in raw:
        by_gw[gw].append(lam_team)
    gw_minmax = {gw: (min(v), max(v)) for gw, v in by_gw.items()}

    lookup = {}
    for gw, tid, lam_team, lam_opp in raw:
        lo, hi = gw_minmax[gw]
        norm = (lam_team - lo) / (hi - lo) if hi > lo else 0.5
        lookup[(gw, tid)] = {
            'cs_prob': cs_prob(lam_opp),
            'goal_exp': lam_team,
            'attack_difficulty': 1.0 - norm,
        }
    return lookup
```

- [ ] **Step 4: Run, verify pass**

Run: `cd pipeline; python -m pytest tests/test_odds_join.py -q`
Expected: PASS.

- [ ] **Step 5: Smoke-test the real join** (PowerShell, from `pipeline/`):
```powershell
python -c "from capture_season import load_season_archive; from odds_client import parse_odds_csv, SNAPSHOT_PATH; from odds_join import build_odds_lookup; a=load_season_archive(); rows=parse_odds_csv(open(SNAPSHOT_PATH,encoding='utf-8').read()); lk=build_odds_lookup(rows,a); print('lookup entries:', len(lk))"
```
Expected: ~760 entries (380 fixtures × 2 teams; a few fewer if any fixture lacked odds). If it raises on an unmapped team or unmatched fixture, fix the `FOOTBALL_DATA_TO_FPL` alias or the date join before proceeding — the assertions are intentional (no silent gaps).

- [ ] **Step 6: Commit**

```bash
git add pipeline/odds_join.py pipeline/tests/test_odds_join.py
git commit -m "feat(odds-01): odds_join — team alias + (gw,team_id) cs/goalexp lookup"
```

---

### Task 4: `backtest.py` — no-op-by-default odds blend

**Files:**
- Modify: `pipeline/merge.py` (`_cs_prob` ~210-245; `_compute_xpts_fixture` signature ~290-319 and the CS call ~368-373)
- Modify: `pipeline/backtest.py` (`DEFAULT_PARAMS` ~31-48; `run_backtest` signature ~364; per-fixture loop ~418-479)
- Test: `pipeline/tests/test_backtest.py` (add cases)

**4a — `merge.py` `_cs_prob`:** add two params and blend market CS-prob at the raw stage.

Change the signature (currently ends `..., norm_concede_rate=0.5, cs_team_form_slope=0.0)`):
```python
def _cs_prob(defensive_difficulty, xmins, mins_60_prob=None,
             cs_prob_base=0.40, cs_prob_slope=0.30,
             norm_concede_rate=0.5, cs_team_form_slope=0.0,
             odds_cs_prob=None, odds_cs_weight=0.0):   # ODDS-01
```
After the `cs_prob_raw = max(0.10, min(0.65, ...))` line and BEFORE the `mins_factor` block, insert:
```python
    # ODDS-01: blend market-implied CS-prob at the raw-prob stage (no-op at weight 0).
    if odds_cs_prob is not None and odds_cs_weight > 0.0:
        cs_prob_raw = (1.0 - odds_cs_weight) * cs_prob_raw + odds_cs_weight * odds_cs_prob
```

**4b — `merge.py` `_compute_xpts_fixture`:** add the two params (after `defcon_scale: float = 0.0,`):
```python
    odds_cs_prob: float | None = None,   # ODDS-01: market CS-prob for this team-fixture
    odds_cs_weight: float = 0.0,         # ODDS-01: blend weight (0 = no-op)
```
and pass them into the `_cs_prob(...)` call (add as final kwargs):
```python
                                 cs_team_form_slope=cs_team_form_slope,      # CSF-01
                                 odds_cs_prob=odds_cs_prob,                  # ODDS-01
                                 odds_cs_weight=odds_cs_weight)              # ODDS-01
```

**4c — `backtest.py` `DEFAULT_PARAMS`:** add after `'gk_saves_scale': 0.0,`:
```python
    'odds_cs_weight': 0.0,        # ODDS-01: blend market CS-prob into cs_prob_raw
    'odds_goalexp_weight': 0.0,   # ODDS-01: blend market attack-difficulty into attack scaling
```

**4d — `backtest.py` `run_backtest`:** add an optional param:
```python
def run_backtest(archive: dict | None = None, params: dict | None = None,
                 mode: str = 'deploy', first_gw: int = 7,
                 last_gw: int = 38, odds_lookup: dict | None = None) -> dict:
```
In the per-fixture loop, after `difficulty = (diff_raw - 1) / 4.0` (line ~427) and before the `fixture_attack_slope` block, insert the goal-exp blend on a SEPARATE attack-difficulty variable (must NOT touch `difficulty`, which still feeds CS as `defensive_difficulty`):
```python
                # ODDS-01: market attack-difficulty blend — affects attack scaling ONLY.
                atk_difficulty = difficulty
                od = odds_lookup.get((gw, team_id)) if odds_lookup is not None else None
                if od is not None and p['odds_goalexp_weight'] > 0.0:
                    atk_difficulty = ((1.0 - p['odds_goalexp_weight']) * difficulty
                                      + p['odds_goalexp_weight'] * od['attack_difficulty'])
```
Then change the `fixture_attack_slope` block to use `atk_difficulty` instead of `difficulty`:
```python
                if p['fixture_attack_slope'] > 0.0:
                    atk_scale = max(0.0, 1.0 + (0.5 - atk_difficulty) * p['fixture_attack_slope'])
```
And pass the CS odds into `_compute_xpts_fixture(...)` (add as final kwargs, computing the market CS-prob for this team-fixture):
```python
                    atf_slope=p['atf_slope'],
                    odds_cs_prob=(od['cs_prob'] if od is not None else None),   # ODDS-01
                    odds_cs_weight=p['odds_cs_weight'],                          # ODDS-01
                )
```

- [ ] **Step 1: Write the failing tests** in `pipeline/tests/test_backtest.py`:

```python
def test_cs_prob_odds_blend_noop_at_zero_weight():
    from merge import _cs_prob
    base = _cs_prob(0.5, 90.0, cs_prob_base=0.40, cs_prob_slope=0.30)
    blended = _cs_prob(0.5, 90.0, cs_prob_base=0.40, cs_prob_slope=0.30,
                       odds_cs_prob=0.9, odds_cs_weight=0.0)
    assert base == blended  # weight 0 -> identical


def test_cs_prob_odds_blend_full_weight_uses_market():
    from merge import _cs_prob
    # full weight: cs_prob_raw becomes the market prob, then x minutes factor (=1 at 90')
    out = _cs_prob(0.5, 90.0, mins_60_prob=1.0,
                   odds_cs_prob=0.55, odds_cs_weight=1.0)
    assert abs(out - 0.55) < 1e-9


def test_run_backtest_noop_when_no_odds_lookup():
    from backtest import run_backtest
    from capture_season import load_season_archive
    archive = load_season_archive()
    base = run_backtest(archive, mode='deploy')
    same = run_backtest(archive, mode='deploy', odds_lookup=None)
    assert base['metrics'] == same['metrics']


def test_run_backtest_odds_weight_zero_matches_baseline():
    from backtest import run_backtest
    from capture_season import load_season_archive
    from odds_client import parse_odds_csv, SNAPSHOT_PATH
    from odds_join import build_odds_lookup
    archive = load_season_archive()
    lk = build_odds_lookup(parse_odds_csv(open(SNAPSHOT_PATH, encoding='utf-8').read()), archive)
    base = run_backtest(archive, mode='deploy')
    # lookup present but both weights 0 -> identical to baseline
    same = run_backtest(archive, params={'odds_cs_weight': 0.0, 'odds_goalexp_weight': 0.0},
                        mode='deploy', odds_lookup=lk)
    assert base['metrics'] == same['metrics']


def test_run_backtest_odds_cs_weight_changes_metrics():
    from backtest import run_backtest
    from capture_season import load_season_archive
    from odds_client import parse_odds_csv, SNAPSHOT_PATH
    from odds_join import build_odds_lookup
    archive = load_season_archive()
    lk = build_odds_lookup(parse_odds_csv(open(SNAPSHOT_PATH, encoding='utf-8').read()), archive)
    base = run_backtest(archive, mode='deploy')
    blended = run_backtest(archive, params={'odds_cs_weight': 1.0}, mode='deploy', odds_lookup=lk)
    assert base['metrics'] != blended['metrics']  # CS blend moves predictions
```

NOTE (verified): `run_backtest` returns `{'metrics': {...}, 'per_gw': ..., 'rows': ..., 'config': ...}` (backtest.py:513-519), and `metrics['top10_mean_pts']` exists (backtest.py:353). So `res['metrics']` and `res['metrics']['top10_mean_pts']` are the correct accessors used throughout — no need to re-derive.

- [ ] **Step 2: Run, verify fail**

Run: `cd pipeline; python -m pytest tests/test_backtest.py -q -k odds`
Expected: FAIL.

- [ ] **Step 3: Implement 4a–4d** as specified above.

- [ ] **Step 4: Run, verify pass + no regression**

Run: `cd pipeline; python -m pytest tests/test_backtest.py tests/test_merge.py -q`
Expected: PASS (new odds tests + all existing backtest/merge tests still green).

- [ ] **Step 5: Commit**

```bash
git add pipeline/merge.py pipeline/backtest.py pipeline/tests/test_backtest.py
git commit -m "feat(odds-01): backtest blend hooks — CS at raw-prob, goal-exp on attack difficulty (no-op default)"
```

---

### Task 5: `pipeline/experiments/exp09_odds.py` — the validation experiment

**Files:**
- Create: `pipeline/experiments/exp09_odds.py`
- Create (output): `pipeline/experiments/exp09_odds.json`
- Test: `pipeline/tests/test_exp09_odds.py`

Computes, per arm: deploy-mode `top10_mean_pts`; CS **Brier + log-loss** vs actual clean sheets (a team keeps a CS in a fixture iff the opponent scored 0); goal-exp **RMSE + correlation** vs actual goals. Sweeps `odds_cs_weight ∈ [0,0.25,0.5,0.75,1.0]`, then `odds_goalexp_weight ∈ [0,0.25,0.5,0.75,1.0]` at the best CS weight (with `fixture_attack_slope=0.4`, the validated FAS slope, held fixed so the difficulty blend has a measurable effect). Emits a deterministic VERDICT.

- [ ] **Step 1: Write the failing test** in `pipeline/tests/test_exp09_odds.py`:

```python
def test_exp09_runs_and_produces_verdict():
    from experiments import exp09_odds
    result = exp09_odds.run()
    assert 'cs_sweep' in result and len(result['cs_sweep']) == 5
    assert 'goalexp_sweep' in result and len(result['goalexp_sweep']) == 5
    assert 'verdict' in result and result['verdict'] in ('SHIP_CS', 'SHIP_GOALEXP', 'SHIP_BOTH', 'NO_SHIP')
    # baseline (weight 0) Brier present and in [0,1]
    base = next(a for a in result['cs_sweep'] if a['odds_cs_weight'] == 0.0)
    assert 0.0 <= base['cs_brier'] <= 1.0


def test_cs_metrics_helper():
    from experiments.exp09_odds import _brier
    # perfect prediction -> 0 ; worst -> 1
    assert _brier([(1.0, True), (0.0, False)]) == 0.0
    assert _brier([(0.0, True), (1.0, False)]) == 1.0
```

- [ ] **Step 2: Run, verify fail**

Run: `cd pipeline; python -m pytest tests/test_exp09_odds.py -q`
Expected: FAIL.

- [ ] **Step 3: Implement `pipeline/experiments/exp09_odds.py`**

```python
"""ODDS-01 / exp09: does bookmaker closing-odds CS-prob & goal-expectation beat
the rolling-goals proxies on the leakage-free 2025/26 backtest?

Run:  cd pipeline; python -m experiments.exp09_odds
Verdict gate: SHIP the CS blend only if it is >= proxy on deploy top10_mean_pts
AND better (lower) on CS Brier. Goal-exp judged independently on RMSE + top10.
"""
import json
import math
import os

from capture_season import load_season_archive
from odds_client import parse_odds_csv, SNAPSHOT_PATH
from odds_join import build_odds_lookup
from odds_model import lambdas_from_odds
from backtest import run_backtest

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp09_odds.json')
_CS_WEIGHTS = [0.0, 0.25, 0.5, 0.75, 1.0]
_GE_WEIGHTS = [0.0, 0.25, 0.5, 0.75, 1.0]
_FAS_FOR_GE = 0.4  # validated FAS slope; held fixed so the goal-exp blend has an effect


def _brier(pairs):
    """pairs: list of (predicted_prob, actual_bool). Mean squared error."""
    if not pairs:
        return float('nan')
    return sum((p - (1.0 if a else 0.0)) ** 2 for p, a in pairs) / len(pairs)


def _logloss(pairs, eps=1e-12):
    if not pairs:
        return float('nan')
    s = 0.0
    for p, a in pairs:
        p = min(1.0 - eps, max(eps, p))
        s += -(math.log(p) if a else math.log(1.0 - p))
    return s / len(pairs)


def _cs_pairs(odds_lookup, archive):
    """(market_cs_prob, actual_clean_sheet) over every team-fixture with odds."""
    pairs = []
    for f in archive['fixtures']:
        if not f.get('finished'):
            continue
        h, a = f['team_h'], f['team_a']
        hs, as_ = f.get('team_h_score'), f.get('team_a_score')
        if hs is None or as_ is None:
            continue
        gw = f['event']
        odh = odds_lookup.get((gw, h))
        oda = odds_lookup.get((gw, a))
        if odh is not None:
            pairs.append((odh['cs_prob'], as_ == 0))  # home keeps CS iff away scored 0
        if oda is not None:
            pairs.append((oda['cs_prob'], hs == 0))
    return pairs


def _goalexp_pairs(odds_lookup, archive):
    """(predicted_lambda, actual_goals) over every team-fixture with odds."""
    pairs = []
    for f in archive['fixtures']:
        if not f.get('finished'):
            continue
        h, a = f['team_h'], f['team_a']
        hs, as_ = f.get('team_h_score'), f.get('team_a_score')
        if hs is None or as_ is None:
            continue
        gw = f['event']
        odh, oda = odds_lookup.get((gw, h)), odds_lookup.get((gw, a))
        if odh is not None:
            pairs.append((odh['goal_exp'], hs))
        if oda is not None:
            pairs.append((oda['goal_exp'], as_))
    return pairs


def _rmse(pairs):
    if not pairs:
        return float('nan')
    return math.sqrt(sum((p - a) ** 2 for p, a in pairs) / len(pairs))


def _corr(pairs):
    if len(pairs) < 2:
        return float('nan')
    xs = [p for p, _ in pairs]
    ys = [float(a) for _, a in pairs]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    vy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return cov / (vx * vy) if vx > 0 and vy > 0 else float('nan')


def run():
    archive = load_season_archive()
    odds_lookup = build_odds_lookup(
        parse_odds_csv(open(SNAPSHOT_PATH, encoding='utf-8').read()), archive)

    # CS metrics are intrinsic to the lookup (proxy CS is implicit in the baseline arm).
    cs_brier = _brier(_cs_pairs(odds_lookup, archive))
    cs_logloss = _logloss(_cs_pairs(odds_lookup, archive))
    ge_pairs = _goalexp_pairs(odds_lookup, archive)
    ge_rmse, ge_corr = _rmse(ge_pairs), _corr(ge_pairs)

    def top10(params):
        res = run_backtest(archive, params=params, mode='deploy', odds_lookup=odds_lookup)
        return res['metrics']['top10_mean_pts']  # verified shape: backtest.py:513-519, :353

    cs_sweep = []
    for w in _CS_WEIGHTS:
        cs_sweep.append({
            'odds_cs_weight': w,
            'top10_mean_pts': top10({'odds_cs_weight': w}),
            'cs_brier': cs_brier if w > 0 else _brier(_cs_pairs(odds_lookup, archive)),
        })
    base_top10 = next(a['top10_mean_pts'] for a in cs_sweep if a['odds_cs_weight'] == 0.0)
    best_cs = max(cs_sweep, key=lambda a: a['top10_mean_pts'])

    goalexp_sweep = []
    for w in _GE_WEIGHTS:
        goalexp_sweep.append({
            'odds_goalexp_weight': w,
            'top10_mean_pts': top10({'odds_goalexp_weight': w,
                                     'fixture_attack_slope': _FAS_FOR_GE}),
        })
    ge_base_top10 = next(a['top10_mean_pts'] for a in goalexp_sweep
                         if a['odds_goalexp_weight'] == 0.0)
    best_ge = max(goalexp_sweep, key=lambda a: a['top10_mean_pts'])

    # Verdict: CS ships if a positive weight wins top10 AND market CS Brier beats
    # the proxy. With one season + an implicit proxy Brier, the conservative test is:
    # the best CS arm must improve top10 over the weight-0 baseline.
    cs_wins = best_cs['odds_cs_weight'] > 0.0 and best_cs['top10_mean_pts'] >= base_top10
    ge_wins = best_ge['odds_goalexp_weight'] > 0.0 and best_ge['top10_mean_pts'] > ge_base_top10
    if cs_wins and ge_wins:
        verdict = 'SHIP_BOTH'
    elif cs_wins:
        verdict = 'SHIP_CS'
    elif ge_wins:
        verdict = 'SHIP_GOALEXP'
    else:
        verdict = 'NO_SHIP'

    result = {
        'cs_sweep': cs_sweep,
        'goalexp_sweep': goalexp_sweep,
        'cs_brier_market': cs_brier,
        'cs_logloss_market': cs_logloss,
        'goalexp_rmse_market': ge_rmse,
        'goalexp_corr_market': ge_corr,
        'best_cs_weight': best_cs['odds_cs_weight'],
        'best_goalexp_weight': best_ge['odds_goalexp_weight'],
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

NOTE on the proxy-CS Brier comparison: the cleanest honest CS comparison is market-CS-prob vs the proxy's implied CS-prob on the same team-fixtures. If, when reading `compute_metrics`/`run_backtest`, the harness exposes a per-team-fixture proxy CS-prob, compute a `cs_brier_proxy` the same way and make `cs_wins` require `cs_brier_market < cs_brier_proxy`. If it does not expose it cheaply, keep the conservative top10-improvement gate above and record in the verdict that the Brier is market-only (one-season, calibration-suggestive). Do NOT fabricate a proxy Brier.

- [ ] **Step 4: Run, verify pass**

Run: `cd pipeline; python -m pytest tests/test_exp09_odds.py -q`
Expected: PASS.

- [ ] **Step 5: Run the experiment for real + commit the result**

Run (PowerShell, from `pipeline/`):
```powershell
python -m experiments.exp09_odds
```
Expected: prints the sweep tables + `VERDICT: <one of SHIP_CS/SHIP_GOALEXP/SHIP_BOTH/NO_SHIP>`. Writes `exp09_odds.json`.

```bash
git add pipeline/experiments/exp09_odds.py pipeline/experiments/exp09_odds.json pipeline/tests/test_exp09_odds.py
git commit -m "exp(odds-01): exp09 odds-vs-proxy validation experiment + result"
```

---

### Task 6: Full-suite verification + record the verdict

- [ ] **Step 1:** Run the full pipeline suite: `cd pipeline; python -m pytest -q`. All green (new tests + existing, the odds params are no-op by default).
- [ ] **Step 2:** Read `exp09_odds.json`'s verdict. Report it verbatim to the controller — do NOT change any live default in this build regardless of verdict (live wiring is a separate gated follow-up per the spec).
- [ ] **Step 3:** Commit any final fixups.

---

## Out of scope (do NOT build here)
- Live in-pipeline odds fetch for 2026/27 + `run.py` wiring (gated follow-up if exp09 ships).
- Changing any live default / promoting a param value.
- Dixon-Coles correction (refinement if Approach A validates).
- Any UI surface.
