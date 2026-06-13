# USR-01: Understat Endpoint Repair + Layered xG Fallback

**Feature ID:** USR-01
**Date:** 2026-06-13
**Status:** Approved (diagnostic-driven; user approved proceed)

---

## Problem (from the diagnostic)

Understat moved its data off the league HTML page to a JSON endpoint, so `understat_client._parse_players` (regex on `var playersData`) returns `{}` every run. The model's `xg_per90`/`xa_per90` then fall through merge.py's DQ-01 fallback to an **actual goals/assists per-90 proxy** — the worst of the available options (correlation to true Understat xG **0.72**, xA **0.50**), carrying finishing noise instead of chance quality. Meanwhile FPL's own `expected_goals_per_90` (correlation **0.85 / 0.70**) sits unused in the bootstrap. The model's most important attacking input has been silently degraded.

## Fix (two layered changes)

### 1. Repair the Understat fetch (`pipeline/understat_client.py`)

Replace the broken HTML-regex scrape with the live JSON endpoint (verified working: HTTP 200, 537 players, real xG **and npxG**):

- `get_understat_players()`: keep the 24h-cache logic, season-year helper, and the existing player-mapping loop **unchanged** (its field names — `player_name`, `team_title`, `xG`, `xA`, `npxG`, `npxA`, `time` — already match the endpoint's objects, so the output dict shape `{pid: {player, team, xG, xA, npxG, npxA, minutes}}` is preserved and merge.py needs no change on the Understat side).
- Replace the fetch + `_parse_players(html)` with a POST:
  ```python
  resp = requests.post(
      'https://understat.com/main/getPlayersStats/',
      data={'league': 'EPL', 'season': str(season_year)},
      headers={**HEADERS, 'X-Requested-With': 'XMLHttpRequest',
               'Referer': f'https://understat.com/league/EPL/{season_year}'},
      timeout=30)
  resp.raise_for_status()
  raw_players = resp.json().get('players', [])
  ```
  (`requests` auto-decodes gzip; `resp.json()` handles it.)
- Delete `_parse_players` (and its `re` import if now unused). Keep the empty-result guard: if `raw_players` is empty → return `{}` (the layered fallback below catches it). `npxA` is now `null` from the endpoint — the existing `float(p.get('npxA', 0) or 0)` already handles it.
- The mapping loop now also carries real `npxG` (was always 0 before) — emit it; it sets up a future npxG split when per-GW history accrues (out of scope here).

### 2. Layered DQ-01 fallback (`pipeline/merge.py` ~1240-1248)

When Understat has no entry for a player, the fallback chain becomes (best → worst):
1. **FPL `expected_goals_per_90` / `expected_assists_per_90`** from the bootstrap element (the 0.85/0.70 option) — use when present and > 0 / non-null.
2. **goals/assists per-90 proxy** (current behaviour) — last resort only when the FPL xG fields are absent/null (early season, missing data).

Read the element's `expected_goals_per_90` / `expected_assists_per_90` (strings in bootstrap → `float()`), guard for None/''/0. Keep the existing proxy as the final branch. Comment the layering with the diagnostic correlations.

## Validation

- **Correctness, not a lab claim**: BT-02 reconstructs from FPL per-GW `expected_goals` and never used Understat, so it cannot measure this live-path change. The justification is the diagnostic's correlation evidence (already gathered) + a **live smoke** confirming real xG now flows.
- **Live smoke** (manual, network): call `get_understat_players()` → assert ~500+ players returned with non-zero `xG` and real `npxG` (Haaland xG≈28, npxG≈25); spot-check a couple. Then a merge smoke confirming a known player's `xg_per90` now comes from Understat (not the goals proxy).
- **Unit tests** (no network): `understat_client` — mock `requests.post` returning a fixture `{'players': [...]}`; assert mapping (xG/xA/npxG/minutes, npxA-null→0, team_title list handling), empty-`players`→{}, HTTP error→{}, cache fresh/stale paths. `merge` — DQ-01 layering: Understat present → uses it; Understat absent + FPL xG present → uses FPL `expected_goals_per_90`; both absent → goals proxy.

## Out of scope

- npxG/penalty split (#3 — deferred, data-blocked for honest backtesting)
- Changing the backtest/tuner xG source (it uses FPL per-GW xG by design; consistent)
- Per-GW Understat history capture (future, once SA-02 + the endpoint accrue it)
- soccerdata dependency (this replaces the need for it in the understat path)

## Acceptance

- Unit tests green (understat_client + merge DQ-01 layering); full pipeline suite green; live smoke shows real xG/npxG flowing and a player's xg_per90 sourced from Understat.
- No change to the Understat output dict shape (merge.py Understat branch untouched); only the DQ-01 fallback branch changes.
