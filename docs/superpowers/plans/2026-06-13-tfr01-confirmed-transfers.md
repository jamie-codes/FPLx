# TFR-01: Confirmed Transfers Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Confirmed Transfers" tab — pipeline scrapes Wikipedia's current-window English transfer list, filters to PL-club deals, UI shows pltransfers-style (grouped-by-club + chronological toggle), cross-linking the existing Summer Window feed for rumours.

**Architecture:** Clone of the WIN-01 `transfer_news` chain: scraper (`pipeline/confirmed_transfers.py`) → `transfers_confirmed.json` → `/api/transfers` → `useConfirmedTransfers` → `ConfirmedTransfersTab` in the Planning nav group. The spec (`docs/superpowers/specs/2026-06-13-tfr01-confirmed-transfers-design.md`) is BINDING — its JSON shape, alias rules, states, and out-of-scope govern.

**Tech Stack:** Python 3.11 + requests + BeautifulSoup(lxml) + pytest; Next 16 client component + UIX-01 primitives/tokens + Vitest/RTL + Playwright.

**MANDATORY pre-reading:** the spec; `pipeline/transfer_news.py` + `pipeline/lineup_news.py` (scraper templates); `src/app/api/transfer-news/route.ts`, `src/lib/hooks/useTransferNews.ts`, `src/components/news/SummerWindowTab.tsx` (UI templates); `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` for the tab. New UI = tokens only (no zinc/gray/hex), keep tsc at 0, contrast-check green.

---

## Task 1: scraper — parse, filter, shape (pipeline-only, TDD)

**Files:** Create `pipeline/confirmed_transfers.py`, `pipeline/tests/test_confirmed_transfers.py`.

### Step 1: Write failing tests

`pipeline/tests/test_confirmed_transfers.py` — uses an inline fixture HTML snippet (no network):

```python
"""TFR-01 confirmed-transfers scraper tests — no network (HTML fixtures)."""
import confirmed_transfers as ct

BOOTSTRAP = {'teams': [
    {'id': 1, 'name': 'Arsenal', 'short_name': 'ARS', 'code': 3},
    {'id': 12, 'name': 'Wolves', 'short_name': 'WOL', 'code': 39},
    {'id': 17, 'name': 'Spurs', 'short_name': 'TOT', 'code': 6},
]}

# Permanent table (5 cols: Date, Player, From, To, Fee) + Loans table
FIXTURE_HTML = """
<table class="wikitable">
<tr><th>Date</th><th>Player</th><th>Moving from</th><th>Moving to</th><th>Fee</th></tr>
<tr><td>1 July 2026</td><td><a>Player One</a></td><td><a>Wolverhampton Wanderers</a></td><td><a>Arsenal</a></td><td>£40m</td></tr>
<tr><td>2 July 2026</td><td><a>Player Two</a></td><td><a>Arsenal</a></td><td><a>Real Madrid</a></td><td>Undisclosed</td></tr>
<tr><td>3 July 2026</td><td><a>Player Three</a></td><td><a>Luton Town</a></td><td><a>Reading</a></td><td>Free</td></tr>
</table>
<h3>Loans</h3>
<table class="wikitable">
<tr><th>Date</th><th>Player</th><th>Moving from</th><th>Moving to</th><th>Fee</th></tr>
<tr><td>4 July 2026</td><td><a>Player Four</a></td><td><a>Tottenham Hotspur</a></td><td><a>Burnley</a></td><td>Loan</td></tr>
</table>
"""


def test_resolve_alias_and_exact():
    lookup = ct._build_team_lookup(BOOTSTRAP)
    assert ct._resolve('Wolverhampton Wanderers', lookup)['short_name'] == 'WOL'  # alias
    assert ct._resolve('Arsenal', lookup)['short_name'] == 'ARS'                  # exact
    assert ct._resolve('Real Madrid', lookup) is None                            # non-PL


def test_parse_filters_to_pl_and_tags_loans():
    rows = ct._parse_transfers(FIXTURE_HTML, ct._build_team_lookup(BOOTSTRAP))
    # Row 3 (Luton->Reading, neither PL) dropped; rows 1,2,4 kept
    assert len(rows) == 3
    perm = [r for r in rows if r['kind'] == 'permanent']
    loan = [r for r in rows if r['kind'] == 'loan']
    assert len(perm) == 2 and len(loan) == 1
    assert loan[0]['player'] == 'Player Four'


def test_build_payload_groups_and_chronology():
    rows = ct._parse_transfers(FIXTURE_HTML, ct._build_team_lookup(BOOTSTRAP))
    payload = ct._build_payload(rows, BOOTSTRAP, window='summer_2026',
                                source_url='http://x', now_iso='2026-07-05T00:00:00+00:00')
    groups = {g['team_short_name']: g for g in payload['groups']}
    # Arsenal: in = Player One (from Wolves), out = Player Two (to Real Madrid)
    assert [d['player'] for d in groups['ARS']['ins']] == ['Player One']
    assert [d['player'] for d in groups['ARS']['outs']] == ['Player Two']
    # Wolves: out = Player One (PL->PL appears as out for seller)
    assert [d['player'] for d in groups['WOL']['outs']] == ['Player One']
    # chronological newest-first
    dates = [d['date'] for d in payload['chronological']]
    assert dates == sorted(dates, reverse=True)
    assert payload['counts']['deals'] == 3 and payload['counts']['loans'] == 1


def test_window_url_by_month():
    assert 'summer_2026' in ct._current_window_url(7, 2026)
    assert 'winter' in ct._current_window_url(12, 2026)
    assert 'winter' in ct._current_window_url(1, 2027)


def test_empty_guard_skips_save(monkeypatch):
    saved = {}
    monkeypatch.setattr(ct, 'save', lambda k, v: saved.setdefault(k, v))
    monkeypatch.setattr(ct, '_fetch_html', lambda url: '<html></html>')  # no tables -> empty
    monkeypatch.setenv('CONFIRMED_TRANSFERS_ENABLED', 'true')
    ct.compute_confirmed_transfers(BOOTSTRAP)
    assert 'transfers_confirmed.json' not in saved


def test_gate_off_returns_early(monkeypatch):
    called = {}
    monkeypatch.setattr(ct, '_fetch_html', lambda url: called.setdefault('fetched', True) or '')
    monkeypatch.delenv('CONFIRMED_TRANSFERS_ENABLED', raising=False)
    ct.compute_confirmed_transfers(BOOTSTRAP)
    assert 'fetched' not in called
```

### Step 2: Run — expect fail (ModuleNotFoundError)
`cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_confirmed_transfers.py -q` → FAIL.

### Step 3: Implement `pipeline/confirmed_transfers.py`

```python
"""TFR-01: scrape Wikipedia's current-window English transfer list, filter to
Premier League clubs, write transfers_confirmed.json. Accurate-but-lagged by
design. Clones the transfer_news.py isolation/empty-guard conventions; never
calls vercel_blob directly (uses upload.save)."""
import os
import sys
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from upload import save

REQUEST_TIMEOUT = 10
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; FPLx/1.0)'}
WIKI_BASE = 'https://en.wikipedia.org/wiki/List_of_English_football_transfers_'

# Wikipedia full name -> FPL teams[].name, for clubs whose rendering diverges.
# Exact-match (Wikipedia text == FPL name) needs no entry. Common promotion
# candidates included defensively so a promoted club still groups.
WIKI_CLUB_TO_FPL = {
    'brighton & hove albion': 'Brighton',
    'leeds united': 'Leeds',
    'manchester city': 'Man City',
    'manchester united': 'Man Utd',
    'newcastle united': 'Newcastle',
    'nottingham forest': "Nott'm Forest",
    'tottenham hotspur': 'Spurs',
    'west ham united': 'West Ham',
    'wolverhampton wanderers': 'Wolves',
    'afc bournemouth': 'Bournemouth',
    "a.f.c. bournemouth": 'Bournemouth',
    # promotion candidates (stable mappings; harmless if not in the league)
    'leicester city': 'Leicester', 'southampton': 'Southampton',
    'ipswich town': 'Ipswich', 'sheffield united': 'Sheffield Utd',
    'west bromwich albion': 'West Brom', 'norwich city': 'Norwich',
}


def _current_window_url(month: int, year: int) -> str:
    """Summer page Jun-Aug; winter page Sep-Jan (winter window straddles the new year)."""
    if 6 <= month <= 8:
        return f'{WIKI_BASE}summer_{year}'
    # Sep-Dec -> winter_<year>-<yy+1>; Jan-May -> winter_<year-1>-<yy> (window opened prior year)
    start = year if month >= 9 else year - 1
    return f'{WIKI_BASE}winter_{start}-{str(start + 1)[-2:]}'


def _build_team_lookup(bootstrap: dict) -> dict:
    """lowercased club-name -> FPL team dict. Includes exact FPL names + aliases."""
    teams = bootstrap.get('teams', [])
    lookup = {t['name'].lower(): t for t in teams}
    by_name = {t['name']: t for t in teams}
    for wiki_name, fpl_name in WIKI_CLUB_TO_FPL.items():
        if fpl_name in by_name:
            lookup[wiki_name] = by_name[fpl_name]
    return lookup


def _resolve(club_text: str, lookup: dict):
    return lookup.get((club_text or '').strip().lower())


def _fetch_html(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.text


def _parse_transfers(html: str, lookup: dict) -> list:
    """Parse wikitables to rows; keep a row iff from OR to is a PL club.
    Loans-section tables tagged kind='loan'."""
    soup = BeautifulSoup(html, 'lxml')
    rows = []
    for table in soup.select('table.wikitable'):
        # a table is "loans" if a preceding heading mentions Loan
        kind = 'permanent'
        prev = table.find_previous(['h2', 'h3', 'h4'])
        if prev and 'loan' in prev.get_text(strip=True).lower():
            kind = 'loan'
        for tr in table.find_all('tr'):
            cells = tr.find_all(['td', 'th'])
            if len(cells) < 5 or tr.find('th'):
                continue  # header / malformed
            date, player, frm, to, fee = (c.get_text(strip=True) for c in cells[:5])
            t_from, t_to = _resolve(frm, lookup), _resolve(to, lookup)
            if not t_from and not t_to:
                continue  # neither side PL
            rows.append({'date': date, 'player': player, 'from_club': frm,
                         'to_club': to, 'fee': fee, 'kind': kind,
                         '_from': t_from, '_to': t_to})
    return rows


def _build_payload(rows: list, bootstrap: dict, window: str,
                   source_url: str, now_iso: str) -> dict:
    groups = {}  # team_id -> group

    def _grp(team):
        g = groups.get(team['id'])
        if g is None:
            g = {'team_id': team['id'], 'team_name': team['name'],
                 'team_short_name': team['short_name'], 'ins': [], 'outs': []}
            groups[team['id']] = g
        return g

    chronological = []
    for r in rows:
        deal = {'date': r['date'], 'player': r['player'], 'fee': r['fee'], 'kind': r['kind']}
        if r['_to']:   # an IN for the buyer
            _grp(r['_to'])['ins'].append({**deal, 'other_club': r['from_club']})
        if r['_from']:  # an OUT for the seller
            _grp(r['_from'])['outs'].append({**deal, 'other_club': r['to_club']})
        chronological.append({
            'date': r['date'], 'player': r['player'], 'fee': r['fee'], 'kind': r['kind'],
            'from_club': r['from_club'], 'to_club': r['to_club'],
            'from_short': r['_from']['short_name'] if r['_from'] else None,
            'to_short': r['_to']['short_name'] if r['_to'] else None,
            'is_pl_to_pl': bool(r['_from'] and r['_to']),
        })
    chronological.sort(key=lambda d: d['date'], reverse=True)  # ISO-ish date strings; see note
    return {
        'scraped_at': now_iso, 'window': window, 'source_url': source_url,
        'groups': sorted(groups.values(), key=lambda g: g['team_name']),
        'chronological': chronological,
        'counts': {'deals': len(rows), 'loans': sum(1 for r in rows if r['kind'] == 'loan')},
    }


def compute_confirmed_transfers(bootstrap: dict) -> None:
    if os.getenv('CONFIRMED_TRANSFERS_ENABLED', '').lower() != 'true':
        print('[confirmed_transfers] CONFIRMED_TRANSFERS_ENABLED not set — skipping')
        return
    now = datetime.now(timezone.utc)
    url = _current_window_url(now.month, now.year)
    window = url.rsplit('_', 1)[-1] if 'summer' in url else url.split('transfers_')[-1]
    try:
        html = _fetch_html(url)
    except Exception as exc:
        print(f'[confirmed_transfers] fetch failed ({exc}) — skipping', file=sys.stderr)
        return
    rows = _parse_transfers(html, _build_team_lookup(bootstrap))
    payload = _build_payload(rows, bootstrap, window=window, source_url=url,
                             now_iso=now.isoformat())
    if not payload['chronological']:
        print('[confirmed_transfers] no PL deals parsed — preserving prior artifact', file=sys.stderr)
        return
    save('transfers_confirmed.json', payload)
    print(f"Confirmed transfers written: {payload['counts']['deals']} deals "
          f"({payload['counts']['loans']} loans), window {window}.")
```

**Note on date sorting**: Wikipedia dates render like "1 July 2026" (not ISO). The plan's chronological sort must parse them. ADD a `_parse_date(s)` helper (`datetime.strptime(s, '%d %B %Y')`, fallback to `datetime.min` on parse failure) and sort by it, not the raw string. Update `_build_payload` to sort `key=lambda d: _parse_date(d['date'])` and fix the test fixture dates to that format (they already are: "1 July 2026"). Adjust the `test_build_payload_groups_and_chronology` date assertion to compare parsed order.

### Step 4: Run tests → PASS (adjust the date helper until green). Then full pipeline suite:
`cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/ -q` → expect 584 + 6 new = 590 passed.

### Step 5: Commit
`git add pipeline/confirmed_transfers.py pipeline/tests/test_confirmed_transfers.py && git commit -m "feat(tfr-01): confirmed-transfers Wikipedia scraper + PL filter"`

---

## Task 2: pipeline wiring + run-once smoke

**Files:** Modify `pipeline/run.py`.

- [ ] **Step 1**: After the `transfer_news` block (`run.py:213`, after its except), add the non-fatal block:
```python
        # TFR-01: confirmed transfers ledger — year-round, env-gated, non-fatal.
        try:
            from confirmed_transfers import compute_confirmed_transfers
            compute_confirmed_transfers(bootstrap)
        except Exception as ct_exc:
            print(f"[confirmed_transfers] non-fatal error: {ct_exc}", file=sys.stderr)
```
- [ ] **Step 2**: Real-data smoke (manual, off the live Wikipedia page — network):
`cd C:\Users\jamie\fplx\pipeline && CONFIRMED_TRANSFERS_ENABLED=true python -c "import json; from capture_season import load_season_archive; from confirmed_transfers import compute_confirmed_transfers as f; import upload; upload.save=lambda k,v: open('cache/'+k,'w',encoding='utf-8').write(json.dumps(v,indent=1)); f(load_season_archive()['bootstrap'])"`
Expect a console line "Confirmed transfers written: N deals…" and `pipeline/cache/transfers_confirmed.json` with sane groups. (If the live page's column order differs from the fixture, fix `_parse_transfers` accordingly and note it — this is the spot-check the spec calls for.) Report the real N + a couple of sample groups. Delete the throwaway cache file after.
- [ ] **Step 3**: Commit `git add pipeline/run.py && git commit -m "feat(tfr-01): wire confirmed_transfers into pipeline run"`

---

## Task 3: API route + hook + types

**Files:** Create `src/app/api/transfers/route.ts`, `src/lib/hooks/useConfirmedTransfers.ts`; Modify `src/lib/types.ts`.

- [ ] **Step 1**: Clone `src/app/api/transfer-news/route.ts` → `transfers/route.ts`, reading `transfers_confirmed.json`, `DISABLED_RESPONSE = { enabled:false, scraped_at:'', window:'', source_url:'', groups:[], chronological:[], counts:{deals:0,loans:0} }`. Same blob-or-local + 200-envelope + cache-control.
- [ ] **Step 2**: `src/lib/types.ts` — add:
```ts
export interface TransferDeal { date: string; player: string; fee: string; kind: 'permanent' | 'loan'; other_club?: string }
export interface TransferGroup { team_id: number; team_name: string; team_short_name: string; ins: TransferDeal[]; outs: TransferDeal[] }
export interface ChronoTransfer { date: string; player: string; fee: string; kind: 'permanent' | 'loan'; from_club: string; to_club: string; from_short: string | null; to_short: string | null; is_pl_to_pl: boolean }
export interface ConfirmedTransfers { enabled: boolean; scraped_at: string; window: string; source_url: string; groups: TransferGroup[]; chronological: ChronoTransfer[]; counts: { deals: number; loans: number } }
```
- [ ] **Step 3**: Clone `useTransferNews.ts` → `useConfirmedTransfers.ts`: `useQuery<ConfirmedTransfers>(['confirmed-transfers'], () => fetch('/api/transfers')…)`, `staleTime: 6*60*60*1000`, `retry: false`; export `isNotAvailable` derive helper or compute in the tab.
- [ ] **Step 4**: `npx tsc --noEmit` (stays 0); commit `feat(tfr-01): /api/transfers route + useConfirmedTransfers hook + types`

---

## Task 4: tab component + nav registration

**Files:** Create `src/components/transfers-confirmed/ConfirmedTransfersTab.tsx` (+ `.test.tsx`); Modify `src/lib/navigation.ts`, `src/lib/navigation.test.ts`, `src/app/page.tsx`, `src/app/page.test.tsx`.

- [ ] **Step 1**: Failing test `ConfirmedTransfersTab.test.tsx` (mock `useConfirmedTransfers`): (a) `enabled:false` → EmptyState text "appear when the window is active"; (b) loaded+empty groups → "No Premier League deals confirmed yet"; (c) populated → a group's TeamBadge + an Ins player + a fee chip; (d) a `kind:'loan'` deal shows a "LOAN" chip; (e) toggle to "Most recent" shows the chronological list; (f) "Rumours" button calls `selectTool('window')`. Watch fail.
- [ ] **Step 2**: Implement the tab (UIX primitives only): header (title + "as of {scraped_at} · {window}" via `text-data text-ink-muted`, ghost Button "Rumours & speculation →" → `selectTool('window')`), `SegmentedToggle` [By club | Most recent] default `by-club`. By-club: map `groups` → `Card` per club (`TeamBadge shortName={g.team_short_name}` + name), two labelled sections Ins/Outs, each deal a row (player, `Chip` fee neutral, `Chip intent="violet" variant="outline"` "LOAN" if loan, `other_club` muted; empty → "—"). Most-recent: `chronological` rows (date, `from_short`→`to_short` TeamBadges, player, fee chip, LOAN chip). States via `isNotAvailable` / empty `chronological`.
- [ ] **Step 3**: `navigation.ts` — add `'transfers-confirmed'` to `ToolId`; add `{ id:'transfers-confirmed', label:'Confirmed Transfers', mobileLabel:'Transfers' }` to the Planning group's tools (next to `window`). Update `navigation.test.ts` count (now 29 ids incl. home) + presence assertion.
- [ ] **Step 4**: `page.tsx` — import `ConfirmedTransfersTab`; add `{activeTool === 'transfers-confirmed' && <ConfirmedTransfersTab selectTool={selectTool} />}` near the `window` conditional. Update `page.test.tsx`'s tool map.
- [ ] **Step 5**: Grep gate (`git grep -nE 'zinc-|gray-|#[0-9a-fA-F]{3,6}' -- src/components/transfers-confirmed` → zero); full vitest + tsc(0) + contrast + e2e (the `?t=transfers-confirmed` smoke is auto-covered by the ALL_TOOL_IDS loop — expect 63 → 65 with the new id × 2 viewports, or however the loop counts). Browser walkthrough: by-club + recent toggle, off-season empty state, Rumours cross-link.
- [ ] **Step 6**: Commit `feat(tfr-01): Confirmed Transfers tab + Planning-group nav registration`

---

## Final acceptance

- pipeline suite 590; full vitest green; tsc 0; contrast 30 pairs; e2e green (new tool id smoke passes); grep gate clean on the new component
- Manual: the live-page smoke (Task 2 Step 2) produced a sane ledger
- Controller updates roadmap + backlog (mark TFR-01 shipped)

## Self-review

- Spec coverage: scraper+filter+alias ✓T1, URL derivation ✓T1, empty-guard+gate ✓T1, JSON shape ✓T1 (matches spec verbatim), pipeline wiring ✓T2, route/hook/types ✓T3, tab+states+toggle+cross-link+nav ✓T4, tests at every layer ✓.
- Date-sort hazard explicitly called out (Wikipedia "1 July 2026" format → `_parse_date`), with the fix instruction — not left as a silent string sort.
- Type consistency: `transfers_confirmed.json` shape ↔ TS `ConfirmedTransfers` ↔ tab consumption all aligned; `team_short_name`/`from_short`/`to_short` feed `TeamBadge shortName`.
- No placeholders: full scraper code; the one build-time unknown (live column order) has a defined spot-check + fix instruction in T2.
