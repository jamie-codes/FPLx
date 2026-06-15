# Season-Transition Verification Harness (STH-01) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-command, fully-isolated harness that runs the pipeline against a synthetic 2026/27 bootstrap and hard-asserts the off-season→live flip is clean, plus a coverage report naming which clubs need adding to the four hardcoded alias/asset tables.

**Architecture:** One module `pipeline/season_transition_smoke.py` with three units — a synthetic-transition generator (mutates the committed 2025/26 archive), an isolated pipeline runner (monkeypatches `run`'s fetchers + side-effects + output dir, runs `run.run()` in a temp dir), and a team-table coverage report (Python imports + TS-key extraction). `run_smoke()` orchestrates; a `__main__` CLI prints results and sets exit code.

**Tech Stack:** Python 3.11, pytest, stdlib (`copy`, `tempfile`, `re`, `os`). PowerShell shell; tests `cd pipeline; python -m pytest -q`.

**Spec:** `docs/superpowers/specs/2026-06-15-season-transition-harness-design.md` (authoritative — read it).

**Key facts (verified):**
- `IS_OFF_SEASON = not any(e.get('is_current') for e in events)` (run.py:261-262).
- `capture_season.season_label(bootstrap)` reads `events[0]['deadline_time'][:4]` → `"2026-27"` for a 2026-08 deadline (capture_season.py:70-86).
- COLD-01 `_build_cold_start_prior()` loads the committed `season_2025_26` archive regardless of current label (run.py:198-223) → engages at GW1 with zeroed current stats.
- Output seam: `save()` (from `upload`) writes to `pipeline/cache` when `USE_BLOB!=true`; `run._get_cache_dir()` returns `'pipeline/cache'` (run.py:30-32). Isolate by monkeypatching `run.save` and `run._get_cache_dir` to a temp dir.
- Injection seam: `run` imports `get_bootstrap_static`, `get_fixtures`, `get_element_summary`, `get_understat_players` at module top — monkeypatch on the `run` module namespace.
- The four at-risk tables: `TEAM_BADGE_CODE` + `TEAM_COLOURS` (`src/lib/team-colours.ts`, keyed by short_name), `FOOTBALL_DATA_TO_FPL` (`odds_join.py`), `WIKI_CLUB_TO_FPL` (`confirmed_transfers.py`).

**Project rules:** No `Co-Authored-By`. Do NOT push. Commit per task. Changes only add a new module + tests — no pipeline behaviour change.

---

### Task 1: Synthetic transition generator

**Files:**
- Create: `pipeline/season_transition_smoke.py` (this task adds `build_synthetic_transition` + helpers)
- Test: `pipeline/tests/test_season_transition_smoke.py`

`build_synthetic_transition(archive) -> dict` deep-copies the archive bootstrap and returns `{'bootstrap_offseason', 'bootstrap_live', 'fixtures', 'summaries', 'new_short_names'}`.

- [ ] **Step 1: Write the failing tests:**

```python
# pipeline/tests/test_season_transition_smoke.py
import copy
from capture_season import load_season_archive, season_label
from season_transition_smoke import build_synthetic_transition

_ARCHIVE = load_season_archive()


def test_synthetic_bumps_season_label_to_2026_27():
    syn = build_synthetic_transition(_ARCHIVE)
    assert season_label(syn['bootstrap_live']) == '2026-27'
    assert season_label(syn['bootstrap_offseason']) == '2026-27'


def test_offseason_has_no_current_event_live_has_gw1_current():
    syn = build_synthetic_transition(_ARCHIVE)
    off = syn['bootstrap_offseason']['events']
    live = syn['bootstrap_live']['events']
    assert not any(e.get('is_current') for e in off)
    assert any(e.get('is_current') for e in live)
    assert all(not e.get('finished') for e in live)  # 0 finished GWs


def test_three_clubs_swapped_with_novel_short_names():
    syn = build_synthetic_transition(_ARCHIVE)
    teams = syn['bootstrap_live']['teams']
    assert len(teams) == 20
    shorts = {t['short_name'] for t in teams}
    assert set(syn['new_short_names']) <= shorts
    assert set(syn['new_short_names']) == {'XYZ', 'QQQ', 'ZZZ'}
    # every player references a team that exists
    team_ids = {t['id'] for t in teams}
    for el in syn['bootstrap_live']['elements']:
        assert el['team'] in team_ids


def test_current_stats_zeroed_for_coldstart():
    syn = build_synthetic_transition(_ARCHIVE)
    for el in syn['bootstrap_live']['elements']:
        assert int(el.get('minutes', 0)) == 0
        assert float(el.get('expected_goals', 0) or 0) == 0.0
        assert int(el.get('total_points', 0)) == 0


def test_fixtures_are_gw1_future_unfinished():
    syn = build_synthetic_transition(_ARCHIVE)
    assert syn['fixtures'], 'must produce fixtures'
    for f in syn['fixtures']:
        assert f['event'] == 1
        assert f['finished'] is False
        assert f.get('team_h_score') is None
        assert 'kickoff_time' in f
```

- [ ] **Step 2: Run, verify fail** (module missing). `cd pipeline; python -m pytest tests/test_season_transition_smoke.py -q`.

- [ ] **Step 3: Implement the generator** in `pipeline/season_transition_smoke.py`:

```python
"""STH-01: season-transition verification harness.

Runs the pipeline against a synthetic 2026/27 bootstrap (mutated from the committed
2025/26 archive) and hard-asserts the off-season->live flip is clean, plus reports
which clubs are missing from the four hardcoded alias/asset tables. Fully isolated:
temp output dir, all fetchers + side-effects stubbed, no network, no Blob.

CLI:  cd pipeline; python -m season_transition_smoke
"""
import copy
import os
import re
import tempfile

_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_MODULE_DIR)
_NEW_SHORT_NAMES = ['XYZ', 'QQQ', 'ZZZ']

# Element fields zeroed so the current season reads as "no data yet" (COLD-01 engages).
_ZERO_INT_FIELDS = ('minutes', 'starts', 'total_points', 'goals_scored', 'assists',
                    'bonus', 'bps', 'clean_sheets', 'goals_conceded', 'saves')
_ZERO_STR_FIELDS = ('expected_goals', 'expected_assists', 'expected_goals_per_90',
                    'expected_assists_per_90', 'form', 'points_per_game',
                    'expected_goals_conceded')


def build_synthetic_transition(archive: dict) -> dict:
    """Mutate the 2025/26 archive into 2026/27-shaped synthetic data."""
    boot = copy.deepcopy(archive['bootstrap'])

    # --- season bump: first event deadline -> 2026-08 so season_label == 2026-27 ---
    events = boot.get('events', [])
    if events:
        events[0]['deadline_time'] = '2026-08-14T17:30:00Z'

    # --- swap 3 clubs: relegate the 3 highest team ids, add 3 fabricated clubs ---
    teams = sorted(boot['teams'], key=lambda t: t['id'])
    dropped = teams[-3:]
    kept = teams[:-3]
    max_id = max(t['id'] for t in teams)
    max_code = max(t.get('code', 0) for t in teams)
    new_teams = []
    for i, sn in enumerate(_NEW_SHORT_NAMES):
        new_teams.append({
            'id': max_id + 1 + i,
            'code': max_code + 1 + i,
            'name': f'Promoted Club {sn}',
            'short_name': sn,
            'strength': 3,
        })
    boot['teams'] = kept + new_teams
    # reassign players from dropped clubs to the new clubs (round-robin)
    dropped_ids = [t['id'] for t in dropped]
    new_ids = [t['id'] for t in new_teams]
    reassign = {old: new_ids[i % len(new_ids)] for i, old in enumerate(dropped_ids)}

    # --- zero current-season element stats; reassign relegated players ---
    for el in boot.get('elements', []):
        if el.get('team') in reassign:
            el['team'] = reassign[el['team']]
        for f in _ZERO_INT_FIELDS:
            if f in el:
                el[f] = 0
        for f in _ZERO_STR_FIELDS:
            if f in el:
                el[f] = '0.0'

    # --- two gate states ---
    boot_off = copy.deepcopy(boot)
    for e in boot_off.get('events', []):
        e['is_current'] = False
        e['is_next'] = (e.get('id') == 1)
        e['finished'] = False

    boot_live = copy.deepcopy(boot)
    for e in boot_live.get('events', []):
        e['is_current'] = (e.get('id') == 1)
        e['is_next'] = (e.get('id') == 2)
        e['finished'] = False

    # --- GW1 fixtures: pair the 20 teams, future kickoff, unfinished ---
    team_ids = [t['id'] for t in boot['teams']]
    fixtures = []
    for i in range(0, len(team_ids) - 1, 2):
        fixtures.append({
            'id': 1000 + i,
            'event': 1,
            'team_h': team_ids[i],
            'team_a': team_ids[i + 1],
            'team_h_difficulty': 3,
            'team_a_difficulty': 3,
            'kickoff_time': '2026-08-15T14:00:00Z',
            'finished': False,
            'team_h_score': None,
            'team_a_score': None,
        })

    # --- summaries: empty current history (prior comes from the 2025/26 archive) ---
    summaries = {el['id']: {'history': [], 'history_past': []}
                 for el in boot.get('elements', [])}

    return {
        'bootstrap_offseason': boot_off,
        'bootstrap_live': boot_live,
        'fixtures': fixtures,
        'summaries': summaries,
        'new_short_names': list(_NEW_SHORT_NAMES),
    }
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_season_transition_smoke.py -q`.
- [ ] **Step 5: Commit.**
```bash
git add pipeline/season_transition_smoke.py pipeline/tests/test_season_transition_smoke.py
git commit -m "feat(sth-01): synthetic 2026/27 transition generator"
```

---

### Task 2: Team-table coverage report

**Files:**
- Modify: `pipeline/season_transition_smoke.py` (add `coverage_report` + `_extract_ts_record_keys`)
- Test: `pipeline/tests/test_season_transition_smoke.py` (add cases)

- [ ] **Step 1: Write the failing tests:**

```python
def test_extract_ts_record_keys_reads_team_colours():
    from season_transition_smoke import _extract_ts_record_keys, _TEAM_COLOURS_TS
    badge = _extract_ts_record_keys(_TEAM_COLOURS_TS, 'TEAM_BADGE_CODE')
    colours = _extract_ts_record_keys(_TEAM_COLOURS_TS, 'TEAM_COLOURS')
    assert 'ARS' in badge and 'LIV' in badge      # known real entries
    assert 'ARS' in colours and 'MUN' in colours
    assert 'XYZ' not in badge                       # fabricated club absent


def test_coverage_report_flags_fabricated_clubs():
    from season_transition_smoke import build_synthetic_transition, coverage_report
    from capture_season import load_season_archive
    syn = build_synthetic_transition(load_season_archive())
    rep = coverage_report(syn['bootstrap_live'])
    # all four tables present in the report
    assert set(rep) == {'TEAM_BADGE_CODE', 'TEAM_COLOURS',
                        'FOOTBALL_DATA_TO_FPL', 'WIKI_CLUB_TO_FPL'}
    # the 3 fabricated clubs are missing from the short-name-keyed asset tables
    for sn in ('XYZ', 'QQQ', 'ZZZ'):
        assert sn in rep['TEAM_BADGE_CODE']
        assert sn in rep['TEAM_COLOURS']
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** (append to `season_transition_smoke.py`):

```python
# Read the TS asset tables once at import (repo-root-relative).
_TEAM_COLOURS_TS_PATH = os.path.join(_REPO_ROOT, 'src', 'lib', 'team-colours.ts')
try:
    with open(_TEAM_COLOURS_TS_PATH, encoding='utf-8') as _f:
        _TEAM_COLOURS_TS = _f.read()
except OSError:
    _TEAM_COLOURS_TS = ''


def _extract_ts_record_keys(ts_text: str, record_name: str) -> set:
    """Extract the literal keys of a `const <record_name> ... = { KEY: ... }` object.
    Keys are short_name codes (2-4 uppercase letters), possibly quoted."""
    # isolate from `record_name` to the matching closing brace (greedy to last '};' of block)
    m = re.search(record_name + r'\b[^=]*=\s*\{(.*?)\n\}', ts_text, re.DOTALL)
    body = m.group(1) if m else ''
    # keys at line starts: optional quote, 2-4 uppercase letters, optional quote, colon
    return set(re.findall(r"['\"]?([A-Z]{2,4})['\"]?\s*:", body))


def coverage_report(bootstrap: dict) -> dict:
    """For each of the 4 hardcoded tables, list bootstrap clubs missing from it.
    Returns {table_name: [missing short_name, ...]} (short_name for asset tables,
    FPL name for the alias tables)."""
    from odds_join import FOOTBALL_DATA_TO_FPL
    from confirmed_transfers import WIKI_CLUB_TO_FPL

    teams = bootstrap.get('teams', [])
    shorts = [t['short_name'] for t in teams]
    names = [t['name'] for t in teams]

    badge_keys = _extract_ts_record_keys(_TEAM_COLOURS_TS, 'TEAM_BADGE_CODE')
    colour_keys = _extract_ts_record_keys(_TEAM_COLOURS_TS, 'TEAM_COLOURS')

    # alias tables: a club is "covered" if its FPL name appears as an alias value/target
    fd_targets = {v.lower() for v in FOOTBALL_DATA_TO_FPL.values()}
    wiki_targets = {v.lower() for v in WIKI_CLUB_TO_FPL.values()}

    return {
        'TEAM_BADGE_CODE': sorted(sn for sn in shorts if sn not in badge_keys),
        'TEAM_COLOURS': sorted(sn for sn in shorts if sn not in colour_keys),
        'FOOTBALL_DATA_TO_FPL': sorted(n for n in names if n.lower() not in fd_targets),
        'WIKI_CLUB_TO_FPL': sorted(n for n in names if n.lower() not in wiki_targets),
    }
```

NOTE: the alias-table "covered" heuristic (FPL name appears as an alias *value*) is intentionally loose — these tables map *source* names → FPL names, so a club is reachable iff its FPL name is a target. A club missing here means "no source-name alias maps to it"; at launch, verify the real promoted clubs' source names are added. This may flag some existing clubs whose FPL name isn't a literal alias target — acceptable for a WARN report (it errs toward over-reporting, which is safe for a checklist).

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**
```bash
git add pipeline/season_transition_smoke.py pipeline/tests/test_season_transition_smoke.py
git commit -m "feat(sth-01): team-table coverage report (badge/colour/odds/transfers)"
```

---

### Task 3: Isolated pipeline runner + hard assertions + entry points

**Files:**
- Modify: `pipeline/season_transition_smoke.py` (add `_run_pipeline_isolated`, `_hard_checks`, `run_smoke`, `__main__`)
- Test: `pipeline/tests/test_season_transition_smoke.py` (add cases)

- [ ] **Step 1: Write the failing tests:**

```python
def test_run_smoke_passes_on_synthetic_transition(tmp_path):
    from season_transition_smoke import run_smoke
    result = run_smoke()
    assert result['ok'] is True, result['hard_checks']
    hc = result['hard_checks']
    assert hc['no_exception'] is True
    assert hc['offseason_gate'] is True       # IS_OFF_SEASON True for offseason boot
    assert hc['live_gate'] is True            # IS_OFF_SEASON False for live boot
    assert hc['season_label'] is True
    assert hc['artefacts_present'] is True
    assert hc['no_unknown_team'] is True
    assert hc['coldstart_engaged'] is True
    assert 'coverage' in result


def test_run_smoke_detects_unknown_team(tmp_path):
    # a player on a non-existent team id must trip no_unknown_team
    from season_transition_smoke import run_smoke, build_synthetic_transition
    from capture_season import load_season_archive
    syn = build_synthetic_transition(load_season_archive())
    syn['bootstrap_live']['elements'][0]['team'] = 9999  # orphan team id
    result = run_smoke(bootstrap=syn['bootstrap_live'], fixtures=syn['fixtures'],
                       summaries=syn['summaries'], _offseason_bootstrap=syn['bootstrap_offseason'])
    assert result['hard_checks']['no_unknown_team'] is False
    assert result['ok'] is False


def test_run_smoke_writes_nothing_to_real_cache(tmp_path):
    import os
    before = set(os.listdir('pipeline/cache')) if os.path.isdir('pipeline/cache') else set()
    from season_transition_smoke import run_smoke
    run_smoke()
    after = set(os.listdir('pipeline/cache')) if os.path.isdir('pipeline/cache') else set()
    assert before == after, 'smoke must not write to the real cache'
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** (append to `season_transition_smoke.py`). The runner monkeypatches the `run` module namespace, redirects output to a temp dir, and neutralizes outbound side-effects. **If `run.run()` raises on an un-stubbed network/side-effect call, add that name to `_neutralize` — the `no_exception` check will surface it.**

```python
import json


# Expected not-off-season artefacts that must exist + be non-empty after a live run.
_EXPECTED_ARTEFACTS = [
    'fpl_bootstrap.json', 'fpl_fixtures.json', 'merged_players.json',
    'captain_picks.json', 'insights.json', 'gw_intel.json',
    'defcon_stats.json', 'last_updated.json', 'data_health.json',
]


def _run_pipeline_isolated(bootstrap, fixtures, summaries, tmp_dir) -> dict:
    """Run run.run() against synthetic data in tmp_dir. Returns {'raised': exc-or-None}."""
    import run as run_mod
    from upload import save_local

    saved = {}
    # data fetchers
    saved['get_bootstrap_static'] = run_mod.get_bootstrap_static
    saved['get_fixtures'] = run_mod.get_fixtures
    saved['get_element_summary'] = run_mod.get_element_summary
    saved['get_understat_players'] = run_mod.get_understat_players
    saved['save'] = run_mod.save
    saved['_get_cache_dir'] = run_mod._get_cache_dir

    run_mod.get_bootstrap_static = lambda: bootstrap
    run_mod.get_fixtures = lambda: fixtures
    run_mod.get_element_summary = lambda pid: summaries.get(pid, {'history': [], 'history_past': []})
    run_mod.get_understat_players = lambda: {}
    run_mod.save = lambda name, data: save_local(name, data, cache_dir=tmp_dir)
    run_mod._get_cache_dir = lambda: tmp_dir

    # neutralize outbound side-effects (network/push/scrape) that run always.
    # Each maps an attribute on run_mod to a no-op; restored in finally.
    neutralize = {
        'run_notify': (lambda *a, **k: None),
    }
    for attr, stub in list(neutralize.items()):
        if hasattr(run_mod, attr):
            saved[attr] = getattr(run_mod, attr)
            setattr(run_mod, attr, stub)

    # env: force local writes, disable env-gated scrapers
    prev_env = {k: os.environ.get(k) for k in
                ('USE_BLOB', 'TRANSFER_NEWS_ENABLED', 'CONFIRMED_TRANSFERS_ENABLED')}
    os.environ['USE_BLOB'] = 'false'
    os.environ['TRANSFER_NEWS_ENABLED'] = 'false'
    os.environ['CONFIRMED_TRANSFERS_ENABLED'] = 'false'

    raised = None
    try:
        run_mod.run()
    except Exception as e:  # noqa: BLE001 — the harness reports any crash as a hard fail
        raised = e
    finally:
        for k, v in saved.items():
            setattr(run_mod, k, v)
        for k, v in prev_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    return {'raised': raised}


def _hard_checks(syn, tmp_dir, run_result, archive) -> dict:
    import run as run_mod

    checks = {}
    checks['no_exception'] = run_result['raised'] is None

    # gate flip — compute the same condition run.py uses
    def off(b):
        return not any(e.get('is_current') for e in b.get('events', []))
    checks['offseason_gate'] = off(syn['bootstrap_offseason']) is True
    checks['live_gate'] = off(syn['bootstrap_live']) is False

    from capture_season import season_label
    checks['season_label'] = season_label(syn['bootstrap_live']) == '2026-27'

    def _load(name):
        p = os.path.join(tmp_dir, name)
        if not os.path.exists(p) or os.path.getsize(p) == 0:
            return None
        with open(p, encoding='utf-8') as f:
            return json.load(f)

    checks['artefacts_present'] = all(_load(n) is not None for n in _EXPECTED_ARTEFACTS)

    merged = _load('merged_players.json') or []
    valid_shorts = {t['short_name'] for t in syn['bootstrap_live']['teams']}
    checks['no_unknown_team'] = bool(merged) and all(
        p.get('team_short_name') in valid_shorts for p in merged)

    # COLD-01: >=1 returning player (in the 2025/26 archive by code) has non-zero xg/xmins
    prior_codes = {el.get('code') for el in archive['bootstrap'].get('elements', [])}
    checks['coldstart_engaged'] = any(
        p.get('code') in prior_codes and (p.get('xg_per90') or 0) > 0 and (p.get('xmins') or 0) > 0
        for p in merged)

    return checks


def run_smoke(bootstrap=None, fixtures=None, summaries=None, _offseason_bootstrap=None) -> dict:
    """Run the season-transition smoke. With no args, builds the synthetic transition.
    Returns {'hard_checks': {...}, 'coverage': {...}, 'ok': bool}."""
    from capture_season import load_season_archive
    archive = load_season_archive()
    if bootstrap is None:
        syn = build_synthetic_transition(archive)
    else:
        syn = {'bootstrap_live': bootstrap, 'bootstrap_offseason': _offseason_bootstrap or bootstrap,
               'fixtures': fixtures or [], 'summaries': summaries or {},
               'new_short_names': []}

    with tempfile.TemporaryDirectory() as tmp_dir:
        run_result = _run_pipeline_isolated(
            syn['bootstrap_live'], syn['fixtures'], syn['summaries'], tmp_dir)
        checks = _hard_checks(syn, tmp_dir, run_result, archive)

    coverage = coverage_report(syn['bootstrap_live'])
    ok = all(checks.values())
    return {'hard_checks': checks, 'coverage': coverage, 'ok': ok,
            'exception': repr(run_result['raised']) if run_result['raised'] else None}


def _print_report(result: dict) -> None:
    print('=== Season-Transition Smoke — hard checks ===')
    for name, ok in result['hard_checks'].items():
        print(f'  [{"PASS" if ok else "FAIL"}] {name}')
    if result.get('exception'):
        print(f'  exception: {result["exception"]}')
    print('=== LAUNCH CHECKLIST — clubs missing from alias/asset tables (WARN) ===')
    for table, missing in result['coverage'].items():
        print(f'  {table}: {missing if missing else "(all covered)"}')
    print(f'=== OVERALL: {"OK" if result["ok"] else "FAIL"} ===')


if __name__ == '__main__':
    import sys
    res = run_smoke()
    _print_report(res)
    sys.exit(0 if res['ok'] else 1)
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_season_transition_smoke.py -q`. If `no_exception` is False, read `result['exception']`: if it's an un-stubbed network/side-effect call (e.g. a scraper or push), add its function name to `neutralize` in `_run_pipeline_isolated` and re-run. If it's a genuine pipeline boundary bug (e.g. a step crashing at 0 finished GWs), STOP and report it as DONE_WITH_CONCERNS — that is a real finding the harness exists to catch (do NOT paper over it by stubbing the failing pipeline step; only stub external I/O).
- [ ] **Step 5: Commit.**
```bash
git add pipeline/season_transition_smoke.py pipeline/tests/test_season_transition_smoke.py
git commit -m "feat(sth-01): isolated pipeline runner + hard checks + run_smoke CLI"
```

---

### Task 4: Run the harness for real + full-suite verification

- [ ] **Step 1:** Run the harness end-to-end: `cd pipeline; python -m season_transition_smoke`. Capture the full printed report (hard checks + launch checklist). Expected: all hard checks PASS; the checklist flags `XYZ/QQQ/ZZZ` (and possibly some real clubs whose alias names aren't literal targets — that's the loose-heuristic WARN, acceptable).
- [ ] **Step 2:** If any hard check FAILS, diagnose per Task 3 Step 4 (external I/O → add stub; genuine boundary bug → report as a concern, do not mask).
- [ ] **Step 3:** Run the full suite: `cd pipeline; python -m pytest -q`. All green.
- [ ] **Step 4:** Report to the controller: the harness report verbatim, whether any genuine pipeline boundary bug was surfaced (vs just external-I/O stubs added), and the full pytest summary.
- [ ] **Step 5:** Commit any fixups.
```bash
git add -A pipeline/
git commit -m "test(sth-01): season-transition smoke green end-to-end"
```

---

## Out of scope (do NOT build here)
- Fixing alias-table gaps (real promoted clubs unknown; launch-day task driven by the report).
- Wiring launch-day live-API execution (the harness already accepts a real bootstrap via `run_smoke(bootstrap=...)`).
- Changing pipeline transition behaviour. If Task 3/4 surfaces a genuine boundary crash, report it — fixing it is a separate follow-up.
- Any UI change.
