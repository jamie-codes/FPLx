# PICK-01: Weekly Picks Tab

**Feature ID:** PICK-01
**Date:** 2026-06-11
**Status:** Approved (layout A chosen via visual companion; live honest confidence chosen; composed design approved)

---

## Goal

A new **Picks** tab (Analyse section) answering "who does the model rate this week?" at a glance: side-by-side ranked top-10 tables for Next GW and Next 3 GWs, an honest-confidence strip showing the model's *measured* pick quality, and an "Under the radar" row of low-ownership gems. Ranking is by mean xPts (exp04 evidence: nothing beats it).

## Layout (approved mockup)

```
[ Confidence strip: 3 stat cards + provenance caption       ]
[ NEXT GW top-10 table        ][ NEXT 3 GWs top-10 table    ]   (stack on mobile)
[ UNDER THE RADAR — 5 chips: <10% owned, highest xPts_1gw   ]
```

## Architecture

Follows the app's established idioms exactly: `'use client'` tab component, TanStack table idiom from gem-table, data via existing React Query hooks, no new API routes for player data, local-copy chrome class constants (PATTERNS.md convention), native `title` tooltips, Tailwind v4 with dark variants.

### New files

| File | Responsibility |
|---|---|
| `src/components/weekly-picks/WeeklyPicksTab.tsx` | Tab shell: layout, data loading (`usePlayers`, `useAccuracy`), loading/error states |
| `src/components/weekly-picks/ConfidenceStrip.tsx` | 3 stat cards + caption; live-vs-last-season source logic |
| `src/components/weekly-picks/PicksTable.tsx` | One ranked table, `horizon: '1gw' \| '3gw'` prop; expandable rows |
| `src/components/weekly-picks/UnderTheRadar.tsx` | Low-ownership chips row |
| `src/lib/picks.ts` | Pure selection/ranking helpers (unit-testable): `rankPicks(players, horizon, n)`, `underTheRadar(players, maxOwnership, n)` |

### Modified files

| File | Change |
|---|---|
| `src/app/page.tsx` | `SubTab` union + Analyse `subTabs` entry `{ id: 'picks', label: 'Picks', mobileLabel: 'Picks' }` + import + render conditional |
| `src/lib/types.ts` | `honest_metrics` on the backtest summary type; add `defcon_pts?` to `xPts_components_1gw` type |
| `pipeline/run.py` | compute + write `honest_metrics` (below) |
| `pipeline/accuracy.py` or `run.py` helper | none beyond the call — uses `backtest.run_backtest` |

## Data & selection rules

- **Source**: `usePlayers()` (`MergedPlayer[]`) — all required fields exist: `xPts_1gw/3gw`, `haul_prob`, `differential_flag`, `selected_by_percent` (string!), `web_name`, `team_short_name`, `element_type`, `status`, `fixtures`, `xPts_components_1gw`, `p10_pts/p90_pts`, `blank_prob`.
- **rankPicks**: sort by `xPts_1gw ?? 0` (or `xPts_3gw ?? 0`) desc; exclude `status === 'u'` (left the league); take top 10. No other exclusions — xmins already collapses unavailable players' xPts, so they drop out naturally. Players with `status` `'d' | 'i' | 's'` show a ⚠ with the status word in the `title` tooltip.
- **underTheRadar**: `Number(selected_by_percent) < 10`, same status rule, sort by `xPts_1gw` desc, top 5. May overlap with the main tables (that's fine — overlap means a genuinely ownable gem).
- **Off-season/empty data**: when every `xPts_1gw` is 0/undefined (off-season placeholder pipeline output), the tab renders an empty-state card ("Picks return when the season starts") instead of a table of zeros.

### Next GW table columns

`#` (rank), Player (web_name + small `POS · TEAM`), Fixture (reuse `FixtureBadges` filtered to the next event — DGW label comes free), `xPts` (bold, 1 decimal), `Haul` (`haul_prob` as %, em-dash when absent), Flags (`DifferentialBadge` + status ⚠).

### Next 3 GWs table columns

`#`, Player, Fixtures (next-3-events chips via `FixtureBadges`), `xPts` (3GW, bold), Flags.

### Expandable row (both tables; chevron like gem-table)

- Component breakdown from `xPts_components_1gw`: horizontal mini-bars for goal/assist/CS/bonus/appearance (+ `save_pts` for GKP, + `defcon_pts` when present — **this surfaces DC-01 in the UI, satisfying roadmap DC-02**)
- `MCDistributionBar` (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`)
- 3GW rows reuse the same 1GW components panel (it's the only per-component data available) with the caption "per-GW components".

## Confidence strip (honest metrics)

Three cards: **pts/pick** (`top10_mean_pts`, 1 decimal), **haul capture** (`haul_capture_20` rendered as "~1 in N" where N = round(1/value)), **#1 pick returns 6+** (`captain_return_rate` as %). Plus a provenance caption.

**Source logic** (in `ConfidenceStrip`):
- If `accuracy.summary.honest_metrics` exists AND `honest_metrics.n_gws >= 8` → live values; caption `measured over this season's {n_gws} GWs`.
- Else → hardcoded constants from the 2025/26 validation (`top10_mean_pts: 5.66`, `haul_capture_20: 0.194`, `captain_return_rate: 0.60` — source: exp05, promoted model, GW29–38); caption `measured on 2025/26 — switches to live after GW8`.

**Pipeline side** (`run.py`, non-fatal try/except like the snapshot hook): when `finished_gws >= 8`, build the archive-shaped dict (already built for `snapshot_season` inputs) and run `backtest.run_backtest(archive, params=<live tuned params mapped to BT names>, mode='deploy', first_gw=max(5, first_finished), last_gw=last_finished)`; write into `backtest_data['summary']['honest_metrics'] = {top10_mean_pts, haul_capture_20, captain_return_rate, haul_hit_rate, n_gws}` (rounded, None→null). The "live tuned params" are the `*_used` values run.py already holds, mapped via the same name translation BT-03 uses (`fas_slope`→`fixture_attack_slope`); reuse `tune._map_tune_to_bt_params` if its input shape fits, else a small local mapping.

## Testing

- **`src/lib/picks.ts`**: unit tests (use the repo's existing TS test setup if present; if none exists, the plan must check and follow whatever `package.json` provides — do not introduce a new test framework unilaterally; fall back to exercising via `tsc` + a Playwright smoke if that's the established pattern): rank ordering, status-'u' exclusion, string-ownership parsing, top-N, empty/off-season detection.
- **Pipeline**: pytest for the honest-metrics block — gate at `finished_gws >= 8`, written keys/rounding, non-fatal on exception (mirror snapshot-hook test pattern in test_run.py).
- **Whole app**: `npx tsc --noEmit` green; `npm run lint` green; manual visual check with the cached GW35 `merged_players.json` (real data renders sensibly).

## Out of scope

- New URL routes (in-page tab only), server components
- Captaincy-specific logic (CaptaincyPanel exists)
- Re-ranking by anything other than mean xPts
- Per-GW component breakdown for the 3GW horizon (data doesn't exist)
- Push/alerts
