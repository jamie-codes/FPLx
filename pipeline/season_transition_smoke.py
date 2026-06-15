"""STH-01: season-transition verification harness.

Runs the pipeline against a synthetic 2026/27 bootstrap (mutated from the committed
2025/26 archive) and hard-asserts the off-season->live flip is clean, plus reports
which clubs are missing from the four hardcoded alias/asset tables. Fully isolated:
temp output dir, all fetchers + side-effects stubbed, no network, no Blob.

CLI:  cd pipeline; python -m season_transition_smoke
"""
import copy
import json
import os
import re
import sys
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


# Expected not-off-season artefacts that must exist + be non-empty after a live run.
_EXPECTED_ARTEFACTS = [
    'fpl_bootstrap.json', 'fpl_fixtures.json', 'merged_players.json',
    'captain_picks.json', 'insights.json', 'gw_intel.json',
    'defcon_stats.json', 'last_updated.json', 'data_health.json',
    'set_piece_changes.json', 'predictions_snapshot.json',
]


def _run_pipeline_isolated(bootstrap, fixtures, summaries, tmp_dir) -> dict:
    """Run run.run() against synthetic data in tmp_dir. Returns {'raised': exc-or-None}."""
    # Import every module we patch BEFORE applying any patch, so an import failure
    # can never leave a partially-applied (leaked) monkeypatch before the try/finally.
    import run as run_mod
    import upload as upload_mod
    import notify as notify_mod
    import lineup_news as lineup_news_mod
    from upload import save_local

    def _save_to_tmp(name, data):
        save_local(name, data, cache_dir=tmp_dir)

    saved = {}
    # data fetchers — monkeypatched on the run module namespace
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
    run_mod.save = _save_to_tmp
    run_mod._get_cache_dir = lambda: tmp_dir

    # Also patch upload.save directly so the run module and any module that
    # re-resolves upload.save at call time (e.g. data_health's function-local
    # `from upload import save`) write to tmp_dir rather than the real cache.
    saved['upload_save'] = upload_mod.save
    upload_mod.save = _save_to_tmp

    # neutralize outbound side-effects (network/push/scrape) that run always.
    # run_notify is imported locally inside run.run() so we monkeypatch notify module directly.
    # compute_lineup_news makes HTTP calls and is not env-gated, so stub at module level.
    saved['notify_run_notify'] = notify_mod.run_notify
    notify_mod.run_notify = lambda *a, **k: None

    saved['lineup_news_compute_lineup_news'] = lineup_news_mod.compute_lineup_news
    lineup_news_mod.compute_lineup_news = lambda *a, **k: None

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
            if k == 'notify_run_notify':
                notify_mod.run_notify = v
            elif k == 'lineup_news_compute_lineup_news':
                lineup_news_mod.compute_lineup_news = v
            elif k == 'upload_save':
                upload_mod.save = v
            else:
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
        p.get('code') and p['code'] in prior_codes
        and (p.get('xg_per90') or 0) > 0 and (p.get('xmins') or 0) > 0
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
    res = run_smoke()
    _print_report(res)
    sys.exit(0 if res['ok'] else 1)
