"""Exp03: missed-haul forensics over GW7-38.

Questions:
  1. How many actual haulers never even get a row (invisible: low prior
     minutes / blank history)?
  2. Of eligible-but-missed (not in top-20): minutes-model failure
     (caught in conditional mode) vs rate-model failure (missed in both)?
  3. What share of hauler points come from DefCon? Penalties? Are missed
     haulers disproportionately penalty takers / DefCon merchants?
  4. Does prior threat-per-90 distinguish missed haulers from the field?

Run from pipeline/:  python experiments/exp03_missed_hauls.py
"""
import json
import sys
from collections import defaultdict

sys.path.insert(0, '.')
from backtest import run_backtest, DEFAULT_PARAMS
from capture_season import load_season_archive

FIRST, LAST = 7, 38
HAUL = 10
TOP_N = 20
POS = {1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD'}
# 2025/26 DefCon rule: 2 pts at >=10 actions (DEF) / >=12 (MID+FWD)
DC_THRESHOLD = {2: 10, 3: 12, 4: 12}

TUNED = dict(DEFAULT_PARAMS, blend_alpha=0.2, form_window_gws=4,
             min_prior_minutes=180)


def main():
    archive = load_season_archive()
    elements = {e['id']: e for e in archive['bootstrap']['elements']}

    dep = run_backtest(archive=archive, params=TUNED, mode='deploy',
                       first_gw=FIRST, last_gw=LAST)
    con = run_backtest(archive=archive, params=TUNED, mode='conditional',
                       first_gw=FIRST, last_gw=LAST)

    # Rank rows per GW
    def top_ids(result, n):
        out = {}
        by_gw = defaultdict(list)
        for r in result['rows']:
            by_gw[r['gw']].append(r)
        for gw, rws in by_gw.items():
            rws.sort(key=lambda r: -r['xpts_pred'])
            out[gw] = {r['player_id'] for r in rws[:n]}
        return out

    dep_top = top_ids(dep, TOP_N)
    con_top = top_ids(con, TOP_N)
    dep_rows = {(r['player_id'], r['gw']): r for r in dep['rows']}

    # ALL actual haulers from raw archive (incl. players the model never rated)
    haulers = []
    for pid, summary in archive['summaries'].items():
        el = elements.get(pid)
        if el is None:
            continue
        by_gw = defaultdict(list)
        for e in summary.get('history', []):
            by_gw[e.get('round')].append(e)
        for gw in range(FIRST, LAST + 1):
            entries = by_gw.get(gw)
            if not entries:
                continue
            pts = sum(e.get('total_points', 0) or 0 for e in entries)
            if pts >= HAUL:
                dc = sum(e.get('defensive_contribution', 0) or 0
                         for e in entries)
                et = el['element_type']
                dc_pts = 2 * sum(
                    1 for e in entries
                    if (e.get('defensive_contribution', 0) or 0)
                    >= DC_THRESHOLD.get(et, 99))
                haulers.append({
                    'pid': pid, 'gw': gw, 'pts': pts, 'et': et,
                    'name': el.get('web_name'), 'dc_pts': dc_pts,
                    'pen_order': el.get('penalties_order'),
                    'visible': (pid, gw) in dep_rows,
                    'dep_hit': pid in dep_top.get(gw, set()),
                    'con_hit': pid in con_top.get(gw, set()),
                })

    n = len(haulers)
    invisible = [h for h in haulers if not h['visible']]
    caught = [h for h in haulers if h['dep_hit']]
    missed = [h for h in haulers if h['visible'] and not h['dep_hit']]
    mins_fail = [h for h in missed if h['con_hit']]

    print(f'=== {n} hauls GW{FIRST}-{LAST} (top-{TOP_N} capture) ===')
    print(f'caught (deploy top-20):    {len(caught):4d}  ({len(caught)/n:.1%})')
    print(f'missed but visible:        {len(missed):4d}  ({len(missed)/n:.1%})')
    print(f'  -> minutes-model failure: {len(mins_fail):3d}  '
          f'(caught by conditional)')
    print(f'  -> rate-model failure:    {len(missed)-len(mins_fail):3d}')
    print(f'invisible (no row at all): {len(invisible):4d}  '
          f'({len(invisible)/n:.1%})')

    print('\n=== position split ===')
    for et in (1, 2, 3, 4):
        ph = [h for h in haulers if h['et'] == et]
        pc = [h for h in ph if h['dep_hit']]
        if ph:
            print(f'  {POS[et]}: {len(ph):3d} hauls, caught {len(pc):3d} '
                  f'({len(pc)/len(ph):.1%})')

    print('\n=== DefCon points in hauls ===')
    dc_haulers = [h for h in haulers if h['dc_pts'] > 0]
    print(f'hauls including DefCon pts: {len(dc_haulers)} '
          f'({len(dc_haulers)/n:.1%})')
    dc_missed = [h for h in dc_haulers if not h['dep_hit']]
    print(f'  of which missed: {len(dc_missed)} '
          f'({(len(dc_missed)/len(dc_haulers)):.1%} of DefCon hauls)')

    print('\n=== penalty takers ===')
    pen = [h for h in haulers if h['pen_order'] == 1]
    pen_caught = [h for h in pen if h['dep_hit']]
    print(f'hauls by (final-season) pen taker #1: {len(pen)} '
          f'({len(pen)/n:.1%}); caught {len(pen_caught)} '
          f'({len(pen_caught)/len(pen):.1%})' if pen else 'none')

    print('\n=== top missed haulers (by points) ===')
    for h in sorted(missed, key=lambda h: -h['pts'])[:12]:
        r = dep_rows.get((h['pid'], h['gw']), {})
        print(f"  GW{h['gw']:2d} {h['name']:18s} {POS[h['et']]} "
              f"{h['pts']:2d}pts  pred={r.get('xpts_pred', 0):5.2f} "
              f"xmins={r.get('xmins_used', 0):5.1f} dc={h['dc_pts']}")

    json.dump({'n_hauls': n, 'caught': len(caught), 'missed': len(missed),
               'mins_fail': len(mins_fail), 'invisible': len(invisible),
               'dc_hauls': len(dc_haulers), 'dc_missed': len(dc_missed),
               'haulers': haulers},
              open('experiments/exp03_missed_hauls.json', 'w'))
    print('\nsaved experiments/exp03_missed_hauls.json')


if __name__ == '__main__':
    main()
