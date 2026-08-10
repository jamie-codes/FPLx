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

# Forward-window thresholds (fixture-shape, tuned to the same DGW/BGW basis as
# the single-GW signals). A GW joins a chip's window when its DGW/BGW team count
# clears these; 'strong' upgrades the merged window to 'play'.
BB_WIN_DGW = 4          # DGW teams that make a GW Bench-Boost territory
BB_WIN_DGW_STRONG = 6
TC_WIN_DGW = 4          # DGW rounds are Triple-Captain territory
TC_WIN_DGW_STRONG = 6
FH_WIN_BGW = 4          # blanking teams that make a GW Free-Hit territory (== FH_BGW_TEAMS)
FH_WIN_DGW = 8          # a very large double is a softer Free-Hit case


def _signal(value, play_at, consider_at):
    if value >= play_at:
        return 'play'
    if value >= consider_at:
        return 'consider'
    return 'hold'


def _max_scheduled_gw(merged: list, current_gw: int) -> int:
    """Highest event_id present in any player's fixtures, clamped to >= current_gw.

    This is the honesty horizon: past this GW the calendar isn't scheduled, so a
    team with zero fixtures there is NOT a real blank and must not create a window.
    """
    max_gw = current_gw
    for p in merged:
        for f in (p.get('fixtures') or []):
            eid = f.get('event_id')
            if eid is not None and eid > max_gw:
                max_gw = eid
    return max_gw


def _merge_runs(qualifying: list) -> list:
    """qualifying: sorted list of (gw, strength). Merge contiguous GWs into windows.

    Returns list of (start_gw, end_gw, strength) where strength is the strongest
    ('play' > 'consider') across the run.
    """
    rank = {'consider': 0, 'play': 1}
    windows = []
    for gw, strength in qualifying:
        if windows and gw == windows[-1][1] + 1:
            s, e, st = windows[-1]
            best = st if rank[st] >= rank[strength] else strength
            windows[-1] = (s, gw, best)
        else:
            windows.append((gw, gw, strength))
    return windows


def _team_max_gw(merged: list) -> dict:
    """Highest event_id scheduled per team (one representative player per team,
    matching _detect_dgw_bgw's dedup style).

    This is each team's own confirmed horizon: past it, a 0-fixture GW reflects
    fixture-list truncation (e.g. an early double consumed list capacity), not a
    real blank.
    """
    team_seen: set = set()
    out: dict = {}
    for p in merged:
        tid = p.get('team')
        if tid is None or tid in team_seen:
            continue
        team_seen.add(tid)
        gws = [f.get('event_id') for f in (p.get('fixtures') or []) if f.get('event_id') is not None]
        if gws:
            out[tid] = max(gws)
    return out


def _chip_windows(merged: list, current_gw: int, max_gw: int):
    """Scan current_gw..max_gw for DGW/BGW-driven chip windows.

    Returns (bb_windows, tc_windows, fh_windows) as lists of
    {start_gw, end_gw, strength, reason} dicts.
    """
    team_max_gw = _team_max_gw(merged)
    bb_q, tc_q, fh_q = [], [], []
    for gw in range(current_gw, max_gw + 1):
        kinds = _detect_dgw_bgw(merged, gw)
        n_dgw = sum(1 for k in kinds.values() if k == 'dgw')
        # A team only counts as a real blank if it has a fixture scheduled BEYOND
        # this GW in its own list — proving this GW is inside its confirmed
        # horizon. Teams whose list ends at/before `gw` are truncated, not blank.
        n_bgw = sum(1 for tid, k in kinds.items()
                    if k == 'bgw' and team_max_gw.get(tid, 0) > gw)
        if n_dgw >= BB_WIN_DGW:
            bb_q.append((gw, 'play' if n_dgw >= BB_WIN_DGW_STRONG else 'consider'))
        if n_dgw >= TC_WIN_DGW:
            tc_q.append((gw, 'play' if n_dgw >= TC_WIN_DGW_STRONG else 'consider'))
        if n_bgw >= FH_WIN_BGW:
            fh_q.append((gw, 'play'))
        elif n_dgw >= FH_WIN_DGW:
            fh_q.append((gw, 'consider'))

    def _fmt(runs, kind):
        out = []
        for s, e, st in runs:
            span = f"GW{s}" if s == e else f"GW{s}-{e}"
            out.append({'start_gw': s, 'end_gw': e, 'strength': st,
                        'reason': f"{kind} — {span}"})
        return out

    return (_fmt(_merge_runs(bb_q), 'DGW cluster'),
            _fmt(_merge_runs(tc_q), 'DGW round'),
            _fmt(_merge_runs(fh_q), 'blank/large-double'))


def build_chip_advice(merged: list, ledger: dict, current_gw: int) -> dict:
    """Pre-deadline chip advice from the decision ledger + fixture shape."""
    signals = (ledger or {}).get('chip_signals') or {}
    tc_value = float(signals.get('tc_value') or 0.0)
    bb_value = float(signals.get('bb_value') or 0.0)
    xi_xpts = float(signals.get('xi_xpts') or 0.0)

    dgw_bgw = _detect_dgw_bgw(merged, current_gw)
    dgw_teams = sorted(t for t, k in dgw_bgw.items() if k == 'dgw')
    bgw_teams = sorted(t for t, k in dgw_bgw.items() if k == 'bgw')

    max_gw = _max_scheduled_gw(merged, current_gw)
    bb_windows, tc_windows, fh_windows = _chip_windows(merged, current_gw, max_gw)

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
        'horizon_start': current_gw,
        'horizon_end': max_gw,
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
                'windows': bb_windows,
            },
            'triple_captain': {
                'signal': tc_sig,
                'value': round(tc_value, 1),
                'captain': cap.get('name'),
                'reason': (f"Top captain ({cap.get('name', '?')}) projects "
                           f"{tc_value:.1f} xPts — TC adds one more multiple of "
                           f"that. Elite weeks (9+ predicted) usually mean a "
                           f"premium on a double or a cupcake fixture."),
                'windows': tc_windows,
            },
            'free_hit': {
                'signal': fh_sig,
                'value': round(xi_xpts, 1),
                'reason': fh_reason,
                'windows': fh_windows,
            },
            'wildcard': {
                'signal': 'informational',
                'reason': ('Wildcard timing is fixture-swing driven, not '
                           'single-GW — play it when your squad needs 4+ '
                           'changes (see the transfer advisor: repeated '
                           'multi-move recommendations are the tell).'),
                'windows': [],
            },
        },
        'note': ('Generic advice — the pipeline cannot see which chips you '
                 'still hold. Values are PRE-deadline predictions, frozen in '
                 'the decision ledger so chip advice is backtestable.'),
        'n_xi': len(xi), 'n_bench': len(bench),
    }
