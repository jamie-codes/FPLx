"""ML-01: leakage-free feature extraction for the shadow model.

Wraps backtest.build_asof_signals (12 as-of signals) + fixture-level leakage-free
signals (def_form, atf_form, FPL difficulty, ODDS-01 cs_prob/attack_difficulty) +
static features (price, home, DGW count) into a flat numeric feature row, and
assembles a labelled (player, gw) dataset mirroring run_backtest's gating.
"""
from collections import defaultdict

from backtest import build_asof_signals

# Stable, ordered feature names (the model consumes vectors in this order).
_ASOF_FEATURES = [
    'xg_per90', 'xa_per90', 'season_xg90', 'season_xa90', 'cum_minutes',
    'xmins', 'start_prob', 'mins_60_prob', 'sub_appear_prob',
    'dc_rate_10', 'dc_rate_12', 'saves_per90',
]
_CTX_FEATURES = ['was_home', 'n_fixtures', 'norm_concede_rate', 'norm_attack_rate',
                 'difficulty', 'odds_cs_prob', 'attack_difficulty', 'now_cost']
FEATURE_NAMES = _ASOF_FEATURES + _CTX_FEATURES


def build_feature_row(history, gw, params, element, fixture_ctx):
    """Flat {feature_name: float} for one (player, gw), or None if no prior data.
    `element` supplies now_cost; `fixture_ctx` supplies the per-GW fixture signals."""
    sig = build_asof_signals(history, gw, params)
    if sig is None:
        return None
    row = {f: float(sig[f]) for f in _ASOF_FEATURES}
    row['was_home'] = float(fixture_ctx['was_home'])
    row['n_fixtures'] = float(fixture_ctx['n_fixtures'])
    row['norm_concede_rate'] = float(fixture_ctx['norm_concede_rate'])
    row['norm_attack_rate'] = float(fixture_ctx['norm_attack_rate'])
    row['difficulty'] = float(fixture_ctx['difficulty'])
    row['odds_cs_prob'] = float(fixture_ctx['odds_cs_prob'])
    row['attack_difficulty'] = float(fixture_ctx['attack_difficulty'])
    row['now_cost'] = float(element.get('now_cost', 0) or 0)
    return row


def _fixture_ctx(entries, gw, team_id, fixtures_by_id, def_form, atf_form,
                 odds_lookup):
    """Per-(player,gw) fixture context, averaged over the player's fixtures that GW
    (handles DGW). entries = the player's history rows for this gw."""
    n = len(entries)
    diffs, cs_probs, atk_diffs = [], [], []
    was_home_any = 0
    for e in entries:
        fix = fixtures_by_id.get(e.get('fixture'))
        if fix is None:
            continue
        was_home = bool(e.get('was_home'))
        was_home_any = max(was_home_any, 1 if was_home else 0)
        raw = fix.get('team_h_difficulty', 3) if was_home else fix.get('team_a_difficulty', 3)
        diffs.append((raw - 1) / 4.0)
        if odds_lookup is not None:
            od = odds_lookup.get((fix['id'], team_id))
            if od is not None:
                cs_probs.append(od['cs_prob'])
                atk_diffs.append(od['attack_difficulty'])
    mean = lambda xs, d: (sum(xs) / len(xs)) if xs else d
    return {
        'was_home': was_home_any,
        'n_fixtures': n,
        'norm_concede_rate': def_form.get((gw, team_id), 0.5),
        'norm_attack_rate': atf_form.get((gw, team_id), 0.5),
        'difficulty': mean(diffs, 0.5),
        'odds_cs_prob': mean(cs_probs, 0.0),
        'attack_difficulty': mean(atk_diffs, 0.0),
    }


def build_dataset(archive, params, first_gw=7, last_gw=38, odds_lookup=None):
    """Labelled (player, gw) rows mirroring run_backtest gating. Returns (rows, FEATURE_NAMES)."""
    from accuracy import build_team_def_form_lookup, build_team_atf_lookup

    fixtures = archive['fixtures']
    fixtures_by_id = {f['id']: f for f in fixtures}
    def_form = build_team_def_form_lookup(fixtures, params['cs_def_form_window_gws'])
    atf_form = build_team_atf_lookup(fixtures, params['atf_window_gws'])
    elements_by_id = {e['id']: e for e in archive['bootstrap']['elements']}

    rows = []
    for pid, summary in archive['summaries'].items():
        el = elements_by_id.get(pid)
        if el is None:
            continue
        team_id = el['team']
        history = summary.get('history', [])
        by_gw = defaultdict(list)
        for e in history:
            by_gw[e.get('round')].append(e)

        for gw in range(first_gw, last_gw + 1):
            entries = by_gw.get(gw)
            if not entries:
                continue
            sig = build_asof_signals(history, gw, params)
            if sig is None or sig['cum_minutes'] < params['min_prior_minutes']:
                continue
            if sig['xmins'] <= 0:   # deploy-mode gate (mirror run_backtest)
                continue
            ctx = _fixture_ctx(entries, gw, team_id, fixtures_by_id,
                               def_form, atf_form, odds_lookup)
            features = build_feature_row(history, gw, params, el, ctx)
            if features is None:
                continue
            rows.append({
                'features': features,
                'label': sum(e.get('total_points', 0) or 0 for e in entries),
                'element_type': el['element_type'],
                'player_id': pid,
                'web_name': el.get('web_name', str(pid)),
                'gw': gw,
                'actual_minutes': sum(e.get('minutes', 0) or 0 for e in entries),
                'n_fixtures': len(entries),
            })
    return rows, FEATURE_NAMES
