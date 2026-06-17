# AVAIL-01 Injury/Availability Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed structured api-football injury data into the one weak spot in FPLx availability — the FPL-news keyword-scan fallback — gated by a BT-02 validation with a placebo check, wired live shadow-first behind a flag.

**Architecture:** Two new pipeline modules (`injury_client.py` fetch+cache, `injury_join.py` provider→FPL join) feed a new gap-fill priority tier in `news_classifier.classify_availability`. A no-op-by-default backtest hook (`avail_out_factor`/`avail_doubt_factor` + `injury_lookup`) lets `experiments/exp12_avail.py` measure uplift vs baseline and a random placebo. Live wiring in `run.py` is env-gated (`AVAIL_ENABLED`, default off).

**Tech Stack:** Python 3.11, `requests` (already a dependency), pytest. api-football v3 (`https://v3.football.api-sports.io`). Reuses the season archive (`capture_season.load_season_archive`) and `backtest.run_backtest`.

---

## Context for the implementer (read once)

- **Tests live in `pipeline/tests/`** and import modules by bare name (`from injury_join import ...`) — `tests/conftest.py` puts `pipeline/` on `sys.path`. Run tests with `cd pipeline; python -m pytest -q`.
- **api-football auth:** header `x-apisports-key: <key>`, key from env `APIFOOTBALL_KEY`. Free in CI because the validation reads a committed snapshot, not the network.
- **Injury record shape** (from `GET /injuries?league=39&season=2025`, `response[]`):
  ```json
  {"player": {"id": 1125, "name": "Ryan Christie", "type": "Missing Fixture", "reason": "fitness"},
   "team": {"id": 35, "name": "Bournemouth"},
   "fixture": {"id": 1378969, "date": "2025-08-15T19:00:00+00:00"},
   "league": {"season": 2025}}
  ```
  `player.type` has exactly two values: `"Missing Fixture"` → `out`, `"Questionable"` → `doubt`.
- **Why date+team, not fixture id:** api-football fixture IDs ≠ FPL fixture IDs. We map a record to a GW via its `fixture.date` (`[:10]`) + FPL team id, looked up against the archive fixtures' `kickoff_time[:10]` + `team_h`/`team_a` → `event`.
- **Existing patterns to mirror:** `understat_client.py` (24h disk cache, `requests`), `odds_join.py` (explicit alias table + team resolution), `season_prior.py` tests (synthetic archive builders).
- **Gap-fill invariant (do not violate):** the injury signal must only take effect when FPL itself is silent (`status='a'` AND `chance_of_playing_next_round is None`). It must never override an FPL `i/u/s` status or a numeric `chance`.

---

## File Structure

**Create:**
- `pipeline/injury_client.py` — fetch season/fixture injuries from api-football; 24h disk cache; load committed snapshot.
- `pipeline/injury_join.py` — team alias table, name normalisation, provider→FPL player match, live + backtest lookup builders, coverage report.
- `pipeline/experiments/exp12_avail.py` (+ `exp12_avail.json`) — BT-02 validation: baseline vs treatment vs placebo, verdict.
- `pipeline/data/injuries/apifootball_PL_2025_26.json` — committed season injury snapshot (controller-fetched).
- `pipeline/data/apifootball_id_map.json` — manual override map `{api_player_id: fpl_element_id}`, starts as `{}`.
- `pipeline/tests/test_injury_client.py`, `pipeline/tests/test_injury_join.py`, `pipeline/tests/test_avail_backtest.py`, `pipeline/tests/test_exp12_avail.py`.

**Modify:**
- `pipeline/news_classifier.py` — add `injury` param + P3 gap-fill tier.
- `pipeline/tests/test_news_classifier.py` — add P3 + precedence tests.
- `pipeline/xmins.py` — thread `injury_lookup` param into the `classify_availability` call.
- `pipeline/backtest.py` — add `avail_out_factor`/`avail_doubt_factor` to `DEFAULT_PARAMS`; add `injury_lookup` param to `run_backtest`; scale `xm` when flagged.
- `pipeline/run.py` — build live injury lookup, env-gated `AVAIL_ENABLED` (default off), thread into xmins.

---

## Task 1: injury_client.py — fetch + cache + snapshot loader

**Files:**
- Create: `pipeline/injury_client.py`
- Test: `pipeline/tests/test_injury_client.py`

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_injury_client.py
import json
import os
import injury_client


def test_parse_records_extracts_fields():
    raw = {'response': [
        {'player': {'id': 1, 'name': 'A B', 'type': 'Missing Fixture', 'reason': 'knee'},
         'team': {'id': 35, 'name': 'Bournemouth'},
         'fixture': {'id': 99, 'date': '2025-08-15T19:00:00+00:00'}},
    ]}
    recs = injury_client.parse_records(raw)
    assert recs == [{
        'player_id': 1, 'player_name': 'A B', 'type': 'Missing Fixture', 'reason': 'knee',
        'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15',
    }]


def test_parse_records_empty_on_missing_response():
    assert injury_client.parse_records({}) == []
    assert injury_client.parse_records({'response': []}) == []


def test_load_snapshot_reads_committed_file(tmp_path):
    snap = tmp_path / 'snap.json'
    snap.write_text(json.dumps({'response': [
        {'player': {'id': 7, 'name': 'X Y', 'type': 'Questionable', 'reason': 'doubt'},
         'team': {'id': 1, 'name': 'Arsenal'},
         'fixture': {'id': 5, 'date': '2025-09-01T14:00:00+00:00'}},
    ]}), encoding='utf-8')
    recs = injury_client.load_snapshot(str(snap))
    assert len(recs) == 1
    assert recs[0]['type'] == 'Questionable'
    assert recs[0]['date'] == '2025-09-01'


def test_default_snapshot_path_points_at_committed_file():
    assert injury_client.SNAPSHOT_PATH.endswith(
        os.path.join('data', 'injuries', 'apifootball_PL_2025_26.json'))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pipeline; python -m pytest tests/test_injury_client.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'injury_client'`.

- [ ] **Step 3: Implement injury_client.py**

```python
# pipeline/injury_client.py
"""AVAIL-01: api-football injuries client (fetch + 24h cache + snapshot loader).

Live fetch needs env APIFOOTBALL_KEY. The committed season snapshot (used by the
BT-02 validation and CI) needs no key. Record dates are normalised to 'YYYY-MM-DD'
so the join can map them to a GW via the archive fixtures.
"""
import json
import os
from datetime import datetime, timezone, timedelta

import requests

_BASE = 'https://v3.football.api-sports.io'
_PL_LEAGUE = 39
CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'cache', 'apifootball_injuries.json')
SNAPSHOT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             'data', 'injuries', 'apifootball_PL_2025_26.json')
CACHE_TTL_HOURS = 24


def parse_records(raw: dict) -> list[dict]:
    """Flatten api-football injury `response[]` into the fields the join needs."""
    out = []
    for r in (raw or {}).get('response', []) or []:
        player = r.get('player', {}) or {}
        team = r.get('team', {}) or {}
        fixture = r.get('fixture', {}) or {}
        date = (fixture.get('date') or '')[:10]
        out.append({
            'player_id': player.get('id'),
            'player_name': player.get('name', ''),
            'type': player.get('type', ''),
            'reason': player.get('reason', ''),
            'team_id': team.get('id'),
            'team_name': team.get('name', ''),
            'date': date,
        })
    return out


def load_snapshot(path: str = SNAPSHOT_PATH) -> list[dict]:
    """Load + parse the committed season snapshot. Used by BT-02 / CI (no API key)."""
    with open(path, 'r', encoding='utf-8') as f:
        return parse_records(json.load(f))


def _api_key() -> str:
    key = os.environ.get('APIFOOTBALL_KEY')
    if not key:
        raise RuntimeError('AVAIL-01: APIFOOTBALL_KEY not set; live injury fetch unavailable')
    return key


def _get(endpoint: str, params: dict) -> dict:
    resp = requests.get(f'{_BASE}/{endpoint}', params=params,
                        headers={'x-apisports-key': _api_key()}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_season_injuries(season: int = 2025, league: int = _PL_LEAGUE) -> list[dict]:
    """Whole-season injury records (for snapshotting / lab reconstruction)."""
    return parse_records(_get('injuries', {'league': league, 'season': season}))


def fetch_fixture_injuries(fixture_id: int) -> list[dict]:
    """Projected absentees for one upcoming fixture (the live per-GW path)."""
    return parse_records(_get('injuries', {'fixture': fixture_id}))


def _cache_fresh() -> bool:
    if not os.path.exists(CACHE_PATH):
        return False
    try:
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        cached_at = datetime.fromisoformat(data.get('_cached_at', ''))
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - cached_at < timedelta(hours=CACHE_TTL_HOURS)
    except Exception:
        return False


def get_live_injuries(fixture_ids: list[int]) -> list[dict]:
    """Fetch+cache projected absentees across the given upcoming fixtures.

    Returns parsed records. On any HTTP error returns [] (safe no-op: affected
    players keep their FPL-derived availability)."""
    if _cache_fresh():
        with open(CACHE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)['records']
    records = []
    try:
        for fid in fixture_ids:
            records.extend(fetch_fixture_injuries(fid))
    except Exception as exc:
        print(f'AVAIL-01: live injury fetch failed ({exc}); no injury data this run')
        return []
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump({'_cached_at': datetime.now(timezone.utc).isoformat(),
                   'records': records}, f, ensure_ascii=False)
    return records
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pipeline; python -m pytest tests/test_injury_client.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline/injury_client.py pipeline/tests/test_injury_client.py
git commit -m "feat(avail-01): api-football injuries client (fetch + cache + snapshot loader)"
```

---

## Task 2: injury_join.py — provider→FPL join + lookup builders

**Files:**
- Create: `pipeline/injury_join.py`
- Test: `pipeline/tests/test_injury_join.py`

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_injury_join.py
import injury_join


def _bootstrap():
    return {'teams': [
        {'id': 1, 'name': 'Arsenal', 'short_name': 'ARS'},
        {'id': 35, 'name': 'Bournemouth', 'short_name': 'BOU'},
        {'id': 14, 'name': 'Man City', 'short_name': 'MCI'},
    ], 'elements': [
        {'id': 100, 'web_name': 'Saka', 'first_name': 'Bukayo', 'second_name': 'Saka', 'team': 1},
        {'id': 200, 'web_name': 'Christie', 'first_name': 'Ryan', 'second_name': 'Christie', 'team': 35},
        {'id': 201, 'web_name': 'Cook', 'first_name': 'Lewis', 'second_name': 'Cook', 'team': 35},
        {'id': 300, 'web_name': 'Haaland', 'first_name': 'Erling', 'second_name': 'Haaland', 'team': 14},
    ]}


def test_normalize_strips_accents_and_punctuation():
    assert injury_join._norm('C. Gakpo') == ['c', 'gakpo']
    assert injury_join._norm('Joelinton') == ['joelinton']
    assert injury_join._norm('Vitaly Janelt') == ['vitaly', 'janelt']


def test_match_player_by_surname():
    els = [e for e in _bootstrap()['elements'] if e['team'] == 35]
    assert injury_join._match_player('R. Christie', els) == 200


def test_match_player_disambiguates_by_first_initial():
    els = [{'id': 1, 'web_name': 'Smith', 'first_name': 'Adam', 'second_name': 'Smith', 'team': 9},
           {'id': 2, 'web_name': 'Smith', 'first_name': 'Bob', 'second_name': 'Smith', 'team': 9}]
    assert injury_join._match_player('B. Smith', els) == 2


def test_match_player_unmatched_returns_none():
    els = [e for e in _bootstrap()['elements'] if e['team'] == 1]
    assert injury_join._match_player('Z. Nobody', els) is None


def test_build_injury_lookup_live():
    recs = [
        {'player_id': 1125, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
         'reason': 'fitness', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'},
        {'player_id': 9, 'player_name': 'E. Haaland', 'type': 'Questionable',
         'reason': 'knock', 'team_id': 14, 'team_name': 'Manchester City', 'date': '2025-08-15'},
    ]
    lookup = injury_join.build_injury_lookup(recs, _bootstrap())
    assert lookup[200] == {'risk': 'out', 'reason': 'fitness'}
    assert lookup[300] == {'risk': 'doubt', 'reason': 'knock'}


def test_build_injury_lookup_unmapped_team_is_skipped():
    recs = [{'player_id': 1, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
             'reason': 'x', 'team_id': 999, 'team_name': 'Atlantis FC', 'date': '2025-08-15'}]
    assert injury_join.build_injury_lookup(recs, _bootstrap()) == {}


def test_build_backtest_lookup_keys_on_gw():
    archive = {'bootstrap': _bootstrap(), 'fixtures': [
        {'id': 500, 'event': 1, 'kickoff_time': '2025-08-15T19:00:00Z', 'team_h': 35, 'team_a': 1},
    ]}
    recs = [{'player_id': 1125, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
             'reason': 'fitness', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'}]
    lookup = injury_join.build_backtest_injury_lookup(recs, archive)
    assert lookup == {(1, 200): 'out'}


def test_backtest_lookup_out_beats_doubt_same_key():
    archive = {'bootstrap': _bootstrap(), 'fixtures': [
        {'id': 500, 'event': 1, 'kickoff_time': '2025-08-15T19:00:00Z', 'team_h': 35, 'team_a': 1},
        {'id': 501, 'event': 1, 'kickoff_time': '2025-08-17T14:00:00Z', 'team_h': 1, 'team_a': 35},
    ]}
    recs = [
        {'player_id': 1, 'player_name': 'R. Christie', 'type': 'Questionable',
         'reason': 'a', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-17'},
        {'player_id': 1, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
         'reason': 'b', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'},
    ]
    assert injury_join.build_backtest_injury_lookup(recs, archive)[(1, 200)] == 'out'


def test_overrides_force_player_id():
    recs = [{'player_id': 7, 'player_name': 'Totally Unmatchable', 'type': 'Missing Fixture',
             'reason': 'x', 'team_id': 1, 'team_name': 'Arsenal', 'date': '2025-08-15'}]
    lookup = injury_join.build_injury_lookup(recs, _bootstrap(), overrides={7: 100})
    assert lookup[100]['risk'] == 'out'


def test_coverage_report_counts_unmatched():
    recs = [
        {'player_id': 1125, 'player_name': 'R. Christie', 'type': 'Missing Fixture',
         'reason': 'x', 'team_id': 35, 'team_name': 'Bournemouth', 'date': '2025-08-15'},
        {'player_id': 9, 'player_name': 'Ghost Player', 'type': 'Missing Fixture',
         'reason': 'x', 'team_id': 1, 'team_name': 'Arsenal', 'date': '2025-08-15'},
    ]
    rep = injury_join.coverage_report(recs, _bootstrap())
    assert rep['matched'] == 1
    assert rep['unmatched'] == 1
    assert 'Ghost Player' in rep['unmatched_names']
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pipeline; python -m pytest tests/test_injury_join.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'injury_join'`.

- [ ] **Step 3: Implement injury_join.py**

```python
# pipeline/injury_join.py
"""AVAIL-01: join api-football injury records to FPL elements.

Team-first then within-team surname match (first-initial tiebreak). Unmatched
players are skipped (safe no-op: they keep their FPL-derived availability).
type 'Missing Fixture' -> out, 'Questionable' -> doubt.
"""
import json
import os
import re
import unicodedata

# api-football PL team name -> FPL bootstrap team `name`.
APIFOOTBALL_TEAM_TO_FPL = {
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
    'Manchester City': 'Man City',
    'Manchester United': 'Man Utd',
    'Newcastle': 'Newcastle',
    'Nottingham Forest': "Nott'm Forest",
    'Sunderland': 'Sunderland',
    'Tottenham': 'Spurs',
    'West Ham': 'West Ham',
    'Wolves': 'Wolves',
}

OVERRIDES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              'data', 'apifootball_id_map.json')

_TYPE_TO_RISK = {'Missing Fixture': 'out', 'Questionable': 'doubt'}


def _norm(name: str) -> list[str]:
    """Lowercase, strip accents/punctuation -> significant tokens."""
    s = unicodedata.normalize('NFKD', name or '').encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z ]', ' ', s.lower())
    return [t for t in s.split() if t]


def _match_player(api_name: str, team_elements: list[dict]) -> int | None:
    """Match an api-football name to one FPL element within a team. Surname match,
    first-initial tiebreak when several share a surname. Returns element id or None."""
    a = _norm(api_name)
    if not a:
        return None
    a_last, a_first = a[-1], a[0][0]
    cands = []
    for e in team_elements:
        names = set(_norm(e.get('web_name', '')) + _norm(e.get('second_name', ''))
                    + _norm(e.get('first_name', '')))
        if a_last in names:
            cands.append(e)
    if len(cands) == 1:
        return cands[0]['id']
    for e in cands:
        fn = _norm(e.get('first_name', ''))
        if fn and fn[0][0] == a_first:
            return e['id']
    return None


def _team_name_to_id(bootstrap: dict) -> dict[str, int]:
    by_name = {t['name']: t['id'] for t in bootstrap['teams']}
    out = {}
    for api_name, fpl_name in APIFOOTBALL_TEAM_TO_FPL.items():
        if fpl_name in by_name:
            out[api_name] = by_name[fpl_name]
    return out


def load_overrides(path: str = OVERRIDES_PATH) -> dict[int, int]:
    """Load the manual {api_player_id: fpl_element_id} override map ({} if absent)."""
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return {int(k): int(v) for k, v in json.load(f).items()}


def _resolve_fpl_id(rec: dict, team_name_to_id: dict, elements_by_team: dict,
                    overrides: dict) -> int | None:
    if rec['player_id'] in overrides:
        return overrides[rec['player_id']]
    fpl_team = team_name_to_id.get(rec['team_name'])
    if fpl_team is None:
        return None
    return _match_player(rec['player_name'], elements_by_team.get(fpl_team, []))


def _index_elements(bootstrap: dict) -> dict[int, list[dict]]:
    by_team: dict[int, list[dict]] = {}
    for e in bootstrap['elements']:
        by_team.setdefault(e['team'], []).append(e)
    return by_team


def build_injury_lookup(records: list[dict], bootstrap: dict,
                        overrides: dict | None = None) -> dict[int, dict]:
    """Live lookup: {fpl_element_id: {'risk': 'out'|'doubt', 'reason': str}}.
    'out' wins over 'doubt' if a player appears with both."""
    overrides = overrides if overrides is not None else load_overrides()
    team_name_to_id = _team_name_to_id(bootstrap)
    elements_by_team = _index_elements(bootstrap)
    out: dict[int, dict] = {}
    for rec in records:
        risk = _TYPE_TO_RISK.get(rec['type'])
        if risk is None:
            continue
        fpl_id = _resolve_fpl_id(rec, team_name_to_id, elements_by_team, overrides)
        if fpl_id is None:
            continue
        prev = out.get(fpl_id)
        if prev is None or (prev['risk'] == 'doubt' and risk == 'out'):
            out[fpl_id] = {'risk': risk, 'reason': rec['reason']}
    return out


def build_backtest_injury_lookup(records: list[dict], archive: dict,
                                 overrides: dict | None = None) -> dict[tuple, str]:
    """Lab lookup: {(gw, fpl_element_id): 'out'|'doubt'}, keyed via (date, team)->GW.
    'out' wins over 'doubt' for the same (gw, player)."""
    overrides = overrides if overrides is not None else load_overrides()
    bootstrap = archive['bootstrap']
    team_name_to_id = _team_name_to_id(bootstrap)
    elements_by_team = _index_elements(bootstrap)
    # (date, fpl_team_id) -> gw
    date_team_gw: dict[tuple, int] = {}
    for f in archive['fixtures']:
        d = (f.get('kickoff_time') or '')[:10]
        date_team_gw[(d, f['team_h'])] = f['event']
        date_team_gw[(d, f['team_a'])] = f['event']
    out: dict[tuple, str] = {}
    for rec in records:
        risk = _TYPE_TO_RISK.get(rec['type'])
        if risk is None:
            continue
        fpl_team = team_name_to_id.get(rec['team_name'])
        if fpl_team is None:
            continue
        gw = date_team_gw.get((rec['date'], fpl_team))
        if gw is None:
            continue
        fpl_id = _resolve_fpl_id(rec, team_name_to_id, elements_by_team, overrides)
        if fpl_id is None:
            continue
        key = (gw, fpl_id)
        if out.get(key) != 'out':
            out[key] = risk
    return out


def coverage_report(records: list[dict], bootstrap: dict,
                    overrides: dict | None = None) -> dict:
    """Count matched/unmatched players for the launch/maintenance checklist."""
    overrides = overrides if overrides is not None else load_overrides()
    team_name_to_id = _team_name_to_id(bootstrap)
    elements_by_team = _index_elements(bootstrap)
    matched, unmatched_names = 0, []
    for rec in records:
        if _resolve_fpl_id(rec, team_name_to_id, elements_by_team, overrides) is not None:
            matched += 1
        else:
            unmatched_names.append(rec['player_name'])
    return {'matched': matched, 'unmatched': len(unmatched_names),
            'unmatched_names': sorted(set(unmatched_names))}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pipeline; python -m pytest tests/test_injury_join.py -q`
Expected: PASS (11 passed).

- [ ] **Step 5: Commit**

```bash
git add pipeline/injury_join.py pipeline/tests/test_injury_join.py
git commit -m "feat(avail-01): api-football -> FPL injury join + live/backtest lookups"
```

---

## Task 3: news_classifier.py — gap-fill P3 injury tier

**Files:**
- Modify: `pipeline/news_classifier.py`
- Test: `pipeline/tests/test_news_classifier.py`

- [ ] **Step 1: Add the failing tests** (append to `pipeline/tests/test_news_classifier.py`)

```python
def test_injury_fires_in_gap_bucket_out():
    result = classify_availability(status='a', chance=None, news_text='',
                                   injury={'risk': 'out', 'reason': 'knee'})
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_injury_fires_in_gap_bucket_doubt():
    result = classify_availability(status='a', chance=None, news_text='',
                                   injury={'risk': 'doubt', 'reason': 'knock'})
    assert result['availability_risk'] == 'doubt'
    assert result['availability_factor'] == 0.5


def test_injury_does_not_override_fpl_status():
    # FPL says fit-and-flagged via status 'i' (injured) -> stays out regardless,
    # but the point is P1 fires first; injury must not UPGRADE an FPL signal.
    result = classify_availability(status='i', chance=None, news_text='',
                                   injury={'risk': 'doubt', 'reason': 'x'})
    assert result['availability_risk'] == 'out'  # P1 wins, injury ignored


def test_injury_does_not_override_fpl_chance():
    result = classify_availability(status='a', chance=100, news_text='',
                                   injury={'risk': 'out', 'reason': 'x'})
    assert result['availability_risk'] == 'fit'  # P2 wins, injury ignored


def test_injury_takes_priority_over_news_keywords():
    result = classify_availability(status='a', chance=None,
                                   news_text='fully fit and available',
                                   injury={'risk': 'out', 'reason': 'x'})
    assert result['availability_risk'] == 'out'  # P3 before P4 keyword scan


def test_no_injury_reproduces_legacy_behavior():
    result = classify_availability(status='a', chance=None, news_text='', injury=None)
    assert result['availability_risk'] == 'unknown'
    assert result['availability_factor'] == 1.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pipeline; python -m pytest tests/test_news_classifier.py -q`
Expected: FAIL (the new tests error on unexpected `injury` kwarg).

- [ ] **Step 3: Implement the P3 tier** in `pipeline/news_classifier.py`

Update the docstring priority list and the signature, and insert P3 between P2 and the keyword scan:

```python
def classify_availability(
    status: str,
    chance: int | float | None,
    news_text: str = '',
    injury: dict | None = None,
) -> dict:
```

Update the docstring `Args:` to add:
```
        injury:    AVAIL-01 gap-fill injury record {'risk': 'out'|'doubt', ...} or None.
                   Consulted ONLY when FPL is silent (status='a', chance=None);
                   never overrides an FPL status code or numeric chance.
```

Then, immediately AFTER the `if chance is not None:` block (Priority 2) and BEFORE the `# Priority 3: keyword scan` comment, insert:

```python
    # Priority 3 (AVAIL-01): structured injury data — gap-fill only. Reached only
    # when FPL gave no status flag (handled above) and chance is None.
    if injury is not None:
        if injury.get('risk') == 'out':
            return {'availability_risk': 'out', 'availability_factor': 0.0}
        if injury.get('risk') == 'doubt':
            return {'availability_risk': 'doubt', 'availability_factor': 0.5}
```

Renumber the existing keyword-scan comment from "Priority 3" to "Priority 4".

- [ ] **Step 4: Run the full classifier suite to verify pass + no regression**

Run: `cd pipeline; python -m pytest tests/test_news_classifier.py -q`
Expected: PASS (all prior tests + 6 new).

- [ ] **Step 5: Commit**

```bash
git add pipeline/news_classifier.py pipeline/tests/test_news_classifier.py
git commit -m "feat(avail-01): gap-fill injury tier in classify_availability"
```

---

## Task 4: xmins.py — thread injury_lookup into the live classifier call

**Files:**
- Modify: `pipeline/xmins.py` (the `_compute_player_xmins` signature + the `classify_availability` call ~line 265)
- Test: `pipeline/tests/test_xmins.py`

- [ ] **Step 1: Add the failing test** (append to `pipeline/tests/test_xmins.py`)

Match the existing test helpers in that file for building an `element` + `summary`. Add:

```python
def test_injury_lookup_gates_gap_bucket_player():
    # status 'a', no chance, no news -> normally 'unknown'/factor 1.0.
    # With an injury record for this element id, it becomes 'out'.
    element = {'id': 4242, 'element_type': 3, 'status': 'a',
               'chance_of_playing_next_round': None, 'news': ''}
    summary = {'history': [
        {'round': r, 'minutes': 90, 'starts': 1, 'total_points': 3} for r in range(1, 6)
    ]}
    result = _compute_player_xmins(
        element, summary, next_fixture_difficulty=3,
        injury_lookup={4242: {'risk': 'out', 'reason': 'knee'}})
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0
    assert result['xmins_adjusted'] == 0.0


def test_injury_lookup_absent_is_noop():
    element = {'id': 4242, 'element_type': 3, 'status': 'a',
               'chance_of_playing_next_round': None, 'news': ''}
    summary = {'history': [
        {'round': r, 'minutes': 90, 'starts': 1, 'total_points': 3} for r in range(1, 6)
    ]}
    result = _compute_player_xmins(element, summary, next_fixture_difficulty=3,
                                   injury_lookup=None)
    assert result['availability_risk'] == 'unknown'
```

> Note: match `_compute_player_xmins`'s real call signature in `xmins.py` (positional/keyword args for `element`, `summary`, `next_fixture_difficulty`). Adjust the test call to the actual parameter names if they differ; the new param is `injury_lookup` and defaults to `None`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pipeline; python -m pytest tests/test_xmins.py -q`
Expected: FAIL on unexpected `injury_lookup` kwarg.

- [ ] **Step 3: Implement the threading** in `pipeline/xmins.py`

Add `injury_lookup: dict | None = None` to the `_compute_player_xmins` signature. Change the `classify_availability` call (~line 265) from:

```python
    availability_result = classify_availability(
        status=element.get('status', 'a'),
        chance=element.get('chance_of_playing_next_round'),
        news_text=element.get('news', ''),
    )
```

to:

```python
    availability_result = classify_availability(
        status=element.get('status', 'a'),
        chance=element.get('chance_of_playing_next_round'),
        news_text=element.get('news', ''),
        injury=(injury_lookup or {}).get(element.get('id')),   # AVAIL-01 gap-fill
    )
```

If `_compute_player_xmins` is called from a batch function elsewhere in `xmins.py`, add an `injury_lookup=None` param to that wrapper too and pass it through (search `xmins.py` for `_compute_player_xmins(` call sites).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pipeline; python -m pytest tests/test_xmins.py -q`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add pipeline/xmins.py pipeline/tests/test_xmins.py
git commit -m "feat(avail-01): thread injury_lookup into xmins availability"
```

---

## Task 5: backtest.py — no-op-default injury gating hook

**Files:**
- Modify: `pipeline/backtest.py` (`DEFAULT_PARAMS` ~line 31-52; `run_backtest` signature ~line 367; deploy-branch `xm` ~line 460-464)
- Test: `pipeline/tests/test_avail_backtest.py`

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_avail_backtest.py
"""AVAIL-01: backtest injury-gating hook is a strict no-op by default and zeroes
a flagged player's prediction when avail_out_factor=0."""
from backtest import run_backtest, DEFAULT_PARAMS


def _archive():
    """Two players, GW1-10, identical full-minutes histories so both are eligible."""
    def hist(pid_pts):
        return [{'round': r, 'fixture': 1000 + r, 'minutes': 90, 'starts': 1,
                 'was_home': True, 'total_points': pid_pts,
                 'expected_goals': '0.3', 'expected_assists': '0.1'} for r in range(1, 11)]
    fixtures = [{'id': 1000 + r, 'event': r, 'kickoff_time': f'2025-08-{r:02d}T14:00:00Z',
                 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 3}
                for r in range(1, 11)]
    return {
        'bootstrap': {'teams': [{'id': 1, 'name': 'Arsenal', 'short_name': 'ARS'},
                                {'id': 2, 'name': 'Chelsea', 'short_name': 'CHE'}],
                      'elements': [{'id': 10, 'web_name': 'A', 'element_type': 3, 'team': 1},
                                   {'id': 20, 'web_name': 'B', 'element_type': 3, 'team': 1}]},
        'fixtures': fixtures,
        'summaries': {10: {'history': hist(5)}, 20: {'history': hist(5)}},
    }


def test_defaults_are_strict_noop():
    arch = _archive()
    base = run_backtest(arch, mode='deploy', first_gw=7, last_gw=10)
    gated = run_backtest(arch, mode='deploy', first_gw=7, last_gw=10, injury_lookup={})
    assert [r['xpts_pred'] for r in base['rows']] == [r['xpts_pred'] for r in gated['rows']]


def test_out_factor_zero_zeroes_flagged_player_only():
    arch = _archive()
    # flag player 10 out for GW8 only
    lookup = {(8, 10): 'out'}
    params = {'avail_out_factor': 0.0}
    res = run_backtest(arch, params=params, mode='deploy', first_gw=7, last_gw=10,
                       injury_lookup=lookup)
    flagged = [r for r in res['rows'] if r['player_id'] == 10 and r['gw'] == 8]
    unflagged = [r for r in res['rows'] if r['player_id'] == 20 and r['gw'] == 8]
    assert flagged and flagged[0]['xpts_pred'] == 0.0
    assert unflagged and unflagged[0]['xpts_pred'] > 0.0


def test_avail_params_exist_and_default_to_one():
    assert DEFAULT_PARAMS['avail_out_factor'] == 1.0
    assert DEFAULT_PARAMS['avail_doubt_factor'] == 1.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pipeline; python -m pytest tests/test_avail_backtest.py -q`
Expected: FAIL (`avail_out_factor` KeyError / unexpected `injury_lookup` kwarg).

- [ ] **Step 3: Implement the hook**

In `DEFAULT_PARAMS` (after the `congestion_penalty` line ~51), add:

```python
    'avail_out_factor': 1.0,      # AVAIL-01: xmins multiplier when injury-flagged 'out' (1.0 = no-op)
    'avail_doubt_factor': 1.0,    # AVAIL-01: xmins multiplier when injury-flagged 'doubt' (1.0 = no-op)
```

Add `injury_lookup` to the `run_backtest` signature:

```python
def run_backtest(archive: dict | None = None, params: dict | None = None,
                 mode: str = 'deploy', first_gw: int = 7,
                 last_gw: int = 38, odds_lookup: dict | None = None,
                 congestion_clashes: set | None = None,
                 injury_lookup: dict | None = None) -> dict:
```

In the deploy branch, immediately AFTER the congestion block (after line ~464, `xm = xm * (1.0 - p['congestion_penalty'])`), insert:

```python
                    # AVAIL-01: gate xmins by injury availability (no-op at factor 1.0).
                    if injury_lookup is not None:
                        _risk = injury_lookup.get((gw, pid))
                        if _risk == 'out':
                            xm = xm * p['avail_out_factor']
                        elif _risk == 'doubt':
                            xm = xm * p['avail_doubt_factor']
```

(`pid` is the player id from the outer `for pid, summary in archive['summaries'].items()` loop, matching the lookup key `(gw, fpl_element_id)`.)

- [ ] **Step 4: Run tests to verify pass + no regression in the backtest suite**

Run: `cd pipeline; python -m pytest tests/test_avail_backtest.py tests/test_exp09_odds.py tests/test_exp10_congestion.py -q`
Expected: PASS (new tests pass; odds/congestion backtests unaffected — defaults are no-op).

- [ ] **Step 5: Commit**

```bash
git add pipeline/backtest.py pipeline/tests/test_avail_backtest.py
git commit -m "feat(avail-01): no-op-default injury gating hook in run_backtest"
```

---

## Task 6: Commit the season snapshot + empty override map

**Files:**
- Create: `pipeline/data/injuries/apifootball_PL_2025_26.json` (real api-football data)
- Create: `pipeline/data/apifootball_id_map.json` (`{}`)

> **Controller note:** this step needs network + `APIFOOTBALL_KEY`, so the **controller runs the fetch** (subagents may be sandboxed). The empty override map can be created by anyone.

- [ ] **Step 1: Create the empty override map**

```bash
mkdir -p pipeline/data/injuries
printf '{}\n' > pipeline/data/apifootball_id_map.json
```

- [ ] **Step 2: Fetch + write the season snapshot** (controller, with key in env)

```bash
APIFOOTBALL_KEY=<key> python - <<'PY'
import json, os, urllib.request
key = os.environ['APIFOOTBALL_KEY']
req = urllib.request.Request(
    'https://v3.football.api-sports.io/injuries?league=39&season=2025',
    headers={'x-apisports-key': key})
data = json.load(urllib.request.urlopen(req, timeout=30))
out = 'pipeline/data/injuries/apifootball_PL_2025_26.json'
with open(out, 'w', encoding='utf-8') as f:
    json.dump({'league': 39, 'season': 2025, 'response': data['response']}, f, ensure_ascii=False)
print('wrote', out, 'records:', len(data['response']))
PY
```

Expected: prints `records: <several thousand>`.

- [ ] **Step 3: Sanity-check the snapshot loads + joins**

Run:
```bash
cd pipeline; python -c "
import injury_client, injury_join
from capture_season import load_season_archive
recs = injury_client.load_snapshot()
arch = load_season_archive()
rep = injury_join.coverage_report(recs, arch['bootstrap'])
print('records:', len(recs), '| matched:', rep['matched'], '| unmatched:', rep['unmatched'])
print('sample unmatched:', rep['unmatched_names'][:15])
bt = injury_join.build_backtest_injury_lookup(recs, arch)
print('backtest (gw,pid) entries:', len(bt))
"
```
Expected: a high match rate; note the unmatched names (these are the candidates for `apifootball_id_map.json` overrides). The controller eyeballs the unmatched list; if any are clearly high-value PL regulars, add `{api_player_id: fpl_element_id}` overrides (look up the api id in the snapshot) and re-run.

- [ ] **Step 4: Commit**

```bash
git add pipeline/data/injuries/apifootball_PL_2025_26.json pipeline/data/apifootball_id_map.json
git commit -m "data(avail-01): commit api-football PL 2025/26 injury snapshot + empty override map"
```

---

## Task 7: exp12_avail.py — BT-02 validation with placebo + verdict

**Files:**
- Create: `pipeline/experiments/exp12_avail.py` (+ `exp12_avail.json` on first run)
- Test: `pipeline/tests/test_exp12_avail.py`

- [ ] **Step 1: Write the failing test** (fast — synthetic, no snapshot, no network)

```python
# pipeline/tests/test_exp12_avail.py
import experiments.exp12_avail as exp12


def test_verdict_ship_when_better_and_beats_placebo():
    base = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    treat = {'top10_mean_pts': 5.3, 'captain_return_rate': 0.33, 'rmse': 1.95}
    placebo = {'top10_mean_pts': 5.05, 'captain_return_rate': 0.30, 'rmse': 2.0}
    assert exp12.decide_verdict(base, treat, placebo) == 'SHIP'


def test_verdict_no_ship_when_treatment_no_better_than_placebo():
    base = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    treat = {'top10_mean_pts': 5.3, 'captain_return_rate': 0.33, 'rmse': 1.95}
    placebo = {'top10_mean_pts': 5.32, 'captain_return_rate': 0.34, 'rmse': 1.94}
    assert exp12.decide_verdict(base, treat, placebo) == 'NO_SHIP'


def test_verdict_no_ship_when_rmse_worsens():
    base = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    treat = {'top10_mean_pts': 5.4, 'captain_return_rate': 0.35, 'rmse': 2.2}
    placebo = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    assert exp12.decide_verdict(base, treat, placebo) == 'NO_SHIP'


def test_placebo_lookup_is_same_size_and_deterministic():
    eligible = [(g, p) for g in range(7, 20) for p in range(100, 130)]
    a = exp12.make_placebo_lookup(eligible, n=25, seed=42)
    b = exp12.make_placebo_lookup(eligible, n=25, seed=42)
    assert len(a) == 25 and a == b
    assert all(v == 'out' for v in a.values())
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline; python -m pytest tests/test_exp12_avail.py -q`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement exp12_avail.py**

```python
# pipeline/experiments/exp12_avail.py
"""AVAIL-01 / exp12: does injury gating improve the leakage-free backtest?

Baseline (no injury) vs treatment (injury-gated, avail_out_factor=0) vs a random
same-size placebo. SHIP only if treatment beats baseline on top-N / captaincy,
does not worsen RMSE, AND beats placebo on top-N. Injury flags are pre-deadline
information, so using the GW-N flag to predict GW-N is leakage-free.

Run:  cd pipeline; python -m experiments.exp12_avail
"""
import json
import os
import random

from capture_season import load_season_archive
from backtest import run_backtest
from injury_client import load_snapshot
from injury_join import build_backtest_injury_lookup, coverage_report

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp12_avail.json')
_DOUBT_FACTOR = 0.5


def make_placebo_lookup(eligible_keys: list, n: int, seed: int = 42) -> dict:
    """Random same-size set of (gw, pid) 'out' flags drawn from eligible keys."""
    rng = random.Random(seed)
    n = min(n, len(eligible_keys))
    chosen = rng.sample(list(eligible_keys), n)
    return {k: 'out' for k in chosen}


def decide_verdict(base: dict, treat: dict, placebo: dict) -> str:
    """SHIP iff treatment improves top-N + captaincy vs baseline, does not worsen
    RMSE, and beats the placebo on top-N. Else NO_SHIP."""
    better_than_base = (treat['top10_mean_pts'] >= base['top10_mean_pts']
                        and treat['captain_return_rate'] >= base['captain_return_rate']
                        and treat['rmse'] <= base['rmse'])
    beats_placebo = treat['top10_mean_pts'] > placebo['top10_mean_pts']
    return 'SHIP' if (better_than_base and beats_placebo) else 'NO_SHIP'


def run():
    archive = load_season_archive()
    recs = load_snapshot()
    cov = coverage_report(recs, archive['bootstrap'])
    injury_lookup = build_backtest_injury_lookup(recs, archive)

    base = run_backtest(archive, mode='deploy')
    treat = run_backtest(archive, mode='deploy',
                         params={'avail_out_factor': 0.0, 'avail_doubt_factor': _DOUBT_FACTOR},
                         injury_lookup=injury_lookup)

    # eligible (gw, pid) keys = those the baseline actually scored, so the placebo
    # flags real predicted rows (same opportunity to change rankings as the real signal).
    eligible = [(r['gw'], r['player_id']) for r in base['rows']]
    placebo_lookup = make_placebo_lookup(eligible, n=len(injury_lookup))
    placebo = run_backtest(archive, mode='deploy',
                           params={'avail_out_factor': 0.0, 'avail_doubt_factor': _DOUBT_FACTOR},
                           injury_lookup=placebo_lookup)

    verdict = decide_verdict(base['metrics'], treat['metrics'], placebo['metrics'])
    result = {
        'baseline_metrics': base['metrics'],
        'treatment_metrics': treat['metrics'],
        'placebo_metrics': placebo['metrics'],
        'n_flagged': len(injury_lookup),
        'coverage': cov,
        'verdict': verdict,
        'config': {'avail_out_factor': 0.0, 'avail_doubt_factor': _DOUBT_FACTOR,
                   'placebo_seed': 42},
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


def _print(r):
    keys = ['top10_mean_pts', 'captain_return_rate', 'haul_capture_20', 'rmse', 'spearman']
    print('=== AVAIL-01 injury gating: baseline vs treatment vs placebo ===')
    print(f"{'metric':22} {'baseline':>10} {'treatment':>10} {'placebo':>10}")
    for k in keys:
        b = r['baseline_metrics'].get(k)
        t = r['treatment_metrics'].get(k)
        p = r['placebo_metrics'].get(k)
        print(f"{k:22} {b!s:>10} {t!s:>10} {p!s:>10}")
    print(f"\nflagged (gw,pid): {r['n_flagged']} | join coverage: "
          f"{r['coverage']['matched']} matched / {r['coverage']['unmatched']} unmatched")
    print('VERDICT:', r['verdict'])


if __name__ == '__main__':
    _print(run())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd pipeline; python -m pytest tests/test_exp12_avail.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit the code (not the json yet)**

```bash
git add pipeline/experiments/exp12_avail.py pipeline/tests/test_exp12_avail.py
git commit -m "feat(avail-01): exp12 injury-gating validation (baseline/treatment/placebo + verdict)"
```

- [ ] **Step 6: Controller runs the real validation + commits the artifact**

Run: `cd pipeline; python -m experiments.exp12_avail`
The controller reads the printed table + `VERDICT`, then commits the artifact:

```bash
git add pipeline/experiments/exp12_avail.json
git commit -m "exp(avail-01): injury-gating validation result on 2025/26 archive"
```

**Decision gate (controller, honest framing):**
- **SHIP** → proceed to Task 8 and set the recommendation to flip `AVAIL_ENABLED` on after live wiring is sanity-checked.
- **NO_SHIP** → still build Task 8 (the live wiring + shadow attach is independently useful and the flag stays off), but record the NO_SHIP honestly in memory + the readiness plan (mirror the EUR-01 treatment); do **not** recommend flipping the flag.

---

## Task 8: run.py — live wiring, shadow-first (AVAIL_ENABLED off)

**Files:**
- Modify: `pipeline/run.py` (env flags near `IS_OFF_SEASON` ~line 261; the xmins computation call site; injury-lookup construction)
- Test: behavioral (mirror the existing `run.py` flag tests, e.g. how `ODDS_ENABLED` / off-season are tested)

> First, read the relevant `run.py` sections: the env-flag block (~261), where `xmins` is computed for each element, and where fixtures for the upcoming GW are available. Follow how `ODDS_ENABLED` is already wired (build-once, env-gated, no-op default) — mirror it exactly.

- [ ] **Step 1: Write the failing test** (new file `pipeline/tests/test_run_avail_wiring.py`)

```python
# pipeline/tests/test_run_avail_wiring.py
"""AVAIL-01: live injury wiring is OFF by default (shadow-first)."""
import os
import importlib


def test_avail_enabled_defaults_off(monkeypatch):
    monkeypatch.delenv('AVAIL_ENABLED', raising=False)
    import run
    importlib.reload(run)
    assert run.AVAIL_ENABLED is False


def test_avail_enabled_reads_env_true(monkeypatch):
    monkeypatch.setenv('AVAIL_ENABLED', '1')
    import run
    importlib.reload(run)
    assert run.AVAIL_ENABLED is True
```

> If `run.py` import has side effects that make `importlib.reload` heavy, instead assert on a small pure helper `run._avail_enabled()` that reads the env — define it that way and test the helper. Match whatever pattern the existing `run.py` flag tests use.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline; python -m pytest tests/test_run_avail_wiring.py -q`
Expected: FAIL (`AVAIL_ENABLED` not defined).

- [ ] **Step 3: Implement the wiring** in `pipeline/run.py`

Near the other env flags (~line 261), add:

```python
AVAIL_ENABLED = os.environ.get('AVAIL_ENABLED', '').lower() in ('1', 'true', 'yes')  # AVAIL-01 shadow-first
```

Build the live injury lookup once, only when enabled and only in-season (no fixtures pre-season). Place this after the bootstrap/fixtures for the upcoming GW are known:

```python
    # AVAIL-01: structured injury availability (gap-fill). Shadow-first: when the
    # flag is off, attach info for inspection but DON'T let it change xmins.
    injury_lookup = None
    injury_records = []
    if not IS_OFF_SEASON:
        try:
            from injury_client import get_live_injuries
            from injury_join import build_injury_lookup
            upcoming_fixture_ids = [f['id'] for f in upcoming_gw_fixtures]  # the next GW's fixtures
            injury_records = get_live_injuries(upcoming_fixture_ids)
            built = build_injury_lookup(injury_records, bootstrap)
            if AVAIL_ENABLED:
                injury_lookup = built          # active: feeds xmins
            else:
                injury_lookup = None           # shadow: xmins unaffected
            # attach for inspection regardless of the flag
            for el in bootstrap['elements']:
                info = built.get(el['id'])
                if info:
                    el['apifootball_injury'] = info
        except Exception as exc:
            print(f'AVAIL-01: injury layer unavailable this run ({exc}); continuing')
            injury_lookup = None
```

> `upcoming_gw_fixtures` / `bootstrap` are placeholders for whatever the existing `run.py` already has in scope for the next GW. Use the real variable names found when reading `run.py`.

Then pass `injury_lookup` into the xmins computation. Find where `_compute_player_xmins` (or its batch wrapper) is called in `run.py` and add `injury_lookup=injury_lookup`.

- [ ] **Step 4: Run the test + full suite to verify pass + no regression**

Run: `cd pipeline; python -m pytest tests/test_run_avail_wiring.py -q`
Expected: PASS.

Run: `cd pipeline; python -m pytest -q`
Expected: PASS (full suite; previously 731 + the new AVAIL-01 tests, no regressions).

- [ ] **Step 5: Commit**

```bash
git add pipeline/run.py pipeline/tests/test_run_avail_wiring.py
git commit -m "feat(avail-01): shadow-first live injury wiring (AVAIL_ENABLED, default off)"
```

---

## Final verification (after all tasks)

- [ ] Full suite green: `cd pipeline; python -m pytest -q`
- [ ] `run.py` import graph unaffected when disabled: api-football imports (`injury_client`) are local to the AVAIL block, not module-level in `run.py`.
- [ ] exp12 verdict recorded honestly in `MEMORY.md` + `project_season_launch_plan.md` (SHIP → recommend flip after live sanity-check; NO_SHIP → EUR-01-style honest rejection, flag stays off).
- [ ] Dispatch the final whole-implementation code review (subagent-driven-development's final reviewer).

---

## Self-review notes (plan author)

**Spec coverage:** injury_client (§Architecture) → Task 1; injury_join + id-map + coverage (§Architecture) → Task 2; gap-fill P3 (§classifier) → Task 3; xmins thread (§xmins) → Task 4; backtest no-op hook (§validation hook) → Task 5; committed snapshot + key-free CI (§snapshot) → Task 6; exp12 baseline/treatment/placebo + verdict + leakage note (§validation) → Task 7; shadow-first AVAIL_ENABLED wiring (§live) → Task 8. Out-of-scope items (suspension split, return ramp, override, football-data.org) are not built. All spec sections map to a task.

**Placeholder scan:** every code step has complete code. The only deferred-to-implementer details are explicitly flagged (`run.py` real variable names for upcoming-GW fixtures; `_compute_player_xmins` exact signature) and instruct reading the file first — these are integration seams, not missing logic.

**Type consistency:** record dict keys (`player_id/player_name/type/reason/team_id/team_name/date`) are produced by `injury_client.parse_records` and consumed identically in `injury_join`. Lookup shapes are consistent: live `{fpl_id: {risk, reason}}`, backtest `{(gw, pid): risk}`. `classify_availability(..., injury={'risk','reason'})` matches the live lookup's value shape. `avail_out_factor`/`avail_doubt_factor` defined in `DEFAULT_PARAMS` and read via `p[...]` in `run_backtest`.
