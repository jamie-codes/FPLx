"""TRF-01 — transfer advisor: best legal swaps from a 15-man squad.

exp13 (decision autopsy) showed even a myopic one-transfer-a-week policy added
~+125 XI points over 2025/26 vs holding a fixed squad — but the pipeline had no
transfer engine at all. This module is that engine, kept deliberately pure so
the SAME function is (a) validated on the season archive (exp14) and (b) run
live against the merged player pool each pipeline run.

Candidate shape (caller normalises — merged players and backtest rows differ):
    {id, name, element_type, team, cost, value, available}
  cost   in FPL tenths (now_cost / per-GW history `value`)
  value  the points metric to maximise (live: xPts_5gw; replay: xpts_pred)

Rules enforced: same-position swaps, <=3 per club, total squad cost within
budget (sell at current cost — FPL's half-profit sell rule needs the user's
purchase history, which the pipeline can't see; documented approximation),
unavailable players never come IN, and injured/suspended squad members are
prioritised OUT.

Hit maths: each transfer beyond `free_transfers` costs HIT_COST points; an
extra swap is only recommended when its predicted gain clears HIT_GAIN_MIN
(a -4 must be *clearly* beaten — exp13: hits added just +11 over a season).
"""

from collections import defaultdict

HIT_COST = 4
HIT_GAIN_MIN = 6.0       # predicted gain an EXTRA (paid) transfer must clear
FREE_GAIN_MIN = 1.0      # predicted gain a free transfer must clear (else hold)
MAX_PER_TEAM = 3


def _squad_bank(squad, budget):
    return budget - sum(p['cost'] for p in squad)


def suggest_transfers(squad, pool, free_transfers=1, budget=1000,
                      max_extra=2):
    """Rank the best swaps from `squad` using players in `pool`.

    Args:
        squad:          list of candidate dicts — the current 15.
        pool:           list of candidate dicts — the full player pool
                        (may include squad members; they are skipped as INs).
        free_transfers: how many free transfers are available (FPL: 1-5).
        budget:         total squad budget in tenths (cost of 15 + bank).
        max_extra:      max paid (-4) transfers to consider beyond the free ones.

    Returns dict:
        moves:            ordered swap list [{out, in, gain, reason, hit}]
        n_free_used:      free transfers consumed
        n_hits:           paid transfers recommended
        predicted_gain:   total predicted value gain (before hit costs)
        net_gain:         predicted gain minus hit points
        hold:             True when no move clears the bar
    """
    squad_by_id = {p['id']: p for p in squad}
    pool_ins = [p for p in pool if p['id'] not in squad_by_id
                and p.get('available', True)]

    current = list(squad)
    moves = []
    max_moves = free_transfers + max_extra

    while len(moves) < max_moves:
        bank = _squad_bank(current, budget)
        club_count = defaultdict(int)
        for p in current:
            club_count[p['team']] += 1

        best = None
        for out_p in current:
            # A forced sell (injured/suspended/eliminated) values the outgoing
            # player at 0 — replacing him is pure gain.
            out_value = out_p['value'] if out_p.get('available', True) else 0.0
            for in_p in pool_ins:
                if in_p['element_type'] != out_p['element_type']:
                    continue
                if in_p['cost'] > out_p['cost'] + bank:
                    continue
                if (club_count[in_p['team']] >= MAX_PER_TEAM
                        and in_p['team'] != out_p['team']):
                    continue
                gain = in_p['value'] - out_value
                if best is None or gain > best[0]:
                    best = (gain, out_p, in_p)

        if best is None:
            break
        gain, out_p, in_p = best
        is_hit = len(moves) >= free_transfers
        threshold = HIT_GAIN_MIN if is_hit else FREE_GAIN_MIN
        # Forced sells always go through within the free allocation.
        forced = not out_p.get('available', True)
        if gain < threshold and not (forced and not is_hit):
            break

        moves.append({
            'out': {'id': out_p['id'], 'name': out_p.get('name', ''),
                    'element_type': out_p['element_type'],
                    'cost': out_p['cost'], 'value': round(out_p['value'], 2),
                    'available': out_p.get('available', True)},
            'in': {'id': in_p['id'], 'name': in_p.get('name', ''),
                   'element_type': in_p['element_type'],
                   'cost': in_p['cost'], 'value': round(in_p['value'], 2)},
            'gain': round(gain, 2),
            'hit': is_hit,
            'reason': ('unavailable — forced replacement' if forced
                       else 'predicted upgrade'),
        })
        current = [p for p in current if p['id'] != out_p['id']] + [in_p]
        pool_ins = [p for p in pool_ins if p['id'] != in_p['id']]

    n_hits = sum(1 for m in moves if m['hit'])
    predicted = sum(m['gain'] for m in moves)
    return {
        'moves': moves,
        'n_free_used': len(moves) - n_hits,
        'n_hits': n_hits,
        'predicted_gain': round(predicted, 2),
        'net_gain': round(predicted - n_hits * HIT_COST, 2),
        'hold': not moves,
        'new_squad_ids': sorted(p['id'] for p in current),
    }


def init_squad_ilp(candidates, budget=1000):
    """Legal 15 (2/5/5/3, <=3 per club, budget) maximising value — the advisor
    trajectory's starting squad. PuLP CBC, mirrors suggest_squad's solver."""
    import pulp
    cand = [c for c in candidates if c.get('available', True) and c['cost'] > 0]
    prob = pulp.LpProblem('advisor_init', pulp.LpMaximize)
    x = {c['id']: pulp.LpVariable(f"x{c['id']}", cat='Binary') for c in cand}
    prob += pulp.lpSum(x[c['id']] * c['value'] for c in cand)
    prob += pulp.lpSum(x.values()) == 15
    for et, need in ((1, 2), (2, 5), (3, 5), (4, 3)):
        prob += pulp.lpSum(x[c['id']] for c in cand
                           if c['element_type'] == et) == need
    prob += pulp.lpSum(x[c['id']] * c['cost'] for c in cand) <= budget
    for t in {c['team'] for c in cand}:
        prob += pulp.lpSum(x[c['id']] for c in cand if c['team'] == t) <= MAX_PER_TEAM
    prob.solve(pulp.PULP_CBC_CMD(msg=0))
    return sorted(pid for pid, var in x.items() if var.value() == 1)


def advance_and_advise(state, candidates, current_gw, budget=1000,
                       free_transfers=1):
    """Advisor squad trajectory: commit at GW boundaries, advise every run.

    `state` = {'gw': int, 'squad_ids': [...], 'advised_squad_ids': [...]}
    or None on first run. Semantics:
      - first run: squad initialised by ILP for current_gw; advice computed.
      - same GW as state: squad unchanged; advice recomputed on fresh data.
      - GW advanced: the squad COMMITS to what was advised at the previous
        deadline (the trajectory follows its own advice — that is what makes
        it honestly backtestable), then fresh advice is computed.

    Returns (new_state, advice).
    """
    by_id = {c['id']: c for c in candidates}

    if state is None or not state.get('squad_ids'):
        squad_ids = init_squad_ilp(candidates, budget)
    elif current_gw > state.get('gw', 0):
        squad_ids = state.get('advised_squad_ids') or state['squad_ids']
    else:
        squad_ids = state['squad_ids']

    squad = []
    for pid in squad_ids:
        c = by_id.get(pid)
        if c is not None:
            squad.append(c)
        else:
            # No longer in the pool (transferred out of FPL / unregistered):
            # forced sell at zero value; cost unknown -> 0 (conservative).
            squad.append({'id': pid, 'name': str(pid), 'element_type': 3,
                          'team': 0, 'cost': 0, 'value': 0.0,
                          'available': False})

    advice = suggest_transfers(squad, candidates, free_transfers=free_transfers,
                               budget=budget)
    new_state = {'gw': current_gw, 'squad_ids': sorted(squad_ids),
                 'advised_squad_ids': advice['new_squad_ids']}
    return new_state, advice


STATE_FILE = 'transfer_advisor_state.json'


def load_advisor_state(cache_dir='pipeline/cache'):
    """Read the advisor trajectory state: local cache first, then Blob
    (mirrors run.py's season-archive read-back pattern). None on first run."""
    import json
    import os
    path = os.path.join(cache_dir, STATE_FILE)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    if os.getenv('USE_BLOB', '').lower() == 'true':
        try:
            import vercel_blob
            import requests
            blobs = vercel_blob.list({'prefix': STATE_FILE, 'limit': 1}).get('blobs', [])
            if blobs and blobs[0].get('url'):
                return requests.get(blobs[0]['url'], timeout=30).json()
        except Exception as exc:  # noqa: BLE001 — state is best-effort
            print(f"[transfer_advisor] state read failed (fresh start): {exc}")
    return None


def merged_to_candidates(merged, value_key='xPts_5gw', fallback_key='xPts_1gw'):
    """Normalise live merged-player dicts into advisor candidates."""
    out = []
    for p in merged:
        value = p.get(value_key)
        if value is None:
            value = p.get(fallback_key) or 0.0
        out.append({
            'id': p.get('id'),
            'name': p.get('web_name', ''),
            'element_type': p.get('element_type'),
            'team': p.get('team'),
            'cost': p.get('now_cost', 0),
            'value': float(value),
            'available': p.get('status') == 'a',
        })
    return out
