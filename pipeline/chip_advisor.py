"""CHP-01 — chip advisor: is THIS the gameweek to play a chip?

The pipeline hardcoded chip rules but never recommended usage; season-analytics
only scored chips after the user had played them. This module turns the
decision-ledger signals into pre-deadline advice per chip, with thresholds
grounded in the exp13 hindsight calendar of 2025/26:

  Bench Boost    best real GWs were DGW clusters (GW33 bench = 46 actual pts,
                 GW32 = 37) — recommend on predicted bench value + bench DGWs.
  Triple Captain best real GWs gave the captain 13-16 pts — recommend when the
                 top captain's PREDICTED xPts is elite, strongest on a DGW.
  Free Hit       leverage GWs where the model XI's predicted total spikes
                 (big DGW rounds) or a blank GW guts the field.
  Wildcard       no reliable single-GW signal — timing is fixture-swing driven;
                 deliberately reported as informational only in v1.

The advice is GENERIC (the pipeline cannot see which chips a user still holds):
each entry says what this GW offers, the user maps it to their remaining chips.
"""

from datetime import datetime, timezone

from gw_intel import _detect_dgw_bgw

# Predicted-value thresholds (tuned on exp13's 2025/26 hindsight calendar:
# median predicted bench ~8-10, best BB GWs predicted 14+; top captain xPts
# is ~7-8 in a normal GW, 9+ only in soft/double fixtures).
BB_PLAY = 14.0
BB_CONSIDER = 11.0
TC_PLAY = 9.0
TC_CONSIDER = 7.5
FH_BGW_TEAMS = 4          # this many blanking teams = Free Hit territory


def _signal(value, play_at, consider_at):
    if value >= play_at:
        return 'play'
    if value >= consider_at:
        return 'consider'
    return 'hold'


def build_chip_advice(merged: list, ledger: dict, current_gw: int) -> dict:
    """Pre-deadline chip advice from the decision ledger + fixture shape."""
    signals = (ledger or {}).get('chip_signals') or {}
    tc_value = float(signals.get('tc_value') or 0.0)
    bb_value = float(signals.get('bb_value') or 0.0)
    xi_xpts = float(signals.get('xi_xpts') or 0.0)

    dgw_bgw = _detect_dgw_bgw(merged, current_gw)
    dgw_teams = sorted(t for t, k in dgw_bgw.items() if k == 'dgw')
    bgw_teams = sorted(t for t, k in dgw_bgw.items() if k == 'bgw')

    bench = (ledger or {}).get('bench') or []
    xi = (ledger or {}).get('model_xi') or []
    cap = ((ledger or {}).get('captain_shadow') or {}).get('xi_top_xpts') or {}

    bb_sig = _signal(bb_value, BB_PLAY, BB_CONSIDER)
    if dgw_teams and bb_sig == 'consider':
        bb_sig = 'play'      # DGW bench value is sticky — upgrade
    tc_sig = _signal(tc_value, TC_PLAY, TC_CONSIDER)

    fh_sig = 'hold'
    fh_reason = 'No blank-GW pressure and no unusual XI ceiling this round.'
    if len(bgw_teams) >= FH_BGW_TEAMS:
        fh_sig = 'play'
        fh_reason = (f"{len(bgw_teams)} teams blank this GW — a Free Hit fields "
                     f"a full XI while the field starts shorthanded.")
    elif len(dgw_teams) >= 6:
        fh_sig = 'consider'
        fh_reason = (f"{len(dgw_teams)} teams double this GW — a Free Hit can "
                     f"load doubles without burning transfers.")

    return {
        'gw': current_gw,
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'dgw_team_count': len(dgw_teams),
        'bgw_team_count': len(bgw_teams),
        'chips': {
            'bench_boost': {
                'signal': bb_sig,
                'value': round(bb_value, 1),
                'reason': (f"Predicted bench = {bb_value:.1f} xPts"
                           + (f" with {len(dgw_teams)} DGW teams in play"
                              if dgw_teams else "")
                           + f" (2025/26's best BB weeks predicted 14+; "
                             f"hindsight best benches scored 30-46)."),
            },
            'triple_captain': {
                'signal': tc_sig,
                'value': round(tc_value, 1),
                'captain': cap.get('name'),
                'reason': (f"Top captain ({cap.get('name', '?')}) projects "
                           f"{tc_value:.1f} xPts — TC adds one more multiple of "
                           f"that. Elite weeks (9+ predicted) usually mean a "
                           f"premium on a double or a cupcake fixture."),
            },
            'free_hit': {
                'signal': fh_sig,
                'value': round(xi_xpts, 1),
                'reason': fh_reason,
            },
            'wildcard': {
                'signal': 'informational',
                'reason': ('Wildcard timing is fixture-swing driven, not '
                           'single-GW — play it when your squad needs 4+ '
                           'changes (see the transfer advisor: repeated '
                           'multi-move recommendations are the tell).'),
            },
        },
        'note': ('Generic advice — the pipeline cannot see which chips you '
                 'still hold. Values are PRE-deadline predictions, frozen in '
                 'the decision ledger so chip advice is backtestable.'),
        'n_xi': len(xi), 'n_bench': len(bench),
    }
