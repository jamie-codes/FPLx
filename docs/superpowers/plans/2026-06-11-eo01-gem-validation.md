# EO-01: Gem Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the gem/differential logic against archived outcomes (template-beating objective), then promote only the threshold changes the data supports.

**Architecture:** Task 1 builds and runs the validation experiment (`exp06`) over the season archive + BT-02 honest predictions. Task 2 applies the spec's decision rules to the results: conditional, mechanical constant changes with tests. Experiment scripts follow the established exp01–05 convention (committed analysis scripts, no TDD); production changes (Task 2) are TDD.

**Tech Stack:** Python 3.11 (experiment + merge.py), Vitest (value-gems.ts if its constant changes).

---

## File map

| File | Change |
|---|---|
| `pipeline/experiments/exp06_gem_validation.py` | Create + run; commit with JSON output |
| `pipeline/merge.py` `_compute_differential_flag` | Conditional (decision rules) |
| `pipeline/tests/test_merge.py` (or wherever the flag's tests live — find them) | Conditional |
| `src/lib/value-gems.ts` + its test | Conditional |
| `docs/superpowers/specs/2026-06-11-next-season-roadmap.md` | Findings recorded either way |

Working directory: `pipeline/`

---

## Task 1: build + run `exp06_gem_validation.py`

**Files:** Create `pipeline/experiments/exp06_gem_validation.py`

### Step 1: Create the script

```python
"""Exp06 (EO-01): validate gem/differential logic against archived outcomes.

Success (user-chosen): a flagged player at GW g beats his TEMPLATE COUNTERPART
(most-owned player, same position, ±0.5m at-the-time price) on total points
over GWs g..g+2. Lift = flagged success rate − base rate (all eligible
non-flagged, measured identically).

Known limitations (spec'd): ownership % uses the FINAL total_players
denominator (underestimates pre-GW7 %; eval window starts GW7); status-at-time
is not archived (DIFF's status=='a' condition dropped — slightly pessimistic);
set-piece order is final-season (E4/E5 curve only).

Run from pipeline/:  python experiments/exp06_gem_validation.py
"""
import json
import sys
from collections import defaultdict

sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')
from backtest import run_backtest
from capture_season import load_season_archive

FIRST, LAST = 7, 36            # 3-GW outcome window must fit inside GW38
PROMOTED = {'blend_alpha': 0.2, 'form_window_gws': 4, 'min_prior_minutes': 180,
            'fixture_attack_slope': 0.4}
OWN_GRID = [3.0, 5.0, 8.0, 10.0, 15.0]
GATE_GRID = ['median', 'p75']
SPLIT_GW = 21                  # consistency check: GW7-21 vs GW22-36


def build_observations(archive):
    """One observation per eligible (player, gw): honest xpts, ownership %,
    price at the time, 3-GW outcome, and the template-counterpart outcome."""
    total_players = archive['bootstrap'].get('total_players') or 1
    elements = {e['id']: e for e in archive['bootstrap']['elements']}

    by_pg = defaultdict(list)                  # (pid, gw) -> entries
    gw_pool = defaultdict(list)                # gw -> [(pid, et, value, selected)]
    for pid, s in archive['summaries'].items():
        el = elements.get(pid)
        if el is None:
            continue
        for e in s.get('history', []):
            g = e.get('round')
            by_pg[(pid, g)].append(e)
    for (pid, g), entries in by_pg.items():
        e0 = entries[0]
        gw_pool[g].append((pid, elements[pid]['element_type'],
                           e0.get('value', 0) or 0, e0.get('selected', 0) or 0))

    def pts3(pid, g):
        return sum(e.get('total_points', 0) or 0
                   for gg in range(g, g + 3) for e in by_pg.get((pid, gg), []))

    def counterpart(pid, et, value, g):
        for band in (5, 10):                   # ±0.5m then ±1.0m
            cands = [(sel, q) for q, qet, qval, sel in gw_pool[g]
                     if q != pid and qet == et and abs(qval - value) <= band]
            if cands:
                return max(cands)[1]
        return None

    rows = run_backtest(archive=archive, params=PROMOTED, mode='deploy',
                        first_gw=FIRST, last_gw=LAST)['rows']
    obs = []
    skipped = 0
    for r in rows:
        pid, g = r['player_id'], r['gw']
        entries = by_pg.get((pid, g))
        if not entries:
            continue
        e0 = entries[0]
        value = e0.get('value', 0) or 0
        et = r['element_type']
        cp = counterpart(pid, et, value, g)
        if cp is None:
            skipped += 1
            continue
        obs.append({
            'pid': pid, 'gw': g, 'et': et, 'name': r['web_name'],
            'xpts': r['xpts_pred'],
            'own_pct': (e0.get('selected', 0) or 0) / total_players * 100,
            'pts3': pts3(pid, g),
            'cp_pts3': pts3(cp, g),
        })
    print(f'observations: {len(obs)} (skipped {skipped} with empty price band)')
    for o in obs:
        o['success'] = o['pts3'] > o['cp_pts3']
    return obs


def add_position_gates(obs):
    """Per (gw, et): median and 75th percentile of honest xpts."""
    by = defaultdict(list)
    for o in obs:
        by[(o['gw'], o['et'])].append(o['xpts'])
    gates = {}
    for k, xs in by.items():
        xs = sorted(xs)
        gates[k] = {'median': xs[len(xs) // 2],
                    'p75': xs[(len(xs) * 3) // 4]}
    for o in obs:
        gk = gates[(o['gw'], o['et'])]
        o['above_median'] = o['xpts'] > gk['median']
        o['above_p75'] = o['xpts'] > gk['p75']
    return obs


def rate(subset):
    return sum(1 for o in subset if o['success']) / len(subset) if subset else None


def main():
    archive = load_season_archive()
    obs = add_position_gates(build_observations(archive))
    base = rate(obs)
    print(f'\nbase success rate (all eligible): {base:.3f}  n={len(obs)}')

    out = {'base_rate': base, 'n_obs': len(obs)}

    # E1: current DIFF flag (median gate, own < 5)
    e1 = [o for o in obs if o['above_median'] and o['own_pct'] < 5.0]
    print(f"\nE1 current DIFF (median, <5%): n={len(e1)} "
          f"precision={rate(e1):.3f} lift={rate(e1) - base:+.3f}")
    out['E1'] = {'n': len(e1), 'precision': rate(e1)}

    # E2: TRAP inverse (below median, own > 15)
    e2 = [o for o in obs if not o['above_median'] and o['own_pct'] > 15.0]
    print(f"E2 TRAP (below median, >15%): n={len(e2)} "
          f"success={rate(e2):.3f} (base {base:.3f} — want clearly BELOW)")
    out['E2'] = {'n': len(e2), 'success': rate(e2)}

    # E3: threshold sweep + split consistency
    print(f"\nE3 sweep: {'gate':>7s} {'own<':>5s} {'n':>5s} {'prec':>6s} "
          f"{'lift':>7s} {'h1':>6s} {'h2':>6s}")
    out['E3'] = []
    for gate in GATE_GRID:
        key = 'above_median' if gate == 'median' else 'above_p75'
        for own in OWN_GRID:
            sub = [o for o in obs if o[key] and o['own_pct'] < own]
            h1 = rate([o for o in sub if o['gw'] <= SPLIT_GW])
            h2 = rate([o for o in sub if o['gw'] > SPLIT_GW])
            p = rate(sub)
            print(f"{gate:>7s} {own:5.0f} {len(sub):5d} "
                  f"{(p if p is not None else 0):6.3f} "
                  f"{((p - base) if p is not None else 0):+7.3f} "
                  f"{(h1 if h1 is not None else 0):6.3f} "
                  f"{(h2 if h2 is not None else 0):6.3f}")
            out['E3'].append({'gate': gate, 'own': own, 'n': len(sub),
                              'precision': p, 'h1': h1, 'h2': h2})

    # E4/E5: gem-score decile curves (with and without the ownership dim)
    curves = gem_score_curves(archive, obs)
    out.update(curves)
    for label in ('E4_with_ownership', 'E5_without_ownership'):
        print(f"\n{label} decile curve (mean pts3 per decile, low->high score):")
        print('  ' + ' '.join(f"{v:5.2f}" for v in out[label]['mean_pts3']))
        print('  success: ' + ' '.join(f"{v:5.2f}" for v in out[label]['success']))

    json.dump(out, open('experiments/exp06_gem_validation.json', 'w'), indent=1)
    print('\nsaved experiments/exp06_gem_validation.json')


def gem_score_curves(archive, obs):
    """Point-in-time gem score (mirrors src/lib/gem-score.ts: unweighted mean
    of min-max normalised dims), decile outcome curves with/without ownership."""
    elements = {e['id']: e for e in archive['bootstrap']['elements']}
    fixtures_by_team_gw = defaultdict(list)
    for f in archive['fixtures']:
        g = f.get('event')
        if g is None:
            continue
        fixtures_by_team_gw[(f['team_h'], g)].append((f.get('team_h_difficulty', 3) - 1) / 4.0)
        fixtures_by_team_gw[(f['team_a'], g)].append((f.get('team_a_difficulty', 3) - 1) / 4.0)

    hist = {pid: s.get('history', []) for pid, s in archive['summaries'].items()}

    def sp_rank(el):
        orders = [el.get('penalties_order'), el.get('direct_freekicks_order'),
                  el.get('corners_and_indirect_freekicks_order')]
        if any(o == 1 for o in orders):
            return 2.0
        if any(o == 2 for o in orders):
            return 1.0
        return 0.0

    raw = []   # (obs_index, dims dict)
    for i, o in enumerate(obs):
        el = elements[o['pid']]
        prior = [e for e in hist[o['pid']] if e.get('round', 0) < o['gw']]
        played = [e for e in prior if (e.get('minutes', 0) or 0) > 0]
        w = played[-5:]
        wmin = sum(e.get('minutes', 0) or 0 for e in w)
        cmin = sum(e.get('minutes', 0) or 0 for e in prior)
        d = {
            'fdr': 1.0 - (sum(fixtures_by_team_gw.get((el['team'], o['gw']), [0.5]))
                          / max(1, len(fixtures_by_team_gw.get((el['team'], o['gw']), [0.5])))),
            'form': (sum(e.get('total_points', 0) or 0 for e in w) / wmin * 90) if wmin >= 90 else 0.0,
            'own': 1.0 - o['own_pct'] / 100.0,
            'mins': (sum(e.get('minutes', 0) or 0 for e in w) / len(w) / 90.0) if w else 0.0,
            'sp': sp_rank(el),
        }
        if cmin >= 270:
            d['xg'] = sum(float(e.get('expected_goals', 0) or 0) for e in prior) / cmin * 90
            d['xa'] = sum(float(e.get('expected_assists', 0) or 0) for e in prior) / cmin * 90
        raw.append((i, d))

    # per-GW min-max normalisation per dim
    by_gw = defaultdict(list)
    for i, d in raw:
        by_gw[obs[i]['gw']].append((i, d))

    def curves_for(drop_own):
        scored = []
        for g, items in by_gw.items():
            keys = set()
            for _, d in items:
                keys.update(d)
            if drop_own:
                keys.discard('own')
            rng = {}
            for k in keys:
                vals = [d[k] for _, d in items if k in d]
                rng[k] = (min(vals), max(vals))
            for i, d in items:
                dims = []
                for k in keys:
                    if k not in d:
                        continue
                    lo, hi = rng[k]
                    dims.append(0.5 if hi - lo < 1e-9 else (d[k] - lo) / (hi - lo))
                scored.append((i, sum(dims) / len(dims), g))
        # deciles per GW
        decile_pts = defaultdict(list)
        decile_succ = defaultdict(list)
        per_gw = defaultdict(list)
        for i, sc, g in scored:
            per_gw[g].append((sc, i))
        for g, items in per_gw.items():
            items.sort()
            n = len(items)
            for rank, (sc, i) in enumerate(items):
                dec = min(9, rank * 10 // n)
                decile_pts[dec].append(obs[i]['pts3'])
                decile_succ[dec].append(1.0 if obs[i]['success'] else 0.0)
        return {
            'mean_pts3': [round(sum(decile_pts[d]) / len(decile_pts[d]), 3)
                          if decile_pts[d] else None for d in range(10)],
            'success': [round(sum(decile_succ[d]) / len(decile_succ[d]), 3)
                        if decile_succ[d] else None for d in range(10)],
        }

    return {'E4_with_ownership': curves_for(False),
            'E5_without_ownership': curves_for(True)}


if __name__ == '__main__':
    main()
```

### Step 2: Run it

Run: `cd pipeline && python experiments/exp06_gem_validation.py`
Expected: completes in < 60s; observation count in the thousands; all tables print; JSON written.

### Step 3: Sanity checks before trusting the numbers

- `n_obs` should be ≈ the BT-02 row count for GW7–36 minus a small skip count
- E1's n should be modest (the 5% gate is tight) but > 0
- base rate should sit WELL below 0.5 (beating the template counterpart is hard — the counterpart is usually a premium pick); if base > 0.5, inspect the counterpart logic for a bug (e.g. counterpart accidentally low-owned)
- E4 curve should be increasing if gem score has any signal at all

### Step 4: Commit

```bash
git add pipeline/experiments/exp06_gem_validation.py pipeline/experiments/exp06_gem_validation.json
git commit -m "exp(eo-01): gem/differential validation against archived outcomes"
```

---

## Task 2: apply the spec's decision rules

Read `experiments/exp06_gem_validation.json` and the spec's decision table (`docs/superpowers/specs/2026-06-11-eo01-gem-validation-design.md`). Then:

### 2a. DIFF threshold (conditional)

IF some E3 cell has `precision - base_rate >= 0.10` AND `n >= 50` AND both halves (`h1`, `h2`) individually above `base + 0.05`: update `pipeline/merge.py::_compute_differential_flag`:
- TDD: find the existing tests for the flag (`grep -rn "differential_flag\|_compute_differential_flag" pipeline/tests/`), add/adjust a test pinning the NEW threshold values first, watch it fail, then change the constants (`ownership < 5.0` → the validated value; the xPts gate comparison if `p75` won — that means comparing against the position's 75th percentile instead of median: compute it next to the existing median with the same pattern). Comment: `# EO-01 validated 2026-06 (exp06)`.
- Align `src/lib/value-gems.ts::isLowOwned` to the same ownership cut-off (update its test first; run `npx vitest run src/lib/value-gems.test.ts` or wherever its tests live — find them).
- Align the PICK-01 Under-the-Radar threshold (`src/lib/picks.ts::underTheRadar` default `maxOwnership = 10`) to the same value, updating `picks.test.ts`.

ELSE: no code change; record the best cell + why it failed the bar in the roadmap.

### 2b. TRAP (conditional)

IF E2 success ≤ `base - 0.10`: TRAP validated, no change needed (record it).
IF E2 success is NOT clearly below base (> base − 0.05): **STOP and report to the controller/user** — removal has UI implications and needs a user decision per spec.
Between those bands: record as inconclusive, no change.

### 2c. Gem-score ownership ablation (report only)

IF E5's curve is clearly better than E4's (higher top-decile mean_pts3 AND more monotonic): **report to the user with the two curves — do NOT change gem-score.ts** (spec rule).
ELSE: record inconclusive/validated in the roadmap.

### 2d. Findings recorded

Whatever happened, add the outcome lines to the roadmap doc (`2026-06-11-next-season-roadmap.md`) — shipped table if promoted, rejected/inconclusive table otherwise — and commit:
```bash
git add docs/superpowers/specs/2026-06-11-next-season-roadmap.md
git commit -m "docs(eo-01): record gem validation findings"
```

If 2a fired: full suites must be green (`python -m pytest tests/ -q` from pipeline/ AND `npm test` from root) before the constants commit:
```bash
git commit -m "feat(eo-01): validated differential thresholds (exp06)"
```

---

## Self-review notes

- Spec coverage: success/counterpart definition ✓ (build_observations), band widening ±0.5→±1.0→skip ✓, GW7–36 ✓, ownership denominator + documented limitations ✓ (docstring), E1–E5 ✓, decision rules incl. both user-return paths ✓ (2b/2c), out-of-scope constants untouched ✓, n≥50 + lift ≥10pp + split consistency ✓ (2a gate).
- The base-rate sanity expectation (well below 0.5) is a deliberate check: template counterparts are usually premiums.
- Type consistency: obs dict keys used in add_position_gates/main/gem_score_curves all produced in build_observations; counterpart returns pid used by pts3.
