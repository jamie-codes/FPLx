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
    # chronological newest-first (parsed dates: 4 July > 2 July > 1 July)
    dates = [d['date'] for d in payload['chronological']]
    from datetime import datetime
    parsed = [datetime.strptime(d, '%d %B %Y') for d in dates]
    assert parsed == sorted(parsed, reverse=True)
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


# ── live-DOM robustness (locks in the 3 fixes found during the smoke) ──────── #

def test_date_continuation_rows():
    """Wikipedia omits the date cell on same-date deals (4 td cells). The parser
    carries last_date forward instead of dropping the row."""
    html = """
    <table class="wikitable">
    <tr><th>Date</th><th>Player</th><th>Moving from</th><th>Moving to</th><th>Fee</th></tr>
    <tr><td>1 July 2026</td><td><a>P1</a></td><td><a>Arsenal</a></td><td><a>Spurs</a></td><td>£10m</td></tr>
    <tr><td><a>P2</a></td><td><a>Spurs</a></td><td><a>Arsenal</a></td><td>£5m</td></tr>
    </table>
    """
    rows = ct._parse_transfers(html, ct._build_team_lookup(BOOTSTRAP))
    assert len(rows) == 2
    assert rows[1]['player'] == 'P2' and rows[1]['date'] == '1 July 2026'  # carried forward


def test_citation_superscripts_stripped():
    """Fee/club cells carry [n] citation markers via <sup>; _clean_text removes them."""
    html = """
    <table class="wikitable">
    <tr><th>Date</th><th>Player</th><th>Moving from</th><th>Moving to</th><th>Fee</th></tr>
    <tr><td>2 July 2026</td><td><a>P3</a></td><td><a>Wolves</a></td><td><a>Arsenal</a></td><td>Undisclosed<sup class="reference">[12]</sup></td></tr>
    </table>
    """
    rows = ct._parse_transfers(html, ct._build_team_lookup(BOOTSTRAP))
    assert rows[0]['fee'] == 'Undisclosed'  # no [12]


def test_alt_loan_schema_no_fee_column():
    """Live loans table is Start date | End date | Name | From | To (no Fee).
    Detected by header and tagged kind='loan'."""
    html = """
    <h3>Loans</h3>
    <table class="wikitable">
    <tr><th>Start date</th><th>End date</th><th>Name</th><th>Moving from</th><th>Moving to</th></tr>
    <tr><td>3 July 2026</td><td>30 June 2027</td><td><a>P4</a></td><td><a>Spurs</a></td><td><a>Arsenal</a></td></tr>
    </table>
    """
    rows = ct._parse_transfers(html, ct._build_team_lookup(BOOTSTRAP))
    assert len(rows) == 1
    assert rows[0]['kind'] == 'loan' and rows[0]['player'] == 'P4'


def test_window_value_keeps_season_prefix(monkeypatch):
    """Regression: window must be 'summer_2026', not '2026' (UI renders it)."""
    saved = {}
    monkeypatch.setattr(ct, 'save', lambda k, v: saved.setdefault(k, v))
    monkeypatch.setattr(ct, '_fetch_html', lambda url: FIXTURE_HTML)
    monkeypatch.setattr(ct, '_current_window_url', lambda m, y: ct.WIKI_BASE + 'summer_2026')
    monkeypatch.setenv('CONFIRMED_TRANSFERS_ENABLED', 'true')
    ct.compute_confirmed_transfers(BOOTSTRAP)
    assert saved['transfers_confirmed.json']['window'] == 'summer_2026'
