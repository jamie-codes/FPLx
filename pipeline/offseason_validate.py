"""OFFSEASON-01 face-validity gate. Run from pipeline/:  python offseason_validate.py

Builds COLD-01 priors from the committed archive, fetches live bootstrap+fixtures,
runs the off-season projection, and asserts face-validity checks. Exit 0=PASS, 1=FAIL.
"""
import json
import os
import sys
from capture_season import load_season_archive
from season_prior import build_prior_lookup, build_bucket_priors
from fpl_client import get_bootstrap_static, get_fixtures
from run import _offseason_merge


def _spearman(xs, ys):
    """Rank-correlation without scipy."""
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0] * len(v)
        for pos, i in enumerate(order):
            r[i] = pos
        return r
    rx, ry = rank(xs), rank(ys)
    n = len(xs)
    if n == 0:
        return 0.0
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    den = (sum((rx[i] - mx) ** 2 for i in range(n)) * sum((ry[i] - my) ** 2 for i in range(n))) ** 0.5
    return num / den if den else 0.0


def main():
    archive = load_season_archive()
    prior_lookup = build_prior_lookup(archive)
    bucket_priors = build_bucket_priors(archive)
    start_seed = {c: {'start_rate': p['start_rate'], 'mins_per_start': p['mins_per_start']}
                  for c, p in prior_lookup.items()}
    bs = get_bootstrap_static()
    fx = get_fixtures()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'player_id_map.json'),
              encoding='utf-8') as f:
        id_map = json.load(f)

    merged, _ = _offseason_merge(bs, fx, id_map, prior_lookup, bucket_priors, start_seed)
    by_id = {e['id']: e for e in bs['elements']}
    ranked = sorted(merged, key=lambda p: -float(p.get('xPts_5gw') or 0))
    top20 = ranked[:20]
    fails = []

    # A. Haaland (clear #1) must land in the top 5
    top5_names = {p['web_name'] for p in ranked[:5]}
    if 'Haaland' not in top5_names:
        fails.append(f"Haaland not in top5: {sorted(top5_names)}")

    # B. no <500-min (last season) cameo in the top 20
    for p in top20:
        mins = by_id.get(p['id'], {}).get('minutes', 0)
        if mins < 500:
            fails.append(f"cameo in top20: {p['web_name']} ({mins} min, x5={p.get('xPts_5gw')})")

    # C. at least 6 of the top 20 are mid-premium (now_cost >= 75)
    n_premium = sum(1 for p in top20 if by_id.get(p['id'], {}).get('now_cost', 0) >= 75)
    if n_premium < 6:
        fails.append(f"only {n_premium}/20 top players priced >= 7.5")

    # D. positive rank-correlation vs FPL ep_next and last-season points
    xs, en, lp = [], [], []
    for p in merged:
        e = by_id.get(p['id'])
        if not e:
            continue
        xs.append(float(p.get('xPts_5gw') or 0))
        en.append(float(e.get('ep_next') or 0))
        lp.append(float(e.get('total_points') or 0))
    corr_ep, corr_lp = _spearman(xs, en), _spearman(xs, lp)
    if corr_ep < 0.3:
        fails.append(f"low corr vs ep_next: {corr_ep:.2f}")
    if corr_lp < 0.3:
        fails.append(f"low corr vs last-season pts: {corr_lp:.2f}")

    print(f"corr(xPts5, ep_next)={corr_ep:.2f}  corr(xPts5, last_pts)={corr_lp:.2f}")
    print("TOP 10:", [(p['web_name'], round(float(p.get('xPts_5gw') or 0), 1)) for p in ranked[:10]])
    if fails:
        print("FACE-VALIDITY FAIL:")
        for msg in fails:
            print("  -", msg)
        sys.exit(1)
    print("FACE-VALIDITY PASS")
    sys.exit(0)


if __name__ == '__main__':
    main()
