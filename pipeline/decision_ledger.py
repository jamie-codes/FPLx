"""DEC-02 — per-GW decision ledger side-write.

exp13 (decision autopsy) showed the pipeline archives predictions but not
DECISIONS: transfer/XI/chip choices could only be reconstructed by replay,
and captain policy variants could not be compared on 2025/26 at all because
only the shipped picks were snapshotted.

This module freezes, pre-deadline, everything a decision backtest needs:

  - model XI       best formation-legal XI by xPts_1gw (available players)
  - bench          next-best GK + 3 outfielders outside the XI
  - captains       the shipped ceiling/EO picks PLUS shadow policy variants
                   (exp13: attacker-first mean-xPts beat the all-position rule
                   by ~+0.3 pts/GW — shadow-first until exp14 gates it)
  - chip signals   TC value (captain xPts), BB value (bench xPts), XI xPts
                   and DGW counts — the inputs a chip advisor needs, recorded
                   at decision time so chip timing is backtestable
  - top10          slim top-10 by xPts_1gw (transfer-target ground truth)

Side-write contract mirrors captain_snapshots.py (Phase 96 D-09): cache copy
always; per-GW Blob copy only when USE_BLOB=true. Additive — replaces nothing.
"""

import os
from collections import defaultdict
from datetime import datetime, timezone

FORMATIONS = [(3, 4, 3), (3, 5, 2), (4, 3, 3), (4, 4, 2), (4, 5, 1),
              (5, 3, 2), (5, 4, 1)]
POSITION_MAP = {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}


def _slim(p: dict) -> dict:
    return {
        'id': p.get('id'),
        'name': p.get('web_name', ''),
        'team': p.get('team_short_name', ''),
        'position': POSITION_MAP.get(p.get('element_type'), ''),
        'now_cost': p.get('now_cost', 0),
        'selected_by_percent': p.get('selected_by_percent', '0'),
        'xPts_1gw': p.get('xPts_1gw', 0.0),
        'xPts_90th_1gw': p.get('xPts_90th_1gw', 0.0),
    }


def _best_xi(players: list) -> list:
    """Exact best formation-legal XI by xPts_1gw (1 GK + d/m/f)."""
    by_pos = defaultdict(list)
    for p in players:
        by_pos[p.get('element_type')].append(p)
    for et in by_pos:
        by_pos[et].sort(key=lambda p: -(p.get('xPts_1gw') or 0.0))
    best, best_val = [], -1.0
    for d, m, f in FORMATIONS:
        if (not by_pos[1] or len(by_pos[2]) < d or len(by_pos[3]) < m
                or len(by_pos[4]) < f):
            continue
        xi = by_pos[1][:1] + by_pos[2][:d] + by_pos[3][:m] + by_pos[4][:f]
        val = sum(p.get('xPts_1gw') or 0.0 for p in xi)
        if val > best_val:
            best, best_val = xi, val
    return best


def build_decision_ledger(merged: list, captain_picks: dict,
                          current_gw: int) -> dict:
    """Assemble the pre-deadline decision record for one GW.

    Args:
        merged:        merged player dicts (post merge_players; xPts_1gw set).
        captain_picks: the shipped payload from merge._compute_captain_picks().
        current_gw:    finished_gws + 1 — the GW these decisions are FOR.
    """
    avail = [p for p in merged if p.get('status') == 'a'
             and (p.get('xPts_1gw') or 0.0) > 0]

    xi = _best_xi(avail)
    xi_ids = {p.get('id') for p in xi}
    outside = [p for p in avail if p.get('id') not in xi_ids]
    bench_gk = next((p for p in outside if p.get('element_type') == 1), None)
    bench_out = sorted((p for p in outside if p.get('element_type') != 1),
                       key=lambda p: -(p.get('xPts_1gw') or 0.0))[:3]
    bench = ([bench_gk] if bench_gk else []) + bench_out

    # Shadow captain policies (exp13 DEC-01). Shipped picks stay untouched.
    attackers = [p for p in avail if p.get('element_type') in (3, 4)]
    attacker_mean = max(attackers, key=lambda p: p.get('xPts_1gw') or 0.0,
                        default=None)
    xi_cap = max(xi, key=lambda p: p.get('xPts_1gw') or 0.0, default=None)

    tc_value = (xi_cap.get('xPts_1gw') or 0.0) if xi_cap else 0.0
    bb_value = sum(p.get('xPts_1gw') or 0.0 for p in bench)
    xi_xpts = sum(p.get('xPts_1gw') or 0.0 for p in xi)

    return {
        'gw': current_gw,
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'model_xi': [_slim(p) for p in xi],
        'bench': [_slim(p) for p in bench],
        'captain_shipped': {k: captain_picks.get(k) for k in
                            ('ceiling', 'eo_adjusted') if captain_picks},
        'captain_shadow': {
            'attacker_mean': _slim(attacker_mean) if attacker_mean else None,
            'xi_top_xpts': _slim(xi_cap) if xi_cap else None,
        },
        'chip_signals': {
            'tc_value': round(tc_value, 2),
            'bb_value': round(bb_value, 2),
            'xi_xpts': round(xi_xpts, 2),
        },
        'top10_xpts': [_slim(p) for p in
                       sorted(avail, key=lambda p: -(p.get('xPts_1gw') or 0.0))[:10]],
    }


def write_decision_ledger(ledger: dict, current_gw: int) -> None:
    """Per-GW Blob side-write (cache copy is the caller's save()).

    No-op when USE_BLOB is unset or not 'true' — mirrors captain_snapshots.
    """
    if os.getenv('USE_BLOB', '').lower() != 'true':
        return
    from upload import upload_json
    upload_json(f'decision_ledger_gw{current_gw}.json', ledger)
    print(f"Decision ledger uploaded to Blob: decision_ledger_gw{current_gw}.json")
