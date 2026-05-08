"""Compute data-driven pattern statements (insights) from this season's FPL data.

Phase 33 INS-02/03/04. Aggregates already-fetched merged players, bootstrap teams,
fixtures, and per-player element-summary history into a flat list of Insight dicts
matching the TypeScript Insight interface in src/lib/types.ts.

This module is called once from pipeline/run.py after merged_players.json + captain_picks.json
have been written. It performs ZERO HTTP calls — all data is passed in as arguments
(matches defcon.py / xmins.py convention).
"""

# D-03: Minimum data points before an insight can be emitted (suppress otherwise — NOT shown as LOW).
MIN_SAMPLE_TOTAL = 10

# D-07: Hardcoded triviality exclusion. Any insight with id in this set is dropped
# regardless of its confidence_pct. The set is the LAST-RESORT safety net — pattern
# helpers should not generate trivial outputs in the first place.
_TRIVIAL_PATTERN_IDS = frozenset({
    'trivial_winners_score_more',          # "teams that win score more goals"
    'trivial_starters_outscore_bench',     # "bench players score fewer points"
    'trivial_suspended_score_zero',        # "suspended players score 0 points"
    'trivial_more_minutes_more_points',    # "playing more minutes scores more points"
})

CATEGORIES = ('defensive', 'attacking', 'player', 'captaincy')

# Position code -> human label (mirror of MergedPlayer element_type field).
_POS_LABEL = {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}


# Phase 79 (D-04) — signal label rule matrix.
def _signal_label(category: str, confidence_pct: float, insight_id: str) -> str:
    """Map (category, confidence_pct) to one of 6 signal labels.

    Rule precedence: category-specific overrides run BEFORE generic threshold checks.
    Per D-04 in 079-CONTEXT.md.
    """
    # Category-specific overrides (highest precedence)
    if category == 'player' and 65 <= confidence_pct < 70:
        return 'Hidden gem'
    if category in ('attacking', 'player') and confidence_pct < 45:
        return 'Trap risk'
    if category == 'defensive' and confidence_pct < 45:
        return 'Regression risk'
    # Generic threshold checks
    if confidence_pct >= 70:
        return 'Strong signal'
    if confidence_pct >= 55:
        return 'Watchlist'
    return 'Weak signal'


# Phase 79 (D-01) — per-insight benchmark reference values for the progress-bar
# benchmark line. Tuned defaults; planner-locked values per planning guidance.
BENCHMARK_DEFAULTS = {
    'def_cs_home_vs_away':           25.0,  # historical PL CS rate ~25%
    'def_cs_rate_top6_vs_rest':      35.0,  # top-6 keep CS ~35%
    'def_cs_streak_ge2':             20.0,  # ~1 in 5 teams on a 2+ CS streak (baseline)
    'att_top_xg_overperformers':     50.0,  # 50/50 baseline (overperform vs not)
    'att_home_goal_share':           50.0,  # 50/50 equal baseline
    'att_top_team_goal_share':       33.0,  # one-third of league goals from top scorer (baseline)
    'player_buy_signal_count':       15.0,  # ~15% of starters carry a buy signal (baseline)
    'player_sell_signal_count':      15.0,  # ~15% of starters carry a sell signal (baseline)
    'player_diff_count':             10.0,  # 10% ownership as mid-tier differential threshold
    'player_template_trap_count':    15.0,  # ~15% of starters template traps (baseline)
    'cap_top3_xpts_share':           33.0,  # three-captain split 33% each (equal baseline)
    'cap_double_digit_haul_rate':    15.0,  # 15% haul rate historical baseline
}
DEFAULT_BENCHMARK = 50.0  # neutral fallback for any insight added later

# Phase 79 (D-01) — per-insight title strings (<=4 words, noun phrase, no abbreviations).
INSIGHT_TITLES = {
    'def_cs_home_vs_away':         'Home Clean Sheet Edge',
    'def_cs_rate_top6_vs_rest':    'Top Team Clean Sheets',
    'def_cs_streak_ge2':           'Active Clean Sheet Streaks',
    'att_top_xg_overperformers':   'xG Overperformers',
    'att_home_goal_share':         'Home Field Goal Share',
    'att_top_team_goal_share':     'Top Scorer Dependence',
    'player_buy_signal_count':     'Buy Signal Count',
    'player_sell_signal_count':    'Sell Signal Count',
    'player_diff_count':           'Differential Count',
    'player_template_trap_count':  'Template Trap Count',
    'cap_top3_xpts_share':         'Captain Concentration Risk',
    'cap_double_digit_haul_rate':  'Double-Digit Haul Rate',
}

# Phase 79 (D-01) — per-insight action hint strings (verb-led, <=7 words, no hedging, no player names).
INSIGHT_ACTION_HINTS = {
    'def_cs_home_vs_away':         'Target home defenders in good runs',
    'def_cs_rate_top6_vs_rest':    'Prioritise top-six defence assets',
    'def_cs_streak_ge2':           'Ride hot defensive streaks',
    'att_top_xg_overperformers':   'Hold xG overperformers, expect regression',
    'att_home_goal_share':         'Favour home attackers with good fixtures',
    'att_top_team_goal_share':     'Assess captain risk from top scorer reliance',
    'player_buy_signal_count':     'Scan buy signals for next transfer',
    'player_sell_signal_count':    'Review sell signals before deadline',
    'player_diff_count':           'Check ownership before buying differentials',
    'player_template_trap_count':  'Avoid template traps trending downwards',
    'cap_top3_xpts_share':         'Spread captain risk across teams',
    'cap_double_digit_haul_rate':  'Price in haul probability for captain picks',
}


def compute_insights(
    merged: list,
    bootstrap: dict,
    fixtures: list,
    summaries: dict,
    finished_gws: int,
) -> list:
    """Aggregate season data into a flat list of Insight dicts for insights.json.

    Args:
        merged: list of merged player records (from merge_players())
        bootstrap: full FPL bootstrap-static JSON (elements, teams, events)
        fixtures: list of all fixture dicts (380 entries; finished + upcoming)
        summaries: dict mapping player_id (int) -> element-summary dict
        finished_gws: count of finished gameweeks

    Returns:
        Flat list of Insight dicts. Each dict has six keys: id, category, statement,
        confidence_pct, sample_n, sample_total. Output is sorted by
        (category ascending, confidence_pct descending). Insights with sample_total
        < MIN_SAMPLE_TOTAL or id in _TRIVIAL_PATTERN_IDS are filtered out.
    """
    raw = []
    raw.extend(_defensive_patterns(merged, bootstrap, fixtures))
    raw.extend(_attacking_patterns(merged, bootstrap, fixtures, summaries))
    raw.extend(_player_patterns(merged, summaries, finished_gws))
    raw.extend(_captaincy_patterns(merged, summaries))

    insights = []
    for ins in raw:
        if ins is None:
            continue
        if ins.get('sample_total', 0) < MIN_SAMPLE_TOTAL:
            continue
        if ins.get('id') in _TRIVIAL_PATTERN_IDS:
            continue
        # Defensive shape check: drop any dict missing required keys.
        required = {
            'id', 'category', 'statement', 'confidence_pct', 'sample_n', 'sample_total',
            'title', 'metric_value', 'metric_label', 'takeaway', 'action_hint',
            'benchmark_value', 'gw_coverage', 'player_ids', 'team_ids',
            'player_names', 'team_names', 'signal_label',
        }
        if not required.issubset(ins.keys()):
            continue
        if ins['category'] not in CATEGORIES:
            continue
        insights.append(ins)

    insights.sort(key=lambda i: (i['category'], -i['confidence_pct']))
    return insights


def _defensive_patterns(merged: list, bootstrap: dict, fixtures: list) -> list:
    """Emit defensive-pattern Insight dicts (CS rates by venue, top-6, streaks)."""
    out = []
    finished = [f for f in fixtures if f.get('finished')]
    total = len(finished)

    # def_cs_home_vs_away: clean-sheet rate at home vs away
    if total >= MIN_SAMPLE_TOTAL:
        home_cs = sum(1 for f in finished if (f.get('team_a_score') or 0) == 0)
        away_cs = sum(1 for f in finished if (f.get('team_h_score') or 0) == 0)
        home_pct = round(home_cs / total * 100, 1)
        away_pct = round(away_cs / total * 100, 1)
        if home_cs >= away_cs:
            sample_n = home_cs
            confidence_pct = round(home_cs / total * 100, 1)
        else:
            sample_n = away_cs
            confidence_pct = round(away_cs / total * 100, 1)
        out.append({
            'id': 'def_cs_home_vs_away',
            'category': 'defensive',
            'statement': (
                f'Home teams keep clean sheets in {home_pct}% of finished fixtures '
                f'({home_cs}/{total}), away teams in {away_pct}%.'
            ),
            'confidence_pct': confidence_pct,
            'sample_n': int(sample_n),
            'sample_total': int(total),
            'title': INSIGHT_TITLES['def_cs_home_vs_away'],
            'metric_value': float(home_pct if home_pct >= away_pct else away_pct),
            'metric_label': 'CS rate at home' if home_pct >= away_pct else 'CS rate away',
            'takeaway': (
                f'Home defenders keep clean sheets {home_pct}% of the time — '
                f'{round(home_pct - away_pct, 1)}pp more than away sides.'
                if home_pct >= away_pct else
                f'Away defenders keep clean sheets {away_pct}% of the time — '
                f'{round(away_pct - home_pct, 1)}pp more than home sides.'
            ),
            'action_hint': INSIGHT_ACTION_HINTS['def_cs_home_vs_away'],
            'benchmark_value': BENCHMARK_DEFAULTS['def_cs_home_vs_away'],
            'gw_coverage': (lambda _gw: f'GW1–{_gw}' if _gw > 0 else 'pre-season')(max((f.get("event") or 0 for f in finished), default=0)),
            'player_ids': [],
            'team_ids': [],
            'player_names': [],
            'team_names': [],
            'signal_label': _signal_label('defensive', confidence_pct, 'def_cs_home_vs_away'),
        })

    # def_cs_rate_top6_vs_rest: clean-sheet rate of top-6 PL teams
    teams = bootstrap.get('teams', [])
    teams_by_id = {t['id']: t for t in teams}
    # Sort teams by 'position' field if present, else fall back to total fixture points
    teams_with_pos = [t for t in teams if t.get('position') is not None]
    if len(teams_with_pos) >= 6:
        sorted_teams = sorted(teams_with_pos, key=lambda t: t['position'])
        top6_ids = {t['id'] for t in sorted_teams[:6]}
    else:
        # Fallback: rank by total goals scored across finished fixtures
        team_goals: dict = {}
        for f in finished:
            h = f.get('team_h')
            a = f.get('team_a')
            if h is not None:
                team_goals[h] = team_goals.get(h, 0) + (f.get('team_h_score') or 0)
            if a is not None:
                team_goals[a] = team_goals.get(a, 0) + (f.get('team_a_score') or 0)
        top6_ids = {tid for tid, _ in sorted(team_goals.items(), key=lambda x: -x[1])[:6]}

    if top6_ids:
        top6_fixtures = [
            f for f in finished
            if f.get('team_h') in top6_ids or f.get('team_a') in top6_ids
        ]
        top6_appearances = sum(
            (1 if f.get('team_h') in top6_ids else 0) + (1 if f.get('team_a') in top6_ids else 0)
            for f in top6_fixtures
        )
        if top6_appearances >= MIN_SAMPLE_TOTAL:
            top6_cs = 0
            for f in top6_fixtures:
                h = f.get('team_h')
                a = f.get('team_a')
                h_score = f.get('team_h_score') or 0
                a_score = f.get('team_a_score') or 0
                # CS for each top-6 team in this fixture (independent checks)
                if h in top6_ids and a_score == 0:
                    top6_cs += 1
                if a in top6_ids and h_score == 0:
                    top6_cs += 1
            confidence_pct = round(top6_cs / top6_appearances * 100, 1)
            out.append({
                'id': 'def_cs_rate_top6_vs_rest',
                'category': 'defensive',
                'statement': (
                    f'Top-6 teams kept clean sheets in {confidence_pct}% of their '
                    f'finished appearances ({top6_cs}/{top6_appearances}).'
                ),
                'confidence_pct': confidence_pct,
                'sample_n': int(top6_cs),
                'sample_total': int(top6_appearances),
                'title': INSIGHT_TITLES['def_cs_rate_top6_vs_rest'],
                'metric_value': float(confidence_pct),
                'metric_label': 'top-6 CS rate',
                'takeaway': (
                    f"The league's top six teams keep clean sheets {confidence_pct}% of the time — "
                    f'{top6_cs} from {top6_appearances} appearances.'
                ),
                'action_hint': INSIGHT_ACTION_HINTS['def_cs_rate_top6_vs_rest'],
                'benchmark_value': BENCHMARK_DEFAULTS['def_cs_rate_top6_vs_rest'],
                'gw_coverage': (lambda _gw: f'GW1–{_gw}' if _gw > 0 else 'pre-season')(max((f.get("event") or 0 for f in finished), default=0)),
                'player_ids': [],
                'team_ids': sorted(int(tid) for tid in top6_ids),
                'player_names': [],
                'team_names': sorted(
                    teams_by_id.get(tid, {}).get('short_name', f'Team{tid}')
                    for tid in top6_ids
                ),
                'signal_label': _signal_label('defensive', confidence_pct, 'def_cs_rate_top6_vs_rest'),
            })

    # def_cs_streak_ge2: fraction of teams with a current 2+ CS streak
    all_team_ids = {t['id'] for t in teams}
    if len(all_team_ids) >= MIN_SAMPLE_TOTAL:
        if not finished:
            return out
        # Sort finished fixtures by event (gameweek) ascending
        sorted_finished = sorted(finished, key=lambda f: f.get('event') or 0)
        streak_ge2_count = 0
        for tid in all_team_ids:
            # Gather fixtures for this team in order
            team_fixtures = [
                f for f in sorted_finished
                if f.get('team_h') == tid or f.get('team_a') == tid
            ]
            # Count current trailing CS streak
            streak = 0
            for f in reversed(team_fixtures):
                h = f.get('team_h')
                a = f.get('team_a')
                h_score = f.get('team_h_score') or 0
                a_score = f.get('team_a_score') or 0
                # Did this team keep a CS?
                if h == tid:
                    kept_cs = (a_score == 0)
                else:
                    kept_cs = (h_score == 0)
                if kept_cs:
                    streak += 1
                else:
                    break
            if streak >= 2:
                streak_ge2_count += 1

        sample_total = len(all_team_ids)
        confidence_pct = round(streak_ge2_count / sample_total * 100, 1)
        out.append({
            'id': 'def_cs_streak_ge2',
            'category': 'defensive',
            'statement': (
                f'{streak_ge2_count} of {sample_total} teams are on a clean-sheet streak '
                f'of 2 or more fixtures ({confidence_pct}%).'
            ),
            'confidence_pct': confidence_pct,
            'sample_n': int(streak_ge2_count),
            'sample_total': int(sample_total),
            'title': INSIGHT_TITLES['def_cs_streak_ge2'],
            'metric_value': float(confidence_pct),
            'metric_label': 'teams on 2+ CS streak',
            'takeaway': (
                f'{streak_ge2_count} of {sample_total} PL teams are riding a clean-sheet streak '
                f'of two or more fixtures right now.'
            ),
            'action_hint': INSIGHT_ACTION_HINTS['def_cs_streak_ge2'],
            'benchmark_value': BENCHMARK_DEFAULTS['def_cs_streak_ge2'],
            'gw_coverage': (lambda _gw: f'GW1–{_gw}' if _gw > 0 else 'pre-season')(max((f.get("event") or 0 for f in finished), default=0)),
            'player_ids': [],
            'team_ids': [],
            'player_names': [],
            'team_names': [],
            'signal_label': _signal_label('defensive', confidence_pct, 'def_cs_streak_ge2'),
        })

    return out


def _attacking_patterns(merged: list, bootstrap: dict, fixtures: list, summaries: dict) -> list:
    """Emit attacking-pattern Insight dicts (xG over-performance, home/away goals, team share)."""
    out = []
    finished = [f for f in fixtures if f.get('finished')]

    # att_top_xg_overperformers: attackers whose goals exceed xG by 30%+ (xG >= 3.0)
    attackers_with_xg = [
        p for p in merged
        if p.get('element_type') in (3, 4)
        and (p.get('expected_goals') or 0) >= 3.0
    ]
    sample_total_att = len(attackers_with_xg)
    if sample_total_att >= MIN_SAMPLE_TOTAL:
        overperformers = [
            p for p in attackers_with_xg
            if (p.get('goals_scored') or 0) >= (p.get('expected_goals') or 0) * 1.3
        ]
        sample_n_att = len(overperformers)
        confidence_pct = round(sample_n_att / sample_total_att * 100, 1)
        out.append({
            'id': 'att_top_xg_overperformers',
            'category': 'attacking',
            'statement': (
                f'{sample_n_att} of {sample_total_att} attackers (xG >= 3) have outscored '
                f'their xG by 30%+ this season ({confidence_pct}%).'
            ),
            'confidence_pct': confidence_pct,
            'sample_n': int(sample_n_att),
            'sample_total': int(sample_total_att),
            'title': INSIGHT_TITLES['att_top_xg_overperformers'],
            'metric_value': float(confidence_pct),
            'metric_label': 'attackers beating xG by 30%+',
            'takeaway': (
                f'{sample_n_att} of {sample_total_att} high-volume attackers are outscoring '
                f'their xG by 30% or more — regression watch.'
            ),
            'action_hint': INSIGHT_ACTION_HINTS['att_top_xg_overperformers'],
            'benchmark_value': BENCHMARK_DEFAULTS['att_top_xg_overperformers'],
            'gw_coverage': (lambda _gw: f'GW1–{_gw}' if _gw > 0 else 'pre-season')(max((f.get("event") or 0 for f in finished), default=0)),
            'player_ids': [int(pid) for pid, _ in [(p.get('id'), p.get('web_name', '')) for p in overperformers[:5] if p.get('id')]],
            'team_ids': [],
            'player_names': [str(name) for _, name in [(p.get('id'), p.get('web_name', '')) for p in overperformers[:5] if p.get('id')]],
            'team_names': [],
            'signal_label': _signal_label('attacking', confidence_pct, 'att_top_xg_overperformers'),
        })

    # att_home_goal_share: fraction of finished-fixture goals by home team
    if len(finished) >= MIN_SAMPLE_TOTAL:
        home_goals = sum((f.get('team_h_score') or 0) for f in finished)
        away_goals = sum((f.get('team_a_score') or 0) for f in finished)
        total_goals = home_goals + away_goals
        if total_goals >= MIN_SAMPLE_TOTAL:
            confidence_pct = round(home_goals / total_goals * 100, 1)
            out.append({
                'id': 'att_home_goal_share',
                'category': 'attacking',
                'statement': (
                    f'{confidence_pct}% of all goals this season have been scored by the '
                    f'home team ({home_goals}/{total_goals}).'
                ),
                'confidence_pct': confidence_pct,
                'sample_n': int(home_goals),
                'sample_total': int(total_goals),
                'title': INSIGHT_TITLES['att_home_goal_share'],
                'metric_value': float(confidence_pct),
                'metric_label': 'of league goals scored at home',
                'takeaway': f'Home teams are scoring {confidence_pct}% of all PL goals this season.',
                'action_hint': INSIGHT_ACTION_HINTS['att_home_goal_share'],
                'benchmark_value': BENCHMARK_DEFAULTS['att_home_goal_share'],
                'gw_coverage': (lambda _gw: f'GW1–{_gw}' if _gw > 0 else 'pre-season')(max((f.get("event") or 0 for f in finished), default=0)),
                'player_ids': [],
                'team_ids': [],
                'player_names': [],
                'team_names': [],
                'signal_label': _signal_label('attacking', confidence_pct, 'att_home_goal_share'),
            })

    # att_top_team_goal_share: share of goals by top-scoring team
    teams = bootstrap.get('teams', [])
    teams_by_id = {t['id']: t for t in teams}
    if finished:
        team_goals: dict = {}
        for f in finished:
            h = f.get('team_h')
            a = f.get('team_a')
            if h is not None:
                team_goals[h] = team_goals.get(h, 0) + (f.get('team_h_score') or 0)
            if a is not None:
                team_goals[a] = team_goals.get(a, 0) + (f.get('team_a_score') or 0)
        if team_goals:
            total_all_goals = sum(team_goals.values())
            if total_all_goals >= MIN_SAMPLE_TOTAL:
                top_team_id = max(team_goals, key=lambda k: team_goals[k])
                top_team_goals = team_goals[top_team_id]
                top_team_short = teams_by_id.get(top_team_id, {}).get('short_name', f'Team{top_team_id}')
                confidence_pct = round(top_team_goals / total_all_goals * 100, 1)
                out.append({
                    'id': 'att_top_team_goal_share',
                    'category': 'attacking',
                    'statement': (
                        f'{top_team_short} have scored {confidence_pct}% of all PL goals '
                        f'this season ({top_team_goals}/{total_all_goals}).'
                    ),
                    'confidence_pct': confidence_pct,
                    'sample_n': int(top_team_goals),
                    'sample_total': int(total_all_goals),
                    'title': INSIGHT_TITLES['att_top_team_goal_share'],
                    'metric_value': float(confidence_pct),
                    'metric_label': 'PL goals from top-scoring side',
                    'takeaway': (
                        f'{top_team_short} have produced {confidence_pct}% of all PL goals this season '
                        f'— {top_team_goals} of {total_all_goals}.'
                    ),
                    'action_hint': INSIGHT_ACTION_HINTS['att_top_team_goal_share'],
                    'benchmark_value': BENCHMARK_DEFAULTS['att_top_team_goal_share'],
                    'gw_coverage': (lambda _gw: f'GW1–{_gw}' if _gw > 0 else 'pre-season')(max((f.get("event") or 0 for f in finished), default=0)),
                    'player_ids': [],
                    'team_ids': [int(top_team_id)],
                    'player_names': [],
                    'team_names': [str(top_team_short)],
                    'signal_label': _signal_label('attacking', confidence_pct, 'att_top_team_goal_share'),
                })

    return out


def _player_patterns(merged: list, summaries: dict, finished_gws: int) -> list:
    """Emit player-specific Insight dicts (buy/sell signals, differential/trap flags)."""
    out = []

    # Qualifying players: total_points >= 50 to avoid noise from bit-part players
    qualifying = [p for p in merged if (p.get('total_points') or 0) >= 50]
    sample_total = len(qualifying)

    if sample_total < MIN_SAMPLE_TOTAL:
        # Fallback: lower threshold if season is young
        qualifying = [p for p in merged if (p.get('total_points') or 0) >= 25]
        sample_total = len(qualifying)

    if sample_total >= MIN_SAMPLE_TOTAL:
        # player_buy_signal_count: players with regression_signal == 'buy'
        buy_players = [p for p in qualifying if p.get('regression_signal') == 'buy']
        sample_n_buy = len(buy_players)
        if sample_n_buy > 0:
            confidence_pct_buy = round(sample_n_buy / sample_total * 100, 1)
            out.append({
                'id': 'player_buy_signal_count',
                'category': 'player',
                'statement': (
                    f'{sample_n_buy} of {sample_total} regular starters ({confidence_pct_buy}%) '
                    f'carry a BUY signal — actual returns trail xG+xA over the last 5 GW.'
                ),
                'confidence_pct': confidence_pct_buy,
                'sample_n': int(sample_n_buy),
                'sample_total': int(sample_total),
                'title': INSIGHT_TITLES['player_buy_signal_count'],
                'metric_value': float(confidence_pct_buy),
                'metric_label': 'starters with BUY signal',
                'takeaway': (
                    f'{sample_n_buy} of {sample_total} regular starters carry a BUY signal — '
                    f'returns trail xG+xA over the last 5 GWs.'
                ),
                'action_hint': INSIGHT_ACTION_HINTS['player_buy_signal_count'],
                'benchmark_value': BENCHMARK_DEFAULTS['player_buy_signal_count'],
                'gw_coverage': f'GW1–{finished_gws}',
                'player_ids': [int(pid) for pid, _ in [(p.get('id'), p.get('web_name', '')) for p in buy_players[:5] if p.get('id')]],
                'team_ids': [],
                'player_names': [str(name) for _, name in [(p.get('id'), p.get('web_name', '')) for p in buy_players[:5] if p.get('id')]],
                'team_names': [],
                'signal_label': _signal_label('player', confidence_pct_buy, 'player_buy_signal_count'),
            })

        # player_sell_signal_count: players with regression_signal == 'sell'
        sell_players = [p for p in qualifying if p.get('regression_signal') == 'sell']
        sample_n_sell = len(sell_players)
        if sample_n_sell > 0:
            confidence_pct_sell = round(sample_n_sell / sample_total * 100, 1)
            out.append({
                'id': 'player_sell_signal_count',
                'category': 'player',
                'statement': (
                    f'{sample_n_sell} of {sample_total} regular starters ({confidence_pct_sell}%) '
                    f'carry a SELL signal — actual returns outpace xG+xA, regression likely.'
                ),
                'confidence_pct': confidence_pct_sell,
                'sample_n': int(sample_n_sell),
                'sample_total': int(sample_total),
                'title': INSIGHT_TITLES['player_sell_signal_count'],
                'metric_value': float(confidence_pct_sell),
                'metric_label': 'starters with SELL signal',
                'takeaway': (
                    f'{sample_n_sell} of {sample_total} regular starters carry a SELL signal — '
                    f'returns outpace xG+xA, regression likely.'
                ),
                'action_hint': INSIGHT_ACTION_HINTS['player_sell_signal_count'],
                'benchmark_value': BENCHMARK_DEFAULTS['player_sell_signal_count'],
                'gw_coverage': f'GW1–{finished_gws}',
                'player_ids': [int(pid) for pid, _ in [(p.get('id'), p.get('web_name', '')) for p in sell_players[:5] if p.get('id')]],
                'team_ids': [],
                'player_names': [str(name) for _, name in [(p.get('id'), p.get('web_name', '')) for p in sell_players[:5] if p.get('id')]],
                'team_names': [],
                'signal_label': _signal_label('player', confidence_pct_sell, 'player_sell_signal_count'),
            })

        # player_diff_count: players with differential_flag == 'diff'
        diff_players = [p for p in qualifying if p.get('differential_flag') == 'diff']
        sample_n_diff = len(diff_players)
        if sample_n_diff > 0:
            confidence_pct_diff = round(sample_n_diff / sample_total * 100, 1)
            out.append({
                'id': 'player_diff_count',
                'category': 'player',
                'statement': (
                    f'{sample_n_diff} of {sample_total} regular starters ({confidence_pct_diff}%) '
                    f'are differentials — high xPts with low ownership.'
                ),
                'confidence_pct': confidence_pct_diff,
                'sample_n': int(sample_n_diff),
                'sample_total': int(sample_total),
                'title': INSIGHT_TITLES['player_diff_count'],
                'metric_value': float(confidence_pct_diff),
                'metric_label': 'starters flagged differential',
                'takeaway': (
                    f'{sample_n_diff} of {sample_total} regular starters are differentials — '
                    f'high xPts with low ownership.'
                ),
                'action_hint': INSIGHT_ACTION_HINTS['player_diff_count'],
                'benchmark_value': BENCHMARK_DEFAULTS['player_diff_count'],
                'gw_coverage': f'GW1–{finished_gws}',
                'player_ids': [int(pid) for pid, _ in [(p.get('id'), p.get('web_name', '')) for p in diff_players[:5] if p.get('id')]],
                'team_ids': [],
                'player_names': [str(name) for _, name in [(p.get('id'), p.get('web_name', '')) for p in diff_players[:5] if p.get('id')]],
                'team_names': [],
                'signal_label': _signal_label('player', confidence_pct_diff, 'player_diff_count'),
            })

        # player_template_trap_count: players with differential_flag == 'trap'
        trap_players = [p for p in qualifying if p.get('differential_flag') == 'trap']
        sample_n_trap = len(trap_players)
        if sample_n_trap > 0:
            confidence_pct_trap = round(sample_n_trap / sample_total * 100, 1)
            out.append({
                'id': 'player_template_trap_count',
                'category': 'player',
                'statement': (
                    f'{sample_n_trap} of {sample_total} regular starters ({confidence_pct_trap}%) '
                    f'are template traps — widely held but underperforming on xPts.'
                ),
                'confidence_pct': confidence_pct_trap,
                'sample_n': int(sample_n_trap),
                'sample_total': int(sample_total),
                'title': INSIGHT_TITLES['player_template_trap_count'],
                'metric_value': float(confidence_pct_trap),
                'metric_label': 'starters flagged template trap',
                'takeaway': (
                    f'{sample_n_trap} of {sample_total} regular starters are template traps — '
                    f'widely held but underperforming on xPts.'
                ),
                'action_hint': INSIGHT_ACTION_HINTS['player_template_trap_count'],
                'benchmark_value': BENCHMARK_DEFAULTS['player_template_trap_count'],
                'gw_coverage': f'GW1–{finished_gws}',
                'player_ids': [int(pid) for pid, _ in [(p.get('id'), p.get('web_name', '')) for p in trap_players[:5] if p.get('id')]],
                'team_ids': [],
                'player_names': [str(name) for _, name in [(p.get('id'), p.get('web_name', '')) for p in trap_players[:5] if p.get('id')]],
                'team_names': [],
                'signal_label': _signal_label('player', confidence_pct_trap, 'player_template_trap_count'),
            })

    return out


def _captaincy_patterns(merged: list, summaries: dict) -> list:
    """Emit captaincy-pattern Insight dicts (top-3 xPts share, double-digit haul rate)."""
    out = []

    # cap_top3_xpts_share: top-3 captaincy options' share of total xPts
    available = [
        p for p in merged
        if p.get('status') == 'a' and (p.get('xPts_1gw') or 0) > 0
    ]
    if available:
        sorted_by_xpts = sorted(available, key=lambda p: p.get('xPts_1gw') or 0, reverse=True)
        top3 = sorted_by_xpts[:3]
        sum_all_xpts = sum(p.get('xPts_1gw') or 0 for p in available)
        sum_top3_xpts = sum(p.get('xPts_1gw') or 0 for p in top3)
        sample_total = len(available)       # number of available players
        sample_n = len(top3)                # always 3 when len(available) >= 3
        if sample_total >= MIN_SAMPLE_TOTAL:
            confidence_pct = round(sum_top3_xpts / sum_all_xpts * 100, 1)
            out.append({
                'id': 'cap_top3_xpts_share',
                'category': 'captaincy',
                'statement': (
                    f'The top 3 captaincy options account for {confidence_pct}% of available '
                    f'xPts this GW (from {sample_total} eligible players).'
                ),
                'confidence_pct': confidence_pct,
                'sample_n': int(sample_n),
                'sample_total': int(sample_total),
                'title': INSIGHT_TITLES['cap_top3_xpts_share'],
                'metric_value': float(confidence_pct),
                'metric_label': 'xPts share of top-3 captaincy options',
                'takeaway': (
                    f'The top three captaincy options account for {confidence_pct}% of all available xPts this GW '
                    f'(from {sample_total} eligible players).'
                ),
                'action_hint': INSIGHT_ACTION_HINTS['cap_top3_xpts_share'],
                'benchmark_value': BENCHMARK_DEFAULTS['cap_top3_xpts_share'],
                'gw_coverage': 'this GW',
                'player_ids': [int(p.get('id') or 0) for p in top3 if p.get('id')],
                'team_ids': [],
                'player_names': [str(p.get('web_name') or '') for p in top3 if p.get('web_name')],
                'team_names': [],
                'signal_label': _signal_label('captaincy', confidence_pct, 'cap_top3_xpts_share'),
            })

    # cap_double_digit_haul_rate: fraction of player appearances with 10+ points
    total_appearances = 0
    double_digit_appearances = 0
    for player_id, summary in summaries.items():
        history = summary.get('history', [])
        for match in history:
            if (match.get('minutes') or 0) > 0:
                total_appearances += 1
                if (match.get('total_points') or 0) >= 10:
                    double_digit_appearances += 1

    if total_appearances >= MIN_SAMPLE_TOTAL:
        confidence_pct = round(double_digit_appearances / total_appearances * 100, 1)
        out.append({
            'id': 'cap_double_digit_haul_rate',
            'category': 'captaincy',
            'statement': (
                f'Double-digit hauls (10+ pts) occur in {confidence_pct}% of player '
                f'appearances ({double_digit_appearances}/{total_appearances}).'
            ),
            'confidence_pct': confidence_pct,
            'sample_n': int(double_digit_appearances),
            'sample_total': int(total_appearances),
            'title': INSIGHT_TITLES['cap_double_digit_haul_rate'],
            'metric_value': float(confidence_pct),
            'metric_label': 'appearances yielding 10+ pts',
            'takeaway': (
                f'Double-digit hauls (10+ pts) occur in {confidence_pct}% of player appearances this season '
                f'({double_digit_appearances}/{total_appearances}).'
            ),
            'action_hint': INSIGHT_ACTION_HINTS['cap_double_digit_haul_rate'],
            'benchmark_value': BENCHMARK_DEFAULTS['cap_double_digit_haul_rate'],
            'gw_coverage': 'season-to-date',
            'player_ids': [],
            'team_ids': [],
            'player_names': [],
            'team_names': [],
            'signal_label': _signal_label('captaincy', confidence_pct, 'cap_double_digit_haul_rate'),
        })

    return out


if __name__ == '__main__':
    print('insights.py — call compute_insights() from pipeline/run.py')
