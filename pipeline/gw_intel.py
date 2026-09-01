"""Compute GW-specific intelligence cards from FPL data.

Phase 80 GWI-02/GWI-03/GWI-04/GWI-05.
ZERO HTTP calls -- all data passed as arguments (matches insights.py / defcon.py convention).
"""

from collections import defaultdict
from datetime import datetime, timezone
from itertools import groupby
from typing import Any

from merge import _xpts_per_gw


def _apply_rotation_risk(
    merged: list,
    fixtures: list,
    european_cup_dates: dict[int, list[str]],
) -> list:
    """Flag players whose team has a cup/European fixture within +-3 days of its NEXT PL fixture (GWI-01, D-03).

    In-place mutation: writes player['rotation_risk'] = True/False.
    Returns merged (for chaining).
    """
    upcoming_pl = [
        f for f in fixtures
        if not f.get('finished') and f.get('kickoff_time')
    ]
    # Scope to each team's NEXT league fixture (CUP-01, 2026-09-01). This used
    # to scan every remaining fixture of the season, which was harmless while
    # european_cup_dates was empty but flagged 569 of 626 players the moment
    # real dates arrived — over a whole season nearly every club has some cup
    # game within 3 days of some league game. "Rotation risk" only means
    # anything about the round being picked right now.
    next_pl_by_team: dict[int, str] = {}
    for f in upcoming_pl:
        for team_id in (f.get('team_h'), f.get('team_a')):
            if team_id is None:
                continue
            ko = f['kickoff_time']
            if team_id not in next_pl_by_team or ko < next_pl_by_team[team_id]:
                next_pl_by_team[team_id] = ko

    rotation_teams: set[int] = set()
    for team_id, kickoff in next_pl_by_team.items():
        try:
            pl_date = datetime.fromisoformat(kickoff[:10])
        except (ValueError, TypeError):
            continue
        for cup_date_str in european_cup_dates.get(team_id, []):
            try:
                cup_date = datetime.fromisoformat(cup_date_str)
            except ValueError:
                continue
            if abs((cup_date - pl_date).days) <= 3:
                rotation_teams.add(team_id)
                break
    for player in merged:
        player['rotation_risk'] = player.get('team') in rotation_teams
    return merged


def _compute_team_points_from_fixtures(fixtures: list) -> dict[int, int]:
    """Aggregate team points (3W/1D/0L) from finished fixtures.

    Pitfall 1: bootstrap['teams'][i]['points'] is always 0; must derive from fixtures.
    """
    pts: dict[int, int] = defaultdict(int)
    for f in fixtures:
        if not f.get('finished'):
            continue
        h, a = f.get('team_h'), f.get('team_a')
        hs, as_ = f.get('team_h_score'), f.get('team_a_score')
        if h is None or a is None or hs is None or as_ is None:
            continue
        if hs > as_:
            pts[h] += 3
        elif hs < as_:
            pts[a] += 3
        else:
            pts[h] += 1
            pts[a] += 1
    return dict(pts)


def _compute_table_stakes(
    bootstrap: dict,
    fixtures: list,
    finished_gws: int,
) -> list[dict]:
    """Per-team table_stakes_label (GWI-03, D-13/D-14). Active only in final 6 GWs."""
    if 38 - finished_gws > 6:
        return []
    team_pts = _compute_team_points_from_fixtures(fixtures)
    # Order teams by live position (1-indexed; verified live in bootstrap)
    teams_sorted = sorted(bootstrap.get('teams', []), key=lambda t: t.get('position', 99))
    result: list[dict] = []
    for i, t in enumerate(teams_sorted):
        pos = t.get('position', 99)
        pts = team_pts.get(t['id'], 0)
        pts_above = team_pts.get(teams_sorted[i - 1]['id'], 0) if i > 0 else None

        if pos == 1:
            label = 'title battle'
        elif pos == 2 and pts_above is not None and (pts_above - pts) <= 6:
            label = 'title battle'
        elif 2 <= pos <= 6:
            label = 'European chase'
        elif pos >= 17:
            label = 'relegation battle'
        else:
            label = 'nothing-to-play-for'
        result.append({
            'team_id': t['id'],
            'team_short_name': t.get('short_name', ''),
            'label': label,
        })
    return result


def _detect_dgw_bgw(merged: list, next_gw: int) -> dict[int, str]:
    """Returns {team_id: 'dgw' | 'bgw'} for the next GW only.

    DGW: >=2 fixtures with event_id == next_gw. BGW: 0 fixtures with event_id == next_gw.
    Pitfall 6: count by event_id, not by len(fixtures).
    """
    team_counts: dict[int, int] = {}
    team_seen: set[int] = set()
    for p in merged:
        tid = p.get('team')
        if tid is None or tid in team_seen:
            continue
        team_seen.add(tid)
        count = sum(1 for f in (p.get('fixtures') or []) if f.get('event_id') == next_gw)
        team_counts[tid] = count
    return {
        tid: ('dgw' if c >= 2 else 'bgw')
        for tid, c in team_counts.items()
        if c >= 2 or c == 0
    }


def _difficulty_label(avg: float) -> str:
    if avg <= 2.0:
        return 'easy'
    if avg >= 3.1:
        return 'tough'
    return 'manageable'


def _venue_label(fixtures_subset: list) -> str:
    """all home -> 'home'; all away -> 'away'; mixed -> '' (omit)."""
    homes = [bool(f.get('is_home')) for f in fixtures_subset]
    if not homes:
        return ''
    if all(homes):
        return 'home'
    if not any(homes):
        return 'away'
    return ''


def _verdict(avg_difficulty: float, start_prob: float, sbp: float, in_top30: bool) -> str:
    if avg_difficulty <= 2.5 and start_prob >= 0.7:
        return 'prime hold'
    if sbp < 15 and in_top30:
        return 'prime target'
    return 'solid hold'


def _build_fixture_run_card(
    player: dict,
    next_gw: int,
    in_top30_by_3gw: bool,
    max_xpts_3gw: float,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> dict:
    """FixtureRunCard per D-09/D-10/D-12."""
    fixtures_3 = (player.get('fixtures') or [])[:3]
    # Per-GW xPts list (DGW-combined) -- uses _xpts_per_gw via merge import
    gw_xpts = _xpts_per_gw(
        player.get('xg_per90'),
        player.get('xa_per90'),
        float(player.get('start_prob') or 0),
        float(player.get('xmins') or 0),
        int(player.get('element_type') or 0),
        player.get('fixtures') or [],
        3,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )
    # gw_numbers: distinct event_ids of first 3 GW groups
    gw_numbers: list[int] = []
    for event_id, _grp in groupby(player.get('fixtures') or [], key=lambda f: f['event_id']):
        gw_numbers.append(event_id)
        if len(gw_numbers) == 3:
            break
    # is_dgw per GW group
    is_dgw: list[bool] = []
    for event_id in gw_numbers:
        count = sum(1 for f in (player.get('fixtures') or []) if f.get('event_id') == event_id)
        is_dgw.append(count >= 2)

    diffs = [float(f.get('defensive_difficulty') or 0.5) for f in fixtures_3]
    avg_diff = sum(diffs) / len(diffs) if diffs else 0.5
    diff_label = _difficulty_label(avg_diff)
    venue = _venue_label(fixtures_3)
    sbp = float(player.get('selected_by_percent') or 0)
    verdict = _verdict(avg_diff, float(player.get('start_prob') or 0), sbp, in_top30_by_3gw)
    n = len(fixtures_3)

    # Build narrative -- collapse double space when venue is empty
    venue_part = f' {venue}' if venue else ''
    narrative = f"{player.get('web_name', '')}: {n} {diff_label}{venue_part} fixtures — {verdict}"

    gw_label = f"GW{gw_numbers[0]}" if len(gw_numbers) == 1 else (
        f"GW{gw_numbers[0]}–{gw_numbers[-1]}" if gw_numbers else ''
    )

    return {
        'type': 'fixture_run',
        'id': f"fixture_run_{player.get('id')}",
        'gw_label': gw_label,
        'player_id': int(player.get('id') or 0),
        'web_name': player.get('web_name', ''),
        'narrative': narrative,
        'gw_xpts': gw_xpts,
        'gw_numbers': gw_numbers,
        'is_dgw': is_dgw,
    }


def compute_gw_intel(
    merged: list,
    bootstrap: dict,
    fixtures: list,
    summaries: dict,
    finished_gws: int,
    european_cup_dates: dict[int, list[str]],
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> dict:
    """Phase 80 GWI-02/GWI-03/GWI-04. ZERO HTTP calls.

    Returns: {cards: list[dict], team_stakes: list[dict], generated_at: str}
    """
    next_gw = finished_gws + 1

    # team_stakes (D-13/D-14)
    team_stakes = _compute_table_stakes(bootstrap, fixtures, finished_gws)
    stakes_by_team = {ts['team_id']: ts['label'] for ts in team_stakes}

    cards: list[dict] = []
    # gw_label for next-GW-anchored cards
    next_gw_label = f"GW{next_gw}"

    # PositionOpportunityCard: one per position based on best avg xPts_3gw
    # (Discretion: simple aggregate; surface position with highest mean 3-GW xPts among top 30)
    by_pos: dict[int, list[float]] = defaultdict(list)
    for p in merged:
        x3 = float(p.get('xPts_3gw') or 0)
        by_pos[int(p.get('element_type') or 0)].append(x3)
    pos_names = {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}
    for et, vals in by_pos.items():
        if et not in pos_names or not vals:
            continue
        top_n = sorted(vals, reverse=True)[:10]
        mean_top = sum(top_n) / len(top_n) if top_n else 0
        cards.append({
            'type': 'position_opportunity',
            'id': f"position_opportunity_{pos_names[et]}",
            'gw_label': next_gw_label,
            'position': pos_names[et],
            'narrative': f"{pos_names[et]}: top-10 {pos_names[et]} 3-GW xPts averaging {mean_top:.1f}",
        })

    # RotationRiskCard: one per rotation-risk team
    rotation_teams: set[int] = set()
    for p in merged:
        if p.get('rotation_risk'):
            rotation_teams.add(int(p['team']))
    team_short_by_id = {t['id']: t.get('short_name', '') for t in bootstrap.get('teams', [])}
    for tid in sorted(rotation_teams):
        cards.append({
            'type': 'rotation_risk',
            'id': f"rotation_risk_{tid}",
            'gw_label': next_gw_label,
            'team_id': tid,
            'team_short_name': team_short_by_id.get(tid, ''),
            'competition': 'Cup/European',
            'table_stakes_label': stakes_by_team.get(tid),
        })

    # DGW/BGW cards (Discretion: omit when no team qualifies)
    dgw_bgw_map = _detect_dgw_bgw(merged, next_gw)
    for tid, kind in sorted(dgw_bgw_map.items()):
        cards.append({
            'type': 'dgw_bgw',
            'id': f"dgw_bgw_{tid}_{next_gw}",
            'gw_label': next_gw_label,
            'team_id': tid,
            'team_short_name': team_short_by_id.get(tid, ''),
            'is_dgw': kind == 'dgw',
        })

    # FixtureRunCard: top 10 by xPts_3gw + top 10 differentials, deduped, capped 15 (D-11)
    ranked = sorted(merged, key=lambda p: float(p.get('xPts_3gw') or 0), reverse=True)
    top30_ids = {p.get('id') for p in ranked[:30]}
    top10 = ranked[:10]
    differentials = [
        p for p in ranked[:30]
        if float(p.get('selected_by_percent') or 0) < 15
    ][:10]
    max_xpts_3gw = float(top10[0].get('xPts_3gw') or 0) if top10 else 0
    seen_ids: set = set()
    run_cards: list[dict] = []
    for p in (top10 + differentials):
        pid = p.get('id')
        if pid in seen_ids:
            continue
        seen_ids.add(pid)
        run_cards.append(_build_fixture_run_card(p, next_gw, pid in top30_ids, max_xpts_3gw,
                                                  cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope))
        if len(run_cards) >= 15:
            break
    cards.extend(run_cards)

    return {
        'cards': cards,
        'team_stakes': team_stakes,
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
