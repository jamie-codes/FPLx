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
# Names that already match FPL exactly are still listed for an explicit, auditable table.
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

# Letters that NFKD does NOT decompose; a bare encode('ascii','ignore') would DELETE
# them, mangling surnames (Højlund -> 'hjlund') so they can never match api-football's
# ascii forms ('hojlund'). Fold them explicitly before normalising.
_FOLD = str.maketrans({
    'ø': 'o', 'Ø': 'o', 'ð': 'd', 'Ð': 'd',
    'þ': 'th', 'Þ': 'th', 'ł': 'l', 'Ł': 'l', 'ı': 'i',
})


def _norm(name: str) -> list[str]:
    """Lowercase, fold non-decomposing diacritics, strip accents/punctuation -> tokens."""
    s = unicodedata.normalize('NFKD', (name or '').translate(_FOLD))
    s = s.encode('ascii', 'ignore').decode()
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
