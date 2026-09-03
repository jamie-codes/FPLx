"""TEAM-01: direction-specific, home/away-split team ratings from a completed season.

Why this exists
---------------
merge.py blends a prior into its rolling fixture-difficulty proxies while each
team's sample is still small. That prior used to be FPL's official per-fixture
difficulty — one number, direction-agnostic: the same value stood in for "how
hard is this team to score against" and "how likely are they to score against
you". Two teams can share an official difficulty of 3 while one of them draws
0-0 every week and the other trades 3-2s, and the prior could not tell them
apart.

Two gameweeks into 2026/27 that showed up plainly: the model rated Ipswich, a
promoted side, the 9th-best attack in the league, because the offensive proxy
fills after three games and was already two-thirds driven by a two-game sample.

This module builds the replacement from primary data — every final score of the
previous season — as four rates per team: goals scored and conceded, at home
and away. Those become separate attacking and defensive priors that know which
way round the fixture is.

Keying
------
Teams are keyed by `short_name`, NOT by `id`. FPL re-issues team ids every
season, so last season's id 12 is not this season's id 12. Short names are
stable ("MUN" has been "MUN" throughout).

Promoted teams
--------------
The three promoted sides have no previous-season Premier League record at all.
They get a bucket prior — the mean of the previous season's bottom three — on
the same reasoning COLD-01 uses for players with no history: the population
average of comparable cases beats both silence and a wild guess. Promoted
teams do not reliably play like the sides they replaced, but they play far more
like them than like a mid-table average, which is what the official-FDR prior
was effectively giving them.
"""

from __future__ import annotations

# A season's worth of results is the point; a handful of fixtures is not a
# rate. Below this the archive is treated as unusable and callers fall back.
MIN_FIXTURES_FOR_PRIOR = 200

# How many bottom-of-the-table sides to average for the promoted-team bucket.
PROMOTED_BUCKET_SIZE = 3


def build_team_season_rates(fixtures: list, teams: list) -> dict[str, dict]:
    """Per-team home/away scoring and conceding rates from finished fixtures.

    Args:
        fixtures: a completed season's fixture list (FPL shape — team_h, team_a,
                  team_h_score, team_a_score, finished).
        teams:    that season's bootstrap `teams` list, for the id → short_name map.

    Returns:
        short_name -> {gf_home, ga_home, gf_away, ga_away, played_home,
                       played_away, points}. Rates are goals per game. Teams
                       with no finished fixtures are omitted entirely rather
                       than returned as zeros, which would read as a team that
                       never scores.
    """
    name_of = {t['id']: t['short_name'] for t in teams}
    acc: dict[str, dict] = {}

    def _slot(team_id: int) -> dict | None:
        name = name_of.get(team_id)
        if name is None:
            return None
        return acc.setdefault(name, {
            'gf_home': 0, 'ga_home': 0, 'gf_away': 0, 'ga_away': 0,
            'played_home': 0, 'played_away': 0, 'points': 0,
        })

    for fix in fixtures:
        if not fix.get('finished'):
            continue
        hs, as_ = fix.get('team_h_score'), fix.get('team_a_score')
        if hs is None or as_ is None:
            continue
        home, away = _slot(fix.get('team_h')), _slot(fix.get('team_a'))
        if home is None or away is None:
            continue
        home['gf_home'] += hs
        home['ga_home'] += as_
        home['played_home'] += 1
        away['gf_away'] += as_
        away['ga_away'] += hs
        away['played_away'] += 1
        # League points, recomputed from results — the archived bootstrap's own
        # points/position fields read 0 once FPL resets for the new season.
        if hs > as_:
            home['points'] += 3
        elif as_ > hs:
            away['points'] += 3
        else:
            home['points'] += 1
            away['points'] += 1

    rates = {}
    for name, a in acc.items():
        if a['played_home'] == 0 or a['played_away'] == 0:
            continue
        rates[name] = {
            'gf_home': a['gf_home'] / a['played_home'],
            'ga_home': a['ga_home'] / a['played_home'],
            'gf_away': a['gf_away'] / a['played_away'],
            'ga_away': a['ga_away'] / a['played_away'],
            'played_home': a['played_home'],
            'played_away': a['played_away'],
            'points': a['points'],
        }
    return rates


def build_promoted_bucket(rates: dict[str, dict], size: int = PROMOTED_BUCKET_SIZE) -> dict | None:
    """Mean rates of the previous season's bottom `size` sides.

    Returns None when there are not enough teams to form a bucket, which leaves
    callers to fall back rather than invent a number.
    """
    if len(rates) <= size:
        return None
    bottom = sorted(rates.values(), key=lambda r: r['points'])[:size]
    keys = ('gf_home', 'ga_home', 'gf_away', 'ga_away')
    return {k: sum(r[k] for r in bottom) / len(bottom) for k in keys}


def _normalise(value: float, lo: float, hi: float) -> float:
    """Scale into 0-1 against the league's own spread, clamped at the ends.

    A degenerate spread (every team identical) collapses to 0.5 — no signal, so
    no opinion.
    """
    if hi - lo < 1e-9:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def build_prior_difficulty_scores(rates: dict[str, dict],
                                  live_team_names: dict[int, str]) -> dict[int, dict]:
    """Convert season rates into 0-1 difficulty scores keyed by LIVE team id.

    Direction and sign match merge.py's rolling scores exactly, so the two are
    interchangeable inside its blend:

      att_home/att_away — attacking difficulty of facing this team while THIS
        team plays at home / away. Derived from goals conceded and INVERTED:
        a team that concedes little is hard to score against, so 1.0 = hardest.

      def_home/def_away — defensive difficulty, i.e. how hard it is to keep a
        clean sheet against this team at that venue. Derived from goals scored
        and NOT inverted: a team that scores freely is hard to shut out, so
        1.0 = hardest.

    Promoted teams (live, but absent from the previous season) take the bucket
    prior. Teams still missing after that are omitted, and merge.py falls back
    to the official-FDR prior for them.
    """
    if not rates:
        return {}
    bucket = build_promoted_bucket(rates)

    # Normalise against the previous season's own distribution. The bucket is
    # included so promoted sides sit at the bottom of the same scale rather
    # than off the end of it.
    pool = list(rates.values()) + ([bucket] if bucket else [])
    bounds = {k: (min(r[k] for r in pool), max(r[k] for r in pool))
              for k in ('gf_home', 'ga_home', 'gf_away', 'ga_away')}

    scores: dict[int, dict] = {}
    for team_id, name in live_team_names.items():
        r = rates.get(name) or bucket
        if r is None:
            continue
        scores[team_id] = {
            # Inverted: fewer goals conceded -> harder to score against.
            'att_home': 1.0 - _normalise(r['ga_home'], *bounds['ga_home']),
            'att_away': 1.0 - _normalise(r['ga_away'], *bounds['ga_away']),
            # Not inverted: more goals scored -> harder to keep a clean sheet.
            'def_home': _normalise(r['gf_home'], *bounds['gf_home']),
            'def_away': _normalise(r['gf_away'], *bounds['gf_away']),
            'is_bucket': name not in rates,
        }
    return scores


def build_team_priors(archive: dict, live_bootstrap: dict) -> dict[int, dict]:
    """Full path: season archive + live bootstrap -> prior scores by live team id.

    Returns {} when the archive is too thin to be worth trusting, which callers
    treat as "no prior available" and fall back to official FDR.
    """
    fixtures = archive.get('fixtures') or []
    finished = [f for f in fixtures if f.get('finished')]
    if len(finished) < MIN_FIXTURES_FOR_PRIOR:
        return {}
    rates = build_team_season_rates(fixtures, archive['bootstrap']['teams'])
    live_names = {t['id']: t['short_name'] for t in live_bootstrap.get('teams', [])}
    return build_prior_difficulty_scores(rates, live_names)
