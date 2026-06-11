# ALERT-01 Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing push system live (`npm install` materialises web-push) and add the two missing alert collectors (set-piece change, lineup doubt) to `pipeline/notify.py`.

**Architecture:** Zero new infrastructure. Two new collector functions follow the existing 4-collector pattern (pure function over cache artefacts + state; cooldown; `MAX_PER_RUN=3` cap in `run_notify`). The spec was amended after artefact inspection: PUSH-07 is a lineup-doubt alert (lineup_news has no XI/bench representation).

**Tech Stack:** Python 3.11 + pytest (collectors); npm (install fix); no UI changes.

---

## File map

| File | Change |
|---|---|
| `node_modules/web-push` | materialised by `npm install` (no manifest change) |
| `pipeline/notify.py` | 2 new collectors + state defaults + `_update_state` + collector registration |
| `pipeline/tests/test_notify.py` | new tests |
| `.planning/notes/feature-backlog.md` | ALERT-01 marked Complete |

Working directory: repo root for npm; `pipeline/` for pytest.

---

## Task 1: unblock web-push

- [ ] **Step 1**: `cd C:\Users\jamie\fplx && npm install` — expect web-push + @types/web-push to materialise (`ls node_modules/web-push/package.json node_modules/@types/web-push/package.json` both exist)
- [ ] **Step 2**: `npx tsc --noEmit` — the `src/app/api/push/send/route.ts` web-push errors are GONE. (Unrelated pre-existing errors in `SummerWindowTab.test.tsx` / `LiveGwTab.test.tsx` may remain — out of scope, report them.)
- [ ] **Step 3**: `npx vitest run src/app/api/push/` — existing push route tests pass
- [ ] **Step 4**: commit — ONLY if `package.json`/`package-lock.json` changed (they should NOT — both already declare web-push; if `npm install` modified the lockfile, inspect the diff: lockfile-format-version churn is acceptable to commit, dependency drift is not — report what you see). If no files changed, no commit (node_modules is gitignored) — note that in the report.

```bash
git add package-lock.json && git commit -m "chore(alert-01): lockfile refresh from web-push install"   # only if needed
```

---

## Task 2: PUSH-06 — set-piece change collector

**Files:** Modify `pipeline/notify.py`, `pipeline/tests/test_notify.py`

`set_piece_changes.json` shape: `{has_changes: bool, change_count: int, teams: [{team_id, team_short_name, penalty_taker: {id, name, changed}, fk_taker: {...}, corner_taker: {...}}]}`. The `changed` flag is True only on the run where the taker differs from the previous snapshot.

### Step 1: Failing tests (append to test_notify.py; mirror its existing style — `patch.object(notify, '_read_json', ...)`)

```python
SP_CHANGES = {
    'has_changes': True,
    'change_count': 1,
    'teams': [
        {'team_id': 1, 'team_short_name': 'ARS',
         'penalty_taker': {'id': 16, 'name': 'Saka', 'changed': False},
         'fk_taker': {'id': 21, 'name': 'Rice', 'changed': True},
         'corner_taker': {'id': 21, 'name': 'Rice', 'changed': False}},
    ],
}


def test_setpiece_fires_on_changed_taker():
    state = _empty_state()
    with patch.object(notify, '_read_json', return_value=SP_CHANGES):
        result = notify._collect_setpiece_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'setpiece'
    assert 'Rice' in result['body'] and 'free kicks' in result['body'] and 'ARS' in result['body']


def test_setpiece_skips_when_no_changes():
    state = _empty_state()
    quiet = {'has_changes': False, 'change_count': 0, 'teams': SP_CHANGES['teams']}
    quiet = {**quiet, 'teams': [{**SP_CHANGES['teams'][0],
                                 'fk_taker': {'id': 21, 'name': 'Rice', 'changed': False}}]}
    with patch.object(notify, '_read_json', return_value=quiet):
        assert notify._collect_setpiece_candidate(state, 'pipeline/cache') is None


def test_setpiece_does_not_refire_on_seen_identity():
    state = _empty_state()
    state['seen_setpiece_changes'] = ['1:fk_taker:21']
    with patch.object(notify, '_read_json', return_value=SP_CHANGES):
        assert notify._collect_setpiece_candidate(state, 'pipeline/cache') is None


def test_setpiece_respects_cooldown():
    state = _empty_state()
    state['last_setpiece_sent_at'] = _hours_ago(1)
    with patch.object(notify, '_read_json', return_value=SP_CHANGES):
        assert notify._collect_setpiece_candidate(state, 'pipeline/cache') is None


def test_setpiece_state_capped_at_50():
    state = _empty_state()
    state['seen_setpiece_changes'] = [f'x:{i}' for i in range(50)]
    payload = {'type': 'setpiece', 'title': 'Set-piece update', 'body': 'b',
               '_sp_identity': '1:fk_taker:21'}
    notify._update_state(state, payload)
    assert len(state['seen_setpiece_changes']) == 50
    assert state['seen_setpiece_changes'][-1] == '1:fk_taker:21'
    assert state['last_setpiece_sent_at'] is not None
```

(`_empty_state` in the test file must gain the two new default keys — `'seen_setpiece_changes': []`, `'last_setpiece_sent_at': None` — mirroring the production defaults added below; also `'benched_fired': {}` and `'last_benched_sent_at': None` for Task 3. Update the helper once, here.)

### Step 2: Verify FAIL (AttributeError: _collect_setpiece_candidate)

`cd pipeline && python -m pytest tests/test_notify.py -k setpiece -v`

### Step 3: Implement in notify.py

Add to `_load_state` defaults: `'last_setpiece_sent_at': None, 'seen_setpiece_changes': [],` (and Task 3's keys at the same time: `'last_benched_sent_at': None, 'benched_fired': {},`).

New collector (place after `_collect_captain_candidate`):

```python
ROLE_LABEL = {'penalty_taker': 'penalties', 'fk_taker': 'free kicks',
              'corner_taker': 'corners'}


def _collect_setpiece_candidate(state: dict, cache_dir: str) -> dict | None:
    """PUSH-06 (ALERT-01): set-piece taker changed."""
    if _within_cooldown(state.get('last_setpiece_sent_at')):
        return None
    try:
        changes = _read_json('set_piece_changes.json', cache_dir)
    except FileNotFoundError:
        print('[notify] set_piece_changes.json not found — skipping set-piece alert',
              file=sys.stderr)
        return None
    if not changes.get('has_changes'):
        return None
    seen = state.get('seen_setpiece_changes', [])
    for team in changes.get('teams', []):
        for role, label in ROLE_LABEL.items():
            taker = team.get(role) or {}
            if not taker.get('changed'):
                continue
            identity = f"{team.get('team_id')}:{role}:{taker.get('id')}"
            if identity in seen:
                continue
            return {
                'type':         'setpiece',
                'title':        'Set-piece update',
                'body':         f"{taker.get('name', 'Unknown')} now on {label} "
                                f"({team.get('team_short_name', '')})",
                '_sp_identity': identity,
            }
    return None
```

In `_update_state` (read it first; it branches per payload type), add:

```python
    if payload['type'] == 'setpiece':
        state['last_setpiece_sent_at'] = _now_iso()
        seen = state.get('seen_setpiece_changes', [])
        seen.append(payload['_sp_identity'])
        state['seen_setpiece_changes'] = seen[-50:]   # cap state growth
```

(Use the file's actual now-timestamp helper — read how the other branches set `last_*_sent_at` and mirror exactly; if they inline `datetime.now(timezone.utc).isoformat()`, do the same.)

Register in `run_notify`'s collectors list, after `('captain', ...)`:
```python
        ('setpiece', _collect_setpiece_candidate),
```

### Step 4: Tests pass + full suite

`cd pipeline && python -m pytest tests/test_notify.py -v` then full suite. Baseline 570; this task adds 5 → expect 575 (verify, report real number — `_empty_state` change may also touch existing tests; they should still pass since extra keys are harmless).

### Step 5: Commit

```bash
git add pipeline/notify.py pipeline/tests/test_notify.py
git commit -m "feat(alert-01): PUSH-06 set-piece change collector"
```

---

## Task 3: PUSH-07 — lineup-doubt collector

**Files:** Modify `pipeline/notify.py`, `pipeline/tests/test_notify.py`

`lineup_news.json` shape: `{scraped_at, players: [{id, availability_factor: float|null, status_label, news_headline: str|null, ...}]}`. Labels: confirmed_start/doubted/confirmed_absent/unknown.

### Step 1: Failing tests

```python
LINEUP_NEWS = {
    'scraped_at': '2026-08-20T10:00:00+00:00',
    'players': [
        {'id': 50, 'availability_factor': 0.25, 'status_label': 'doubted',
         'news_headline': 'Left out of training squad'},
        {'id': 51, 'availability_factor': 1.0, 'status_label': 'confirmed_start',
         'news_headline': None},
    ],
}

BENCH_MERGED = [
    {'id': 50, 'web_name': 'Bigname', 'status': 'a', 'selected_by_percent': '34.0'},
    {'id': 51, 'web_name': 'Starter', 'status': 'a', 'selected_by_percent': '44.0'},
]


def _benched_read_json(filename, cache_dir='pipeline/cache'):
    if filename == 'lineup_news.json':
        return LINEUP_NEWS
    if filename == 'merged_players.json':
        return BENCH_MERGED
    if filename == 'fpl_bootstrap.json':
        return {'events': [{'id': 3, 'is_next': True}]}
    raise FileNotFoundError(filename)


def test_benched_fires_for_prominent_doubt():
    state = _empty_state()
    with patch.object(notify, '_read_json', side_effect=_benched_read_json):
        result = notify._collect_benched_candidate(state, 'pipeline/cache')
    assert result is not None
    assert result['type'] == 'benched'
    assert 'Bigname' in result['body'] and 'doubted' in result['body']
    assert 'Left out of training squad' in result['body']
    assert result['_benched_key'] == '3:50'


def test_benched_ignores_low_ownership():
    state = _empty_state()
    low = [dict(BENCH_MERGED[0], selected_by_percent='19.9')]

    def rj(filename, cache_dir='pipeline/cache'):
        if filename == 'merged_players.json':
            return low
        return _benched_read_json(filename, cache_dir)

    with patch.object(notify, '_read_json', side_effect=rj):
        assert notify._collect_benched_candidate(state, 'pipeline/cache') is None


def test_benched_ignores_fpl_flagged_players():
    """status != 'a' is the injury collector's territory (no double alerts)."""
    state = _empty_state()
    flagged = [dict(BENCH_MERGED[0], status='d')]

    def rj(filename, cache_dir='pipeline/cache'):
        if filename == 'merged_players.json':
            return flagged
        return _benched_read_json(filename, cache_dir)

    with patch.object(notify, '_read_json', side_effect=rj):
        assert notify._collect_benched_candidate(state, 'pipeline/cache') is None


def test_benched_fires_once_per_gw_per_player():
    state = _empty_state()
    state['benched_fired'] = {'3:50': True}
    with patch.object(notify, '_read_json', side_effect=_benched_read_json):
        assert notify._collect_benched_candidate(state, 'pipeline/cache') is None


def test_benched_update_state_prunes_other_gws():
    state = _empty_state()
    state['benched_fired'] = {'2:99': True}
    payload = {'type': 'benched', 'title': 'Lineup alert', 'body': 'b',
               '_benched_key': '3:50'}
    notify._update_state(state, payload)
    assert state['benched_fired'] == {'3:50': True}
    assert state['last_benched_sent_at'] is not None
```

### Step 2: Verify FAIL

`cd pipeline && python -m pytest tests/test_notify.py -k benched -v`

### Step 3: Implement

```python
BENCHED_OWNERSHIP_MIN = 20.0
BENCHED_FACTOR_MAX = 0.5


def _collect_benched_candidate(state: dict, cache_dir: str) -> dict | None:
    """PUSH-07 (ALERT-01): prominent player with FPL status 'a' but lineup-news
    doubt (availability_factor <= 0.5) — the 'benched in predicted lineups'
    signal mapped onto the flat lineup_news availability feed."""
    if _within_cooldown(state.get('last_benched_sent_at')):
        return None
    try:
        lineup = _read_json('lineup_news.json', cache_dir)
        merged = _read_json('merged_players.json', cache_dir)
        bootstrap = _read_json('fpl_bootstrap.json', cache_dir)
    except FileNotFoundError as exc:
        print(f'[notify] {exc} — skipping benched alert', file=sys.stderr)
        return None
    next_gw = next((e.get('id') for e in bootstrap.get('events', [])
                    if e.get('is_next')), None)
    if next_gw is None:
        return None
    by_id = {p.get('id'): p for p in merged}
    fired = state.get('benched_fired', {})
    for entry in lineup.get('players', []):
        factor = entry.get('availability_factor')
        if factor is None or factor > BENCHED_FACTOR_MAX:
            continue
        p = by_id.get(entry.get('id'))
        if p is None or p.get('status') != 'a':
            continue   # FPL-flagged players are the injury collector's territory
        try:
            ownership = float(p.get('selected_by_percent', 0) or 0)
        except (TypeError, ValueError):
            continue
        if ownership <= BENCHED_OWNERSHIP_MIN:
            continue
        key = f"{next_gw}:{p.get('id')}"
        if key in fired:
            continue
        body = f"{p.get('web_name', 'Unknown')}: lineup doubt ({entry.get('status_label', '')})"
        headline = entry.get('news_headline')
        if headline:
            body += f' — {headline}'
        return {
            'type':         'benched',
            'title':        'Lineup alert',
            'body':         body,
            '_benched_key': key,
        }
    return None
```

`_update_state` addition:

```python
    if payload['type'] == 'benched':
        state['last_benched_sent_at'] = _now_iso_equivalent()   # mirror file convention
        key = payload['_benched_key']
        gw_prefix = key.split(':')[0] + ':'
        fired = {k: v for k, v in state.get('benched_fired', {}).items()
                 if k.startswith(gw_prefix)}
        fired[key] = True
        state['benched_fired'] = fired
```

Register after `('setpiece', ...)` in `run_notify`:
```python
        ('benched', _collect_benched_candidate),
```

### Step 4: Priority test

Extend `_all_triggers_read_json` so all SIX types qualify (add `set_piece_changes.json` → `SP_CHANGES` and `lineup_news.json`/the bench data; `fpl_bootstrap.json` must serve BOTH the deadline event and `is_next` — merge into one dict: `{'events': [{'id': 38, 'name': 'Gameweek 38', 'deadline_time': ..., 'is_next': True}]}`) and add:

```python
def test_priority_order_six_candidates_top3_sent():
    sent = []

    def mock_send(payload, base_url):
        sent.append(payload['type'])
        return 200

    with patch.object(notify, '_read_json', side_effect=_all_triggers_read_json), \
         patch.object(notify, '_send', side_effect=mock_send), \
         patch.object(notify, '_save_state'):
        notify.run_notify(cache_dir='pipeline/cache')

    assert sent == ['price', 'injury', 'deadline']
```

(Collector registration order is price, injury, deadline, captain, setpiece, benched — the spec's "deadline → injury → price" priority phrasing describes urgency, but the EXISTING code order is price, injury, deadline, captain and behaviour must not change; new types go last. The assertion pins the existing order with new types excluded by the cap.)

### Step 5: Full suite + commit

Expect 575 + 6 = 581 (verify, report the real count).

```bash
git add pipeline/notify.py pipeline/tests/test_notify.py
git commit -m "feat(alert-01): PUSH-07 lineup-doubt collector + 6-type priority cap"
```

---

## Task 4: backlog bookkeeping

Edit `.planning/notes/feature-backlog.md` ALERT-01 entry: change the Implementation line to `**Implementation:** COMPLETE 2026-06-11 — web push (Phases 134/135 infra + PUSH-06/07 collectors). Email descoped. See docs/superpowers/specs/2026-06-11-alert01-completion-design.md.` and tick/mark the entry like other completed entries in that file (read how others are marked first).

```bash
git add .planning/notes/feature-backlog.md
git commit -m "docs(alert-01): mark backlog entry complete"
```

(Note: `.planning/` is gitignored — if `git add` refuses, the edit still stands locally; report and skip the commit.)

---

## Self-review notes

- Spec coverage: install fix ✓ (T1), PUSH-06 ✓ (T2, incl. seen-cap 50 + cooldown), PUSH-07 as amended ✓ (T3: >20% own + status 'a' + factor ≤0.5 + per-GW dedupe + prune + headline), priority/cap ✓ (T3 S4), backlog ✓ (T4), no UI/email ✓.
- Spec phrase "deadline → injury → price → captain" vs existing code order (price, injury, deadline, captain): plan preserves the EXISTING order and documents this (behaviour-preserving beats spec prose; new types appended last either way).
- Type consistency: `_sp_identity`/`_benched_key` produced by collectors, consumed by `_update_state` branches; state keys match `_load_state` defaults and `_empty_state` test helper.
- `_now_iso_equivalent()` is a placeholder NAME only in this plan's sketch: the implementer MUST mirror the file's real timestamp convention (read `_update_state`'s existing branches) — flagged in both tasks.
