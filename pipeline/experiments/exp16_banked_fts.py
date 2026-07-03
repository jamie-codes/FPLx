"""TRF-03 / exp16: should the advisor BANK free transfers?

FPL banks unused free transfers (+1 per quiet week, cap 5). exp14 validated a
spend-1-every-week policy; this experiment tests whether letting the bank grow
— taking multi-free weeks when the advisor's gain bar finally clears — beats
it on the same 2025/26 replay.

  hold        never transfer (reference)
  spend1      exp14 as shipped: free_transfers=1 every week
  bank_smart  track available FTs (start 1, +1 per unused week, cap 5); offer
              the advisor ALL banked FTs each week — banking emerges naturally
              whenever no move clears the gain bar
  bank_patient  as bank_smart, but a week's advice is only ACTED ON when its
              best move gains >= PATIENCE_BAR — small upgrades wait, the bank
              grows, and multi-move weeks land when value concentrates

SHIP iff a banking policy > spend1.

Run:  cd pipeline; python -m experiments.exp16_banked_fts
"""
import json
import os
from collections import defaultdict

from backtest import run_backtest
from capture_season import load_season_archive
from transfer_advisor import suggest_transfers
from experiments.exp13_decision_autopsy import (_best_xi, _legal_squad_ilp,
                                                _team_lookup, _value_lookup)
from experiments import exp14_transfer_advisor as exp14

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    'exp16_banked_fts.json')
FIRST_GW = 7
LAST_GW = 38
BUDGET = 1000
FT_CAP = 5
PATIENCE_BAR = 2.5   # bank_patient: skip weeks whose best gain is below this


def run():
    archive = load_season_archive()
    exp14._ET = {e['id']: e['element_type'] for e in archive['bootstrap']['elements']}
    bt = run_backtest(archive, mode='deploy', first_gw=FIRST_GW, last_gw=LAST_GW)
    values = _value_lookup(archive)
    teams = _team_lookup(archive)

    rows_by_gw = defaultdict(list)
    for r in bt['rows']:
        rows_by_gw[r['gw']].append(r)
    gws = sorted(rows_by_gw)
    initial = _legal_squad_ilp(rows_by_gw[gws[0]], values, teams, gws[0])

    def week_score(squad_ids, gw):
        rows = [r for r in rows_by_gw[gw] if r['player_id'] in squad_ids]
        xi = _best_xi(rows, key=lambda r: r['xpts_pred'])
        if not xi:
            return 0.0
        cap = max(xi, key=lambda r: r['xpts_pred'])
        return sum(r['actual_pts'] for r in xi) + cap['actual_pts']

    results = {}
    for policy in ('hold', 'spend1', 'bank_smart', 'bank_patient'):
        squad_ids = set(initial)
        available = 1
        total, hits, n_moves = 0.0, 0, 0
        max_bank_seen = 1
        for gw in gws[1:]:
            if policy != 'hold':
                free = 1 if policy == 'spend1' else available
                squad, pool = exp14._candidates(rows_by_gw[gw], values, teams, gw,
                                                squad_ids)
                res = suggest_transfers(squad, pool, free_transfers=free,
                                        budget=BUDGET, max_extra=2)
                # Patience: forced sells always act; otherwise skip small-gain weeks.
                forced = any('forced' in m['reason'] for m in res['moves'])
                act = (policy != 'bank_patient' or res['hold'] or forced
                       or (res['moves'] and res['moves'][0]['gain'] >= PATIENCE_BAR))
                if act:
                    squad_ids = set(res['new_squad_ids'])
                    hits += res['n_hits']
                    n_moves += len(res['moves'])
                    used_free = res['n_free_used']
                else:
                    used_free = 0
                if policy in ('bank_smart', 'bank_patient'):
                    available = min(FT_CAP, available - used_free + 1)
                    max_bank_seen = max(max_bank_seen, available)
            total += week_score(squad_ids, gw)
        results[policy] = {
            'season_points': round(total - hits * 4, 0),
            'transfers_made': n_moves,
            'hit_points_paid': hits * 4,
            **({'max_bank_seen': max_bank_seen}
               if policy in ('bank_smart', 'bank_patient') else {}),
        }

    spend = results['spend1']['season_points']
    best_bank = max(results['bank_smart']['season_points'],
                    results['bank_patient']['season_points'])
    verdict = 'SHIP' if best_bank > spend else 'NO_SHIP'
    out = {'experiment': 'exp16_banked_fts', 'verdict': verdict,
           'results': results,
           'margin_best_bank_vs_spend1': round(best_bank - spend, 0),
           'config': {'first_gw': FIRST_GW, 'last_gw': LAST_GW, 'ft_cap': FT_CAP,
                      'patience_bar': PATIENCE_BAR}}
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)

    print(f"exp16 banked FTs  GW{FIRST_GW}-{LAST_GW}  verdict: {verdict}")
    for p, r in results.items():
        extra = f"  max bank {r['max_bank_seen']}" if 'max_bank_seen' in r else ''
        print(f"  {p:10s} {r['season_points']:.0f} pts ({r['transfers_made']} moves, "
              f"-{r['hit_points_paid']} hits){extra}")
    print(f"  written: {_OUT}")
    return out


if __name__ == '__main__':
    run()
