"""Exp08 (COLD-01): H1->H2 cold-start prior validation.

Simulates "GW20 = GW1 of a mini-season" to validate the prior-blend approach
before live implementation.

Design (mirrors spec 2026-06-14-cold01-pre-season-prior-design.md):
  - prior        = each player's GW1-19 aggregate per-90 + xmins stats
  - cold window  = mini-GWs m=1..7 (actual GW 20..26)
  - at mini-GW m: "current" = GW20..(19+m-1); empty at m=1
  - Three arms:
      A. current-only:   naive cold-start (just GW20..now, near-empty at m=1)
      B. prior-blend:    w = min(1, cur_minutes/SEED); blend prior with current;
                         sweep SEED in {270, 360, 450, 540, 630, 720}
      C. pos-average:    position-mean per-90 from GW1-19 pool (>=500 min);
                         blended same as B at fixed SEED=540

  - Score each arm: compute xPts via _compute_xpts_fixture for each (player, target GW)
    using the arm's xg/xa + actual GW-g xmins/fixtures from archive, then rank
    top-10/top-20 against actual points.

  - Output: table: arm (+SEED for B) -> top10_mean_pts, haul_capture (top-20)
    for m=1..7 overall AND m=1..3 "early cold" window specifically.

  - KEY question: does B beat A early, and which SEED is best?

Run from pipeline/:  python experiments/exp08_coldstart.py
"""
import json
import sys
from collections import defaultdict

sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from capture_season import load_season_archive
from backtest import build_asof_signals, build_team_xgc_lookup, DEFAULT_PARAMS
from accuracy import build_team_def_form_lookup, build_team_atf_lookup
from merge import _compute_xpts_fixture

# H1 = prior window (GW1-19), H2 cold window (GW20-26)
H1_FIRST = 1
H1_LAST = 19
H2_FIRST = 20
H2_LAST = 26   # 7 mini-GWs

PRIOR_MIN_MINUTES = 500      # eligibility floor for prior construction
SEED_VALUES = [270, 360, 450, 540, 630, 720]
FIXED_SEED = 540             # for arm C bucket prior

# Default backtest params (mirrors PROMOTED from exp07)
PARAMS = dict(DEFAULT_PARAMS)
PARAMS.update({'blend_alpha': 0.2, 'form_window_gws': 4, 'min_prior_minutes': 180,
               'fixture_attack_slope': 0.4})

HAUL_THRESHOLD = 10
TOP_N = 10
TOP_N_CAPTURE = 20


def build_h1_prior(archive: dict) -> tuple[dict, dict]:
    """Build per-player H1 aggregate signals (GW1-19).

    Returns:
      player_prior: {pid -> {xg_per90, xa_per90, total_minutes, xmins, start_prob,
                             mins_60_prob, sub_appear_prob, element_type}}
      bucket_prior: {element_type -> {xg_per90, xa_per90}} (>=500 min players only)
    """
    elements_by_id = {e['id']: e for e in archive['bootstrap']['elements']}
    player_prior = {}

    # Collect per-element type pool for bucket prior
    bucket_pool = defaultdict(list)  # et -> list of (xg90, xa90)

    for pid, summary in archive['summaries'].items():
        el = elements_by_id.get(pid)
        if el is None:
            continue
        et = el['element_type']
        history = summary.get('history', [])

        # H1 entries only
        h1_entries = [e for e in history if H1_FIRST <= e.get('round', 0) <= H1_LAST]
        if not h1_entries:
            continue

        total_min = sum(e.get('minutes', 0) or 0 for e in h1_entries)
        total_xg = sum(float(e.get('expected_goals', 0) or 0) for e in h1_entries)
        total_xa = sum(float(e.get('expected_assists', 0) or 0) for e in h1_entries)

        if total_min <= 0:
            continue

        xg90 = total_xg / total_min * 90.0
        xa90 = total_xa / total_min * 90.0

        # xmins signals from H1 (last 5 entries of H1 for xmins window)
        last_h1 = h1_entries[-PARAMS['xmins_window']:]
        n = len(last_h1)
        xmins = sum(e.get('minutes', 0) or 0 for e in last_h1) / n
        start_prob = sum(1 for e in last_h1 if (e.get('starts', 0) or 0) >= 1) / n
        mins_60_prob = sum(1 for e in last_h1 if (e.get('minutes', 0) or 0) >= 60) / n
        sub_appear_prob = sum(1 for e in last_h1
                              if 0 < (e.get('minutes', 0) or 0) < 45) / n

        player_prior[pid] = {
            'xg_per90': xg90,
            'xa_per90': xa90,
            'total_minutes': total_min,
            'xmins': xmins,
            'start_prob': start_prob,
            'mins_60_prob': mins_60_prob,
            'sub_appear_prob': sub_appear_prob,
            'element_type': et,
        }

        # Eligible for bucket pool
        if total_min >= PRIOR_MIN_MINUTES:
            bucket_pool[et].append((xg90, xa90))

    # Build bucket priors: mean per-90 by element_type
    bucket_prior = {}
    for et, vals in bucket_pool.items():
        if vals:
            bucket_prior[et] = {
                'xg_per90': sum(v[0] for v in vals) / len(vals),
                'xa_per90': sum(v[1] for v in vals) / len(vals),
            }

    return player_prior, bucket_prior


def build_current_signals(history: list, from_gw: int, to_gw_excl: int) -> dict | None:
    """Build current-window aggregate per-90 and xmins from entries in [from_gw, to_gw_excl).

    Returns None if no played entries in this window (xmins must be >0 to be usable).
    """
    entries = [e for e in history if from_gw <= e.get('round', 0) < to_gw_excl]
    if not entries:
        return None

    total_min = sum(e.get('minutes', 0) or 0 for e in entries)
    total_xg = sum(float(e.get('expected_goals', 0) or 0) for e in entries)
    total_xa = sum(float(e.get('expected_assists', 0) or 0) for e in entries)

    if total_min > 0:
        xg90 = total_xg / total_min * 90.0
        xa90 = total_xa / total_min * 90.0
    else:
        xg90 = xa90 = 0.0

    # xmins from last PARAMS['xmins_window'] entries of the current window
    last_n = entries[-PARAMS['xmins_window']:]
    n = len(last_n)
    xmins = sum(e.get('minutes', 0) or 0 for e in last_n) / n
    start_prob = sum(1 for e in last_n if (e.get('starts', 0) or 0) >= 1) / n
    mins_60_prob = sum(1 for e in last_n if (e.get('minutes', 0) or 0) >= 60) / n
    sub_appear_prob = sum(1 for e in last_n
                          if 0 < (e.get('minutes', 0) or 0) < 45) / n

    return {
        'xg_per90': xg90,
        'xa_per90': xa90,
        'total_minutes': total_min,
        'xmins': xmins,
        'start_prob': start_prob,
        'mins_60_prob': mins_60_prob,
        'sub_appear_prob': sub_appear_prob,
    }


def blend_signals(prior: dict, current: dict | None, cur_minutes: float,
                  seed: float) -> dict:
    """Blend prior + current using weight w = min(1, cur_minutes/seed).

    Returns a signal dict with blended xg_per90/xa_per90 and appropriate xmins.
    When current is None (empty window), returns pure prior signals.
    """
    w = min(1.0, cur_minutes / seed) if seed > 0 else 0.0
    w = max(0.0, w)

    if current is None or w == 0.0:
        # Pure prior
        return {
            'xg_per90': prior['xg_per90'],
            'xa_per90': prior['xa_per90'],
            'xmins': prior['xmins'],
            'start_prob': prior['start_prob'],
            'mins_60_prob': prior['mins_60_prob'],
            'sub_appear_prob': prior['sub_appear_prob'],
        }

    prior_total = prior['xg_per90'] + prior['xa_per90']
    cur_total = current['xg_per90'] + current['xa_per90']
    blended_total = (1 - w) * prior_total + w * cur_total

    # Re-split by prior xG/xA share when current sample is thin
    if prior_total > 0:
        share = prior['xg_per90'] / prior_total
    else:
        share = 0.5

    blended_xg = blended_total * share
    blended_xa = blended_total * (1 - share)

    # For xmins: blend based on w too (prior xmins vs current xmins)
    blended_xmins = (1 - w) * prior['xmins'] + w * current['xmins']
    blended_start_prob = (1 - w) * prior['start_prob'] + w * current['start_prob']
    blended_mins60 = (1 - w) * prior['mins_60_prob'] + w * current['mins_60_prob']
    blended_sub = (1 - w) * prior['sub_appear_prob'] + w * current['sub_appear_prob']

    return {
        'xg_per90': blended_xg,
        'xa_per90': blended_xa,
        'xmins': blended_xmins,
        'start_prob': blended_start_prob,
        'mins_60_prob': blended_mins60,
        'sub_appear_prob': blended_sub,
    }


def build_rows_for_arm(archive: dict, player_prior: dict, bucket_prior: dict,
                       arm: str, seed: float | None = None) -> list[dict]:
    """Build prediction rows for all (player, target GW) in the H2 window.

    arm: 'A' = current-only, 'B' = prior-blend (needs seed), 'C' = bucket prior
    seed: for B and C (ignored for A)

    Returns list of row dicts with: pid, gw, mini_m, xpts_pred, actual_pts,
    element_type, xg_used, xa_used, xmins_used.
    """
    from accuracy import build_team_def_form_lookup, build_team_atf_lookup

    elements_by_id = {e['id']: e for e in archive['bootstrap']['elements']}
    fixtures = archive['fixtures']
    fixtures_by_id = {f['id']: f for f in fixtures}

    # Build team form lookups (using full season for fixture context)
    def_form = build_team_def_form_lookup(
        fixtures, PARAMS['cs_def_form_window_gws'])
    atf_form = build_team_atf_lookup(fixtures, PARAMS['atf_window_gws'])

    rows = []

    for pid, summary in archive['summaries'].items():
        el = elements_by_id.get(pid)
        if el is None:
            continue
        et = el['element_type']
        history = summary.get('history', [])

        # Check: player must have appeared in H1 (prior window)
        h1_entries = [e for e in history if H1_FIRST <= e.get('round', 0) <= H1_LAST]
        if not h1_entries:
            continue

        # Must have at least 1 H1 appearance (any minutes)
        h1_any_min = sum(e.get('minutes', 0) or 0 for e in h1_entries)
        if h1_any_min <= 0:
            continue

        prior = player_prior.get(pid)

        # Group history by round
        by_round = defaultdict(list)
        for e in history:
            by_round[e.get('round')].append(e)

        for mini_m in range(1, 8):   # m=1..7 => target GW = H2_FIRST + mini_m - 1
            target_gw = H2_FIRST + mini_m - 1  # GW 20..26

            # Target GW entries (what actually happened)
            target_entries = by_round.get(target_gw)
            if not target_entries:
                continue  # player had no match in this GW

            actual_pts = sum(e.get('total_points', 0) or 0 for e in target_entries)

            # Current window: GW20 .. (target_gw - 1), i.e. GW20..19+m-1
            # At m=1: empty (no current data yet)
            current = build_current_signals(history, H2_FIRST, target_gw)
            cur_minutes = current['total_minutes'] if current else 0.0

            # Determine xg/xa/xmins based on arm
            if arm == 'A':
                # Current-only: use only H2 data accumulated so far
                if current is None or current['xmins'] <= 0:
                    # No H2 data yet — use a zero signal (naive cold-start)
                    sig = {
                        'xg_per90': 0.0,
                        'xa_per90': 0.0,
                        'xmins': 0.0,
                        'start_prob': 0.0,
                        'mins_60_prob': 0.0,
                        'sub_appear_prob': 0.0,
                    }
                else:
                    sig = {
                        'xg_per90': current['xg_per90'],
                        'xa_per90': current['xa_per90'],
                        'xmins': current['xmins'],
                        'start_prob': current['start_prob'],
                        'mins_60_prob': current['mins_60_prob'],
                        'sub_appear_prob': current['sub_appear_prob'],
                    }

            elif arm == 'B':
                # Prior-blend: need a prior for this player
                if prior is None:
                    continue  # skip: no H1 data meeting eligibility
                sig = blend_signals(prior, current, cur_minutes, seed)

            elif arm == 'C':
                # Bucket prior: use position-average as the prior
                bkt = bucket_prior.get(et)
                if bkt is None:
                    continue

                # Build a bucket-prior dict (xmins from player's own H1 if available,
                # else position prior; this mirrors the spec's "blended same as B")
                if prior is not None:
                    bucket_as_prior = {
                        'xg_per90': bkt['xg_per90'],
                        'xa_per90': bkt['xa_per90'],
                        'xmins': prior['xmins'],
                        'start_prob': prior['start_prob'],
                        'mins_60_prob': prior['mins_60_prob'],
                        'sub_appear_prob': prior['sub_appear_prob'],
                    }
                else:
                    # No H1 prior for this player — can't get xmins signal
                    continue
                sig = blend_signals(bucket_as_prior, current, cur_minutes, seed)
            else:
                raise ValueError(f'Unknown arm: {arm}')

            # Skip if no expected minutes (can't score)
            if sig['xmins'] <= 0 or sig['start_prob'] <= 0:
                continue

            # Compute xPts over all target GW fixtures
            pred = 0.0
            for e in target_entries:
                fix = fixtures_by_id.get(e.get('fixture'))
                if fix is None:
                    continue
                was_home = bool(e.get('was_home'))
                team_id = fix['team_h'] if was_home else fix['team_a']
                diff_raw = (fix.get('team_h_difficulty', 3) if was_home
                            else fix.get('team_a_difficulty', 3))
                difficulty = (diff_raw - 1) / 4.0
                ncr = def_form.get((target_gw, team_id), 0.5)
                nar = atf_form.get((target_gw, team_id), 0.5)

                # FAS-01: fixture attack scaling (mirror PARAMS fixture_attack_slope)
                if PARAMS['fixture_attack_slope'] > 0.0:
                    atk_scale = max(0.0, 1.0 + (0.5 - difficulty) * PARAMS['fixture_attack_slope'])
                    xg_used = sig['xg_per90'] * atk_scale
                    xa_used = sig['xa_per90'] * atk_scale
                else:
                    xg_used = sig['xg_per90']
                    xa_used = sig['xa_per90']

                result = _compute_xpts_fixture(
                    xg_per90=xg_used,
                    xa_per90=xa_used,
                    start_prob=sig['start_prob'],
                    xmins=sig['xmins'],
                    element_type=et,
                    defensive_difficulty=difficulty,
                    mins_60_prob=sig['mins_60_prob'],
                    sub_appear_prob=sig['sub_appear_prob'],
                    cs_prob_base=PARAMS['cs_prob_base'],
                    cs_prob_slope=PARAMS['cs_prob_slope'],
                    norm_concede_rate=ncr,
                    cs_team_form_slope=PARAMS['cs_team_form_slope'],
                    norm_attack_rate=nar,
                    atf_slope=PARAMS['atf_slope'],
                )
                pred += result['total']

            rows.append({
                'pid': pid,
                'gw': target_gw,
                'mini_m': mini_m,
                'element_type': et,
                'xpts_pred': round(pred, 3),
                'actual_pts': actual_pts,
                'xg_used': round(sig['xg_per90'], 4),
                'xa_used': round(sig['xa_per90'], 4),
                'xmins_used': round(sig['xmins'], 1),
                'cur_minutes': round(cur_minutes, 1),
            })

    return rows


def evaluate_rows(rows: list, label: str, gw_filter=None) -> dict:
    """Evaluate top10_mean_pts and haul_capture (top-20) across GWs.

    gw_filter: optional callable (gw) -> bool; if None, uses all rows.
    """
    by_gw = defaultdict(list)
    for r in rows:
        if gw_filter is None or gw_filter(r['gw']):
            by_gw[r['gw']].append(r)

    if not by_gw:
        return {'label': label, 'n_gws': 0, 'top10_mean_pts': None, 'haul_capture': None}

    top10_means = []
    haul_hits20 = 0
    total_haulers = 0

    for gw, gw_rows in sorted(by_gw.items()):
        gw_rows_sorted = sorted(gw_rows, key=lambda r: -r['xpts_pred'])
        top10 = gw_rows_sorted[:TOP_N]
        top20_ids = {r['pid'] for r in gw_rows_sorted[:TOP_N_CAPTURE]}

        haulers = [r for r in gw_rows if r['actual_pts'] >= HAUL_THRESHOLD]
        total_haulers += len(haulers)
        haul_hits20 += sum(1 for r in haulers if r['pid'] in top20_ids)

        if top10:
            top10_means.append(sum(r['actual_pts'] for r in top10) / len(top10))

    return {
        'label': label,
        'n_gws': len(by_gw),
        'top10_mean_pts': round(sum(top10_means) / len(top10_means), 4) if top10_means else None,
        'haul_capture': round(haul_hits20 / total_haulers, 4) if total_haulers > 0 else None,
        'n_haulers': total_haulers,
    }


def main():
    print('Loading season archive...')
    archive = load_season_archive()

    print('Building H1 priors (GW1-19)...')
    player_prior, bucket_prior = build_h1_prior(archive)
    print(f'  {len(player_prior)} players with H1 prior; '
          f'bucket priors for positions: {sorted(bucket_prior.keys())}')
    for et, bkt in sorted(bucket_prior.items()):
        pos = {1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD'}.get(et, str(et))
        print(f'    {pos}: xg90={bkt["xg_per90"]:.4f}  xa90={bkt["xa_per90"]:.4f}')

    results = []

    # mini-GW m=1 is GW20 (true cold-start: A has zero rows).
    # mini-GW m=2..3 are GW21..22 (A has 1 GW of current data).
    # Early = m=1..3; same-GWs = m=2..3 (where both A and B can predict).
    GW_M1 = H2_FIRST          # GW20
    GW_M3 = H2_FIRST + 2      # GW22

    # ── Arm A: current-only ──────────────────────────────────────────────────
    print('\nBuilding Arm A (current-only)...')
    rows_a = build_rows_for_arm(archive, player_prior, bucket_prior, 'A')
    print(f'  {len(rows_a)} rows (across mini-GWs 1-7)')
    res_a_full = evaluate_rows(rows_a, 'A_current_only')
    res_a_early = evaluate_rows(rows_a, 'A_current_only (m=1-3)',
                                gw_filter=lambda g: g <= GW_M3)
    res_a_shared = evaluate_rows(rows_a, 'A_current_only (m=2-3)',
                                 gw_filter=lambda g: GW_M1 < g <= GW_M3)
    results.append(('A_current_only', None, res_a_full, res_a_early, res_a_shared))

    # ── Arm B: prior-blend sweep ──────────────────────────────────────────────
    for seed in SEED_VALUES:
        print(f'Building Arm B (prior-blend, SEED={seed})...')
        rows_b = build_rows_for_arm(archive, player_prior, bucket_prior, 'B', seed=seed)
        print(f'  {len(rows_b)} rows')
        res_b_full = evaluate_rows(rows_b, f'B_blend_seed{seed}')
        res_b_early = evaluate_rows(rows_b, f'B_blend_seed{seed} (m=1-3)',
                                    gw_filter=lambda g: g <= GW_M3)
        res_b_shared = evaluate_rows(rows_b, f'B_blend_seed{seed} (m=2-3)',
                                     gw_filter=lambda g: GW_M1 < g <= GW_M3)
        results.append((f'B_blend_seed{seed}', seed, res_b_full, res_b_early, res_b_shared))

    # ── Arm C: bucket prior (position average) ────────────────────────────────
    print(f'Building Arm C (bucket prior, SEED={FIXED_SEED})...')
    rows_c = build_rows_for_arm(archive, player_prior, bucket_prior, 'C', seed=FIXED_SEED)
    print(f'  {len(rows_c)} rows')
    res_c_full = evaluate_rows(rows_c, f'C_bucket_seed{FIXED_SEED}')
    res_c_early = evaluate_rows(rows_c, f'C_bucket_seed{FIXED_SEED} (m=1-3)',
                                gw_filter=lambda g: g <= GW_M3)
    res_c_shared = evaluate_rows(rows_c, f'C_bucket_seed{FIXED_SEED} (m=2-3)',
                                 gw_filter=lambda g: GW_M1 < g <= GW_M3)
    results.append(('C_bucket_prior', FIXED_SEED, res_c_full, res_c_early, res_c_shared))

    # ── Print results table ───────────────────────────────────────────────────
    print('\n' + '=' * 80)
    print('COLD-01 RESULTS: H1->H2 cold-start prior validation')
    print('=' * 80)
    print('NOTE: Arm A has 0 rows at m=1 (GW20) — it literally cannot predict at cold start.')
    print('      m=1-3 comparison is skewed: A covers 2 GWs, B/C cover 3 GWs.')
    print('      m=2-3 (same-GWs) comparison is the fair matched comparison.\n')

    header = f"{'arm':<25s}  {'SEED':>5s}  "
    header += f"{'m=1-7 top10pts':>14s}  {'m=1-7 haul@20':>13s}  "
    header += f"{'m=1-3 top10pts':>14s}  {'m=1-3 haul@20':>13s}  "
    header += f"{'m=2-3 top10pts':>14s}  {'m=2-3 haul@20':>13s}"
    print(header)
    print('-' * 110)

    table_rows = []
    for arm_name, seed, full, early, shared in results:
        seed_str = str(seed) if seed is not None else '—'
        t10_full = f'{full["top10_mean_pts"]:.4f}' if full['top10_mean_pts'] is not None else 'N/A'
        hc_full = f'{full["haul_capture"]:.4f}' if full['haul_capture'] is not None else 'N/A'
        t10_early = f'{early["top10_mean_pts"]:.4f}' if early['top10_mean_pts'] is not None else 'N/A'
        hc_early = f'{early["haul_capture"]:.4f}' if early['haul_capture'] is not None else 'N/A'
        t10_shared = f'{shared["top10_mean_pts"]:.4f}' if shared['top10_mean_pts'] is not None else 'N/A'
        hc_shared = f'{shared["haul_capture"]:.4f}' if shared['haul_capture'] is not None else 'N/A'
        print(f'{arm_name:<25s}  {seed_str:>5s}  '
              f'{t10_full:>14s}  {hc_full:>13s}  '
              f'{t10_early:>14s}  {hc_early:>13s}  '
              f'{t10_shared:>14s}  {hc_shared:>13s}')
        table_rows.append({
            'arm': arm_name,
            'seed': seed,
            'full_m1_7': full,
            'early_m1_3': early,
            'shared_m2_3': shared,
        })

    # ── Verdict ───────────────────────────────────────────────────────────────
    print('\n' + '=' * 80)
    print('VERDICT')
    print('=' * 80)

    arm_a_early = [e for n, _, __, e, _s in results if n == 'A_current_only'][0]
    arm_a_shared = [s for n, _, __, _e, s in results if n == 'A_current_only'][0]
    arm_c_early = [e for n, _, __, e, _s in results if n == 'C_bucket_prior'][0]
    arm_c_shared = [s for n, _, __, _e, s in results if n == 'C_bucket_prior'][0]

    # Find best B seed by early top10_mean_pts (m=1-3)
    b_results = [(n, s, f, e, sh) for n, s, f, e, sh in results if n.startswith('B_')]
    best_b = max(b_results, key=lambda x: x[3]['top10_mean_pts'] or 0)
    best_b_name, best_b_seed, best_b_full, best_b_early, best_b_shared = best_b

    # Also find best B by shared (m=2-3) top10pts for the tie-breaker
    best_b_sh = max(b_results, key=lambda x: x[4]['top10_mean_pts'] or 0)

    # Primary comparisons: m=1-3 (includes GW20 where A=0)
    a_t10 = arm_a_early['top10_mean_pts'] or 0
    c_t10 = arm_c_early['top10_mean_pts'] or 0
    b_t10 = best_b_early['top10_mean_pts'] or 0
    a_hc = arm_a_early['haul_capture'] or 0
    c_hc = arm_c_early['haul_capture'] or 0
    b_hc = best_b_early['haul_capture'] or 0

    # Shared comparisons: m=2-3 (apples-to-apples, both arms have data)
    a_t10_sh = arm_a_shared['top10_mean_pts'] or 0
    c_t10_sh = arm_c_shared['top10_mean_pts'] or 0
    c_hc_sh = arm_c_shared['haul_capture'] or 0
    b_t10_sh = best_b_sh[4]['top10_mean_pts'] or 0   # [4] = shared window
    b_hc_sh = best_b_sh[4]['haul_capture'] or 0
    a_hc_sh = arm_a_shared['haul_capture'] or 0
    best_b_seed_sh = best_b_sh[1]

    # GW20 coverage check: Arm A has 0 rows at m=1; all B arms have same coverage
    # (at m=1 w=0 for all seeds, so signal = pure prior regardless of SEED)
    # rows_b is the last B built (SEED=720) — valid for coverage count.
    a_gw20_rows = sum(1 for r in rows_a if r['gw'] == GW_M1)
    b_gw20_rows = sum(1 for r in rows_b if r['gw'] == GW_M1)

    print(f'\nGW20 (m=1) coverage: Arm A = {a_gw20_rows} rows, Arm B = {b_gw20_rows} rows')
    print('  (Arm A has ZERO GW20 coverage — it cannot function at all at true cold-start)')

    print(f'\nBest B for m=1-3 early: SEED={best_b_seed}')
    print(f'  m=1-3 top10_mean_pts:  A={a_t10:.4f}  B={b_t10:.4f}  C={c_t10:.4f}')
    print(f'  m=1-3 haul_capture:    A={a_hc:.4f}  B={b_hc:.4f}  C={c_hc:.4f}')
    print(f'  NOTE: A covers 2 GWs; B/C cover 3 GWs — haul comparison is NOT apples-to-apples')

    print(f'\nBest B for m=2-3 shared (apples-to-apples): SEED={best_b_seed_sh}')
    print(f'  m=2-3 top10_mean_pts:  A={a_t10_sh:.4f}  B={b_t10_sh:.4f}  C={c_t10_sh:.4f}')
    print(f'  m=2-3 haul_capture:    A={a_hc_sh:.4f}  B={b_hc_sh:.4f}  C={c_hc_sh:.4f}')

    b_beats_a_t10 = b_t10 > a_t10
    b_beats_a_hc_early = b_hc > a_hc
    b_beats_c_t10 = b_t10 > c_t10

    # Shared comparisons (more honest)
    b_beats_a_t10_sh = b_t10_sh > a_t10_sh
    b_beats_a_hc_sh = b_hc_sh > a_hc_sh

    # GW20 coverage is a binary WIN for B (A cannot function)
    b_wins_gw20_coverage = a_gw20_rows == 0 and b_gw20_rows > 0

    print(f'\n  B > A on m=1-3 top10pts?          {"YES" if b_beats_a_t10 else "NO"}  '
          f'(delta {b_t10 - a_t10:+.4f})')
    print(f'  B > A on m=1-3 haul@20?           {"YES" if b_beats_a_hc_early else "NO"}  '
          f'(delta {b_hc - a_hc:+.4f})  [biased — different GW count]')
    print(f'  B > A on m=2-3 top10pts (fair)?   {"YES" if b_beats_a_t10_sh else "NO"}  '
          f'(delta {b_t10_sh - a_t10_sh:+.4f})')
    print(f'  B > A on m=2-3 haul@20 (fair)?    {"YES" if b_beats_a_hc_sh else "NO"}  '
          f'(delta {b_hc_sh - a_hc_sh:+.4f})')
    print(f'  B > C on m=1-3 top10pts?          {"YES" if b_beats_c_t10 else "NO"}  '
          f'(delta {b_t10 - c_t10:+.4f})')
    print(f'  A has ZERO GW20 coverage?          {"YES — A is non-functional at m=1" if b_wins_gw20_coverage else "NO"}')

    # Verdict: B wins if it beats A early on t10 AND has GW20 coverage (A doesn't)
    # The haul comparison is secondary and biased by GW coverage differences.
    if b_wins_gw20_coverage and b_beats_a_t10:
        if b_beats_a_t10_sh:
            verdict = ('VALIDATE: prior-blend beats current-only on top10pts in both '
                       'early (m=1-3) and shared (m=2-3) windows, AND provides '
                       'full GW1 coverage that A lacks entirely — SHIP the live model.')
        else:
            verdict = ('PARTIAL VALIDATE: prior-blend provides GW1 coverage A lacks '
                       'and beats A on m=1-3 top10pts (B has GW20; A does not). '
                       'On the shared m=2-3 window B does not beat A on top10pts — '
                       'B is primarily valuable for GW1 cold-start coverage, not ongoing edge.')
    elif b_beats_a_t10:
        verdict = ('VALIDATE: prior-blend beats current-only on early top10pts '
                   '— SHIP the live model.')
    else:
        verdict = ('REJECT: prior-blend does NOT beat current-only on early window — '
                   'do NOT ship the live model without further investigation.')

    print(f'\n  {verdict}')
    print(f'  Recommended SEED_MINUTES={best_b_seed}')

    # ── Save JSON ─────────────────────────────────────────────────────────────
    out = {
        'config': {
            'h1_window': f'GW{H1_FIRST}-{H1_LAST}',
            'h2_window': f'GW{H2_FIRST}-{H2_LAST}',
            'seed_values_swept': SEED_VALUES,
            'fixed_seed_c': FIXED_SEED,
            'prior_min_minutes': PRIOR_MIN_MINUTES,
            'params': PARAMS,
        },
        'bucket_priors': {str(et): v for et, v in bucket_prior.items()},
        'results': table_rows,
        'verdict': {
            'best_seed_by_early': best_b_seed,
            'best_seed_by_shared': best_b_seed_sh,
            'gw20_coverage_a': a_gw20_rows,
            'gw20_coverage_b': b_gw20_rows,
            'b_wins_gw20_coverage': b_wins_gw20_coverage,
            'b_beats_a_early_top10': b_beats_a_t10,
            'b_beats_a_early_haul_biased': b_beats_a_hc_early,
            'b_beats_a_shared_top10': b_beats_a_t10_sh,
            'b_beats_a_shared_haul': b_beats_a_hc_sh,
            'b_beats_c_early_top10': b_beats_c_t10,
            'early_top10_pts': {'A': a_t10, 'B': b_t10, 'C': c_t10},
            'early_haul_capture_biased': {'A': a_hc, 'B': b_hc, 'C': c_hc},
            'shared_top10_pts': {'A': a_t10_sh, 'B': b_t10_sh, 'C': c_t10_sh},
            'shared_haul_capture': {'A': a_hc_sh, 'B': b_hc_sh, 'C': c_hc_sh},
            'verdict_text': verdict,
        }
    }

    out_path = 'experiments/exp08_coldstart.json'
    json.dump(out, open(out_path, 'w'), indent=1)
    print(f'\nsaved {out_path}')


if __name__ == '__main__':
    main()
