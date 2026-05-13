---
phase: 102-mc-gate-activation-mcdistributionbar-display
plan: 01
subsystem: pipeline
tags: [mc, monte-carlo, pipeline, gate-flip, github-actions, workflow-hygiene]

# Dependency graph
requires:
  - phase: 90-mc-simulate
    provides: "10k-sim engine in pipeline/simulate.py + MC fields (blank_prob/haul_prob/p10_pts/p90_pts) on MergedPlayer"
provides:
  - "MC_ENABLED = True constant in pipeline/run.py — mc fields now populate on every daily pipeline run"
  - "Updated test_simulate.py assertions matching the new MC_ENABLED constant pattern"
  - "GitHub Actions workflow hygiene: anthropic==0.98.1, numpy==2.2.3, MC_ITERATIONS=10000, MC_SEED=42"
affects:
  - 102-02-plan (MCDistributionBar UI — depends on mc fields being populated in merged_players.json)
  - 102-03-plan (CaptainPicksPanel P10/P90 — same dependency)
  - pipeline/accuracy.py (reads mc_enabled from accuracy_backtest.json summary — no change needed, existing sticky-read preserves true after first write)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SCREAMING_SNAKE_CASE named constant in pipeline/run.py to override sticky-read gate (MC_ENABLED = True replaces prev_backtest sticky read)"
    - "Unquoted integer env vars in GitHub Actions yaml (MC_ITERATIONS: 10000, MC_SEED: 42)"

key-files:
  created: []
  modified:
    - pipeline/run.py
    - pipeline/tests/test_simulate.py
    - .github/workflows/pipeline.yml

key-decisions:
  - "MC_ENABLED added as a named constant inside the try block (not at module level) to match the local-scope pattern of the other gate defaults at lines 188-193"
  - "Sticky read for mc_enabled replaced inside try block; other gate sticky reads (form_signal, xmins_v2, bonus_predictor, save_predictor) unchanged"
  - "Downstream accuracy.py write path requires no change — it already reads mc_enabled from prior_cache and writes it back to summary, so it will persist True automatically after the first run"

patterns-established:
  - "Named constant (SCREAMING_SNAKE_CASE) overrides sticky-read in run.py — same pattern to follow for any future permanent gate flip"

requirements-completed: [MC-01]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase 102 Plan 01: MC Gate Activation Summary

**MC gate flipped from sticky-read-OFF to MC_ENABLED = True constant in pipeline/run.py, unblocking 10k-sim MC fields (blank_prob/haul_prob/p10_pts/p90_pts) for every daily pipeline run**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-13T11:30:00Z
- **Completed:** 2026-05-13T11:45:55Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Flipped mc_enabled from a sticky backtest read (always False until manually toggled) to a hard-coded `MC_ENABLED = True` constant — MC simulation fields now populate deterministically on every pipeline run
- Updated `test_simulate.py` assertion to verify the new constant pattern (12/12 tests pass)
- Applied three GitHub Actions workflow hygiene fixes: anthropic pin aligned (0.40.0 → 0.98.1), numpy pinned explicitly (==2.2.3), and MC env vars added (MC_ITERATIONS: 10000, MC_SEED: 42 as unquoted integers)

## Task Commits

Each task was committed atomically:

1. **Task 1: Flip mc_enabled gate to MC_ENABLED = True constant in pipeline/run.py** - `4918c46` (feat)
2. **Task 2: Update pipeline/tests/test_simulate.py assertion to match new constant** - `7c58d8a` (test)
3. **Task 3: Apply three GitHub Actions hygiene fixes to .github/workflows/pipeline.yml** - `6e693c5` (chore)

## Files Created/Modified
- `pipeline/run.py` — Added `MC_ENABLED = True` at line 194; replaced sticky read with `mc_enabled = MC_ENABLED` at line 204
- `pipeline/tests/test_simulate.py` — Replaced old sticky-read assertion with two assertions: `"MC_ENABLED = True" in run_source` and `"mc_enabled = MC_ENABLED" in run_source`
- `.github/workflows/pipeline.yml` — Updated anthropic pin, added numpy pin, added MC_ITERATIONS and MC_SEED env vars

## Exact Change Detail

### pipeline/run.py
- **Line 194 (added):** `MC_ENABLED = True  # Phase 102 MC-01 — permanent ON; surfaces 10k-sim MC fields in merged_players.json`
- **Line 204 (replaced):** `mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)` → `mc_enabled = MC_ENABLED`
- The default-OFF line at 193 and the print statement at 211 are unchanged

### .github/workflows/pipeline.yml — env block diff
Before:
```yaml
env:
  USE_BLOB: 'true'
  BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```
After:
```yaml
env:
  USE_BLOB: 'true'
  BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  MC_ITERATIONS: 10000
  MC_SEED: 42
```

### .github/workflows/pipeline.yml — pip install diff
Before: `pip install requests==2.32.3 pandas==2.2.3 vercel-blob==0.4.2 python-dotenv==1.0.1 anthropic==0.40.0`
After: `pip install requests==2.32.3 pandas==2.2.3 vercel-blob==0.4.2 python-dotenv==1.0.1 anthropic==0.98.1 numpy==2.2.3`

## accuracy.py Write Path Confirmation
No change required. `pipeline/accuracy.py` lines 368 and 400 already read `mc_enabled` from `prior_cache` and write it back into `accuracy_backtest.json` summary. Once `mc_enabled = MC_ENABLED = True` propagates through the first pipeline run, the summary will contain `mc_enabled: true` — subsequent accuracy.py runs preserve this value via the existing sticky-read pattern. The Plan 01 gate flip is sufficient; no separate write-path change is needed.

## Expected Behaviour After Next Daily Pipeline Run
1. `pipeline/run.py` evaluates `mc_enabled = MC_ENABLED = True`
2. Console: `MC simulation (5-GW uncertainty bands): ENABLED`
3. `compute_simulations(merged, xmins_v2_enabled)` executes with 10k sims per player per GW
4. `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` fields populated in `merged_players.json` (Vercel Blob)
5. `accuracy_backtest.json` summary writes `mc_enabled: true`
6. Plan 02 (MCDistributionBar) and Plan 03 (CaptainPicksPanel P10/P90) can now consume these fields

## Decisions Made
- MC_ENABLED constant placed inside the `try` block (local scope) — consistent with the local-scope pattern used by the other gate defaults at lines 188-193 rather than as a module-level constant
- Downstream accuracy.py confirmed to require no change — existing sticky-read pattern is self-sustaining after first write

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The GitHub Actions workflow change takes effect on the next push/scheduled run automatically.

## Next Phase Readiness
- Plan 01 complete. MC fields will populate on the next daily pipeline run
- Plan 02 (MCDistributionBar component in XPtsCell hover card) and Plan 03 (CaptainPicksPanel P10/P90 range) can proceed in parallel — they read from the already-typed `MergedPlayer` fields (`p10_pts`, `p90_pts`, `blank_prob`, `haul_prob`) which exist in the type system; gate activation ensures they are non-undefined after the next pipeline run

---
*Phase: 102-mc-gate-activation-mcdistributionbar-display*
*Completed: 2026-05-13*
