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


def _team_matches(candidate: str, team_name: str, team_short: str) -> bool:
    """Case-insensitive check: exact match, whole-string substring, or token overlap.

    Matching tiers (in order):
    1. Exact string match or short_name match.
    2. Whole-string substring (candidate in name or name in candidate).
    3. Token-set subset (all significant tokens of the shorter name appear verbatim
       in the token set of the longer name) — handles 'Man Utd' in 'Manchester Utd'
       NOT matching 'Man City' because 'utd' is not in 'Man City'.
    4. LAST significant token of candidate == last significant token of team name
       AND first significant token of candidate starts-with or IS the first token of
       team name (or vice versa) — guards against ham/fulham collisions.
    """
    c, n, s = candidate.lower(), team_name.lower(), team_short.lower()
    # Tier 1: exact / short-name
    if c == n or c == s:
        return True
    # Tier 2: whole-string substring
    if c in n or n in c:
        return True
    # Tier 3: token-set subset match using SIGNIFICANT tokens (len>=3)
    c_sig = [t for t in c.split() if len(t) >= 3]
    n_tokens = n.split()
    n_sig = [t for t in n_tokens if len(t) >= 3]
    c_set = set(c_sig)
    n_set = set(n_sig)
    if c_set and n_set:
        # All significant tokens from the SMALLER set must appear in the larger
        smaller = c_set if len(c_set) <= len(n_set) else n_set
        larger = n_set if len(c_set) <= len(n_set) else c_set
        if smaller <= larger:
            return True
    # Tier 4: last significant token exact match (handles 'Man Utd' ~ 'Manchester Utd')
    # Only if the teams share their last token and at least one non-last token partially
    # overlaps (to avoid ham/fulham)
    if c_sig and n_sig and c_sig[-1] == n_sig[-1]:
        # Confirm the first tokens share a prefix of len>=3 to avoid false positives
        if (c_sig[0][:3] == n_sig[0][:3]):
            return True
    return False


def resolve_team_ids(teams: list[dict]) -> dict[str, int]:
    """Map each football-data name -> FPL team id, matching the alias target against
    the archive bootstrap team `name` (substring, case-insensitive) or `short_name`.
    Falls back to matching on the original football-data name if the alias target
    doesn't resolve (handles synthetic/test archives with non-standard names).
    Returns only entries that successfully resolve; missing entries are caught
    per-row in build_odds_lookup with a clear error."""
    out = {}
    for fd_name, fpl_target in FOOTBALL_DATA_TO_FPL.items():
        # Try candidates: first the alias target, then the original fd_name
        candidates = [fpl_target]
        if fpl_target.lower() != fd_name.lower():
            candidates.append(fd_name)
        match = None
        for candidate in candidates:
            for t in teams:
                name = (t.get('name') or '')
                short = (t.get('short_name') or '')
                if _team_matches(candidate, name, short):
                    match = t['id']
                    break
            if match is not None:
                break
        if match is not None:
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
