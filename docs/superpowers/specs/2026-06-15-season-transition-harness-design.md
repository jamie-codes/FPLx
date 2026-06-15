# Season-Transition Verification Harness

**Feature ID:** STH-01 (season-launch readiness §1 / §6.4 — the launch-day smoke)
**Date:** 2026-06-15
**Status:** Approved — buildable now against the 2025/26 archive

---

## Problem

When the 2026/27 FPL bootstrap drops (~mid-July), the pipeline must flip cleanly from off-season to live: Understat season bump, `IS_OFF_SEASON` → False, SA-02 label → `season_2026_27`, promoted/relegated clubs handled, COLD-01 prior engaging at GW1, every artefact writing, no team resolving to "unknown". Recon confirmed the **Python pipeline is fully dynamic** from `bootstrap['teams']` (promoted clubs flow through automatically), so the real launch risk is **four hardcoded alias/asset tables** with gaps for new clubs, plus boundary states (e.g. 0 finished GWs) that are never exercised off-season. We want to prove the flip works — and get the exact patch-list — *before* launch, not discover breakage on launch day.

## Scope & decisions (from brainstorming)

- **Two parts:** (A) run the full pipeline against a **synthetic** 2026/27 bootstrap and hard-assert correct output; (B) a **team-table coverage report** listing which clubs need adding to the four hardcoded tables.
- **Gaps WARN, don't fail.** Hard-fail only on real breakage (pipeline crash, missing/empty artefact, a team resolving to "unknown" in pipeline output). Alias-table gaps degrade gracefully and the real promoted clubs are unknown pre-launch, so they're a loud WARN / launch checklist.
- **Buildable now**, fully isolated (temp output dir, all fetchers stubbed, no network, no Blob, no real-cache writes) — safe to run anytime. Accepts an injected real bootstrap for launch day.

## The four at-risk tables (recon)

| Table | File | Key | Degradation when a club is missing |
|---|---|---|---|
| `TEAM_BADGE_CODE` | `src/lib/team-colours.ts` | `short_name` | `null` code → coloured initial-letter box (graceful) |
| `TEAM_COLOURS` | `src/lib/team-colours.ts` | `short_name` | grey `#71717A` fallback (graceful) |
| `FOOTBALL_DATA_TO_FPL` | `pipeline/odds_join.py` | name | odds rows silently dropped → 0.5 difficulty fallback |
| `WIKI_CLUB_TO_FPL` | `pipeline/confirmed_transfers.py` | name | club's confirmed transfers silently absent |

The Python team lookups (`merge.py`, `accuracy.py`, `insights.py`, `gw_intel.py`, etc.) all rebuild from `bootstrap['teams']` — no hardcoded 20-club list — so they need no patching.

## Module: `pipeline/season_transition_smoke.py`

### Synthetic transition generator
`build_synthetic_transition(archive) -> dict` returns `{bootstrap_offseason, bootstrap_live, fixtures, summaries}` by mutating the 2025/26 archive:
- **Season bump:** first event `deadline_time` → `"2026-08-14T…"` so `capture_season.season_label` derives `"2026-27"`.
- **Two gate states:** `bootstrap_offseason` has no event with `is_current` (→ `IS_OFF_SEASON=True`); `bootstrap_live` sets GW1 `is_current=True`, `is_next=False`, all events `finished=False` (→ `IS_OFF_SEASON=False`, 0 finished GWs).
- **Zeroed current stats:** every element's `minutes/starts/expected_goals/expected_assists/total_points/…` → 0, forcing COLD-01's prior to engage.
- **Promoted/relegated:** drop 3 archive clubs from `teams`, add **3 fabricated clubs** with novel `short_name`s (`XYZ`, `QQQ`, `ZZZ`), fresh `id`/`code`, and reassign the dropped clubs' players to the new ids — so the coverage check detects real gaps.
- **Fixtures:** GW1 fixtures pairing the 20 teams, future `kickoff_time`, `finished=False`, no scores.
- **Summaries:** `get_element_summary` stub returns empty current `history` (zeros); the prior comes from the committed 2025/26 archive, not current summaries.

### Part A — pipeline smoke
`_run_pipeline_isolated(bootstrap, fixtures, summaries, tmp_dir) -> dict` runs `run.run()` with:
- `pipeline.run.get_bootstrap_static`/`get_fixtures`/`get_element_summary`/`get_understat_players` monkeypatched to the synthetic data (no network).
- `USE_BLOB` forced off; the cache/output dir redirected to `tmp_dir` (monkeypatch the save-dir constant / `save` seam — implementer locates it; nothing writes to real `pipeline/cache/` or Blob).

Hard assertions (FAIL the harness on any):
1. Pipeline completes with no exception. (The 0-finished-GW path is where boundary bugs hide — e.g. `accuracy_backtest`/`compute_honest_metrics` at `finished_gws=0`. A crash is a real bug to fix.)
2. `IS_OFF_SEASON` is `True` for `bootstrap_offseason`, `False` for `bootstrap_live`.
3. `season_label(bootstrap_live)` == `"2026-27"`.
4. Every expected not-off-season artefact exists in `tmp_dir` and is non-empty: `merged_players.json`, `captain_picks.json`, `insights.json`, `gw_intel.json`, `defcon_stats.json`, `set_piece_changes.json`, `predictions_snapshot.json` (+ the always-on `fpl_bootstrap.json`, `fpl_fixtures.json`, `last_updated.json`, `data_health.json`). (Authoritative list taken from the run.py artefact map; `accuracy_backtest.json` may legitimately be a no-op at 0 finished GWs — assert presence only if the code writes it at 0 finished, else exclude.)
5. **No unknown team:** every player in `merged_players.json` has a non-empty `team_short_name` ∈ the synthetic 20 and a `team_code`.
6. **COLD-01 engaged:** ≥1 returning player (present in the 2025/26 archive by `code`) has non-zero `xg_per90` and `xmins` at GW1 despite zeroed current stats.

### Part B — team-table coverage report
`coverage_report(bootstrap) -> dict` — given the bootstrap's 20 clubs (`short_name`, `name`, `code`), report clubs **missing** from each table:
- Python: import `FOOTBALL_DATA_TO_FPL` (`odds_join`), `WIKI_CLUB_TO_FPL` (`confirmed_transfers`); a club is "covered" if its FPL name appears as an alias target / value.
- TS: extract the literal keys of `TEAM_BADGE_CODE` and `TEAM_COLOURS` from `src/lib/team-colours.ts` by regex (simple string-literal keys); a club is "covered" if its `short_name` is a key.

Returns `{table: [missing short_names]}`. Non-fatal. Printed as a **LAUNCH CHECKLIST**. The 3 fabricated clubs always appear (expected pre-launch); at launch, run against the live bootstrap and the report names the real promoted clubs to patch.

### Entry points
- `run_smoke(bootstrap=None, fixtures=None, summaries=None) -> dict` — returns `{'hard_checks': {name: bool/detail}, 'coverage': {...}, 'ok': bool}` (`ok` = all hard checks pass). Defaults to the synthetic transition; accepts an injected real bootstrap for launch day.
- CLI `python -m season_transition_smoke` — prints the hard-check results + the coverage checklist; exits non-zero iff a hard check fails.

## Testing

`pipeline/tests/test_season_transition_smoke.py`:
- `run_smoke()` on the synthetic transition → `ok is True`: pipeline runs, gates flip (off-season True / live False), `season_label==2026-27`, all expected artefacts present + non-empty, no unknown team, COLD-01 engaged.
- The coverage report flags exactly the 3 fabricated clubs (`XYZ/QQQ/ZZZ`) as missing from all four tables.
- A deliberately-broken synthetic bootstrap (a player assigned to a team id absent from `teams`) trips the "unknown team" hard check → `ok is False` (proves the assertion bites).
- Isolation: after a run, assert nothing was written outside `tmp_dir` (real `pipeline/cache/` untouched).
- Full pipeline suite stays green.

## Out of scope

- Fixing alias-table gaps now (real clubs unknown; launch-day task driven by the report).
- Wiring launch-day live-API execution (the harness accepts a real bootstrap; pointing it at the live API is a one-liner at launch).
- Changing the pipeline's actual transition behaviour — this is verification only. If Part A surfaces a real boundary crash (e.g. at 0 finished GWs), fixing it is a separate follow-up, recorded honestly.
- Any UI change.
