"""BT-02: leakage-free full-season backtest harness.

Offline lab over the SA-01 season archive. For each target GW, every model
input is reconstructed strictly from rounds BEFORE that GW — unlike
accuracy.py's backtest, which feeds the target GW's own xG and minutes into
its "prediction" (contemporaneous leakage).

Modes:
  deploy      — minutes predicted from prior rounds (deadline-day reality)
  conditional — target GW's actual minutes (isolates rate-model quality;
                per-90s remain strictly prior)

Usage:
  python backtest.py [--mode deploy|conditional] [--first-gw 7] [--last-gw 38]
                     [--set key=value ...] [--json out.json]

Public API:
  run_backtest(archive=None, params=None, mode='deploy',
               first_gw=7, last_gw=38) -> dict
  build_asof_signals(history, gw, params) -> dict | None
  compute_metrics(rows) -> (metrics: dict, per_gw: list)

Does NOT modify the live pipeline (accuracy.py / tune.py / run.py / merge.py).
"""
import argparse
import json
import math
import sys
from collections import defaultdict

DEFAULT_PARAMS = {
    # Mirrors live-model deployed behaviour (form gate OFF -> blend_alpha 0).
    'blend_alpha': 0.0,
    'form_window_gws': 5,
    'cs_prob_base': 0.40,
    'cs_prob_slope': 0.30,
    'cs_team_form_slope': 0.0,
    'cs_def_form_window_gws': 6,
    'atf_slope': 0.0,
    'atf_window_gws': 6,
    # BT-02-local
    'min_prior_minutes': 270,
    'xmins_window': 5,
}

HAUL_THRESHOLD = 10
TOP_N = 10
TOP_N_CAPTURE = 20
MID_TOP_N = 30
MIN_FORM_MINUTES = 90


def build_asof_signals(history: list, gw: int, params: dict):
    """Point-in-time signals for one player at target GW `gw`.

    Uses ONLY history entries with round < gw. Returns None when there are no
    prior entries. Eligibility (min_prior_minutes) is enforced by the caller
    so tests and experiments can inspect sub-threshold signals.
    """
    prior = [e for e in history if e.get('round', 0) < gw]
    if not prior:
        return None

    cum_minutes = sum(e.get('minutes', 0) or 0 for e in prior)
    cum_xg = sum(float(e.get('expected_goals', 0) or 0) for e in prior)
    cum_xa = sum(float(e.get('expected_assists', 0) or 0) for e in prior)

    if cum_minutes > 0:
        season_xg90 = cum_xg / cum_minutes * 90.0
        season_xa90 = cum_xa / cum_minutes * 90.0
    else:
        season_xg90 = season_xa90 = 0.0

    # Form: last form_window_gws prior entries actually played
    alpha = params['blend_alpha']
    xg_per90, xa_per90 = season_xg90, season_xa90
    if alpha > 0:
        played = [e for e in prior if (e.get('minutes', 0) or 0) > 0]
        window = played[-params['form_window_gws']:]
        form_min = sum(e.get('minutes', 0) or 0 for e in window)
        if form_min >= MIN_FORM_MINUTES:
            form_xg90 = sum(float(e.get('expected_goals', 0) or 0)
                            for e in window) / form_min * 90.0
            form_xa90 = sum(float(e.get('expected_assists', 0) or 0)
                            for e in window) / form_min * 90.0
            xg_per90 = (1 - alpha) * season_xg90 + alpha * form_xg90
            xa_per90 = (1 - alpha) * season_xa90 + alpha * form_xa90

    # Minutes model (deploy mode): last xmins_window prior entries
    last = prior[-params['xmins_window']:]
    n = len(last)
    xmins = sum(e.get('minutes', 0) or 0 for e in last) / n
    start_prob = sum(1 for e in last if (e.get('starts', 0) or 0) >= 1) / n
    mins_60_prob = sum(1 for e in last
                       if (e.get('minutes', 0) or 0) >= 60) / n
    sub_appear_prob = sum(1 for e in last
                          if 0 < (e.get('minutes', 0) or 0) < 45) / n

    return {
        'xg_per90': xg_per90,
        'xa_per90': xa_per90,
        'season_xg90': season_xg90,
        'season_xa90': season_xa90,
        'cum_minutes': cum_minutes,
        'xmins': xmins,
        'start_prob': start_prob,
        'mins_60_prob': mins_60_prob,
        'sub_appear_prob': sub_appear_prob,
    }
