---
phase: 108-batch-ai-insight-pre-generation
plan: 02
subsystem: pipeline
tags: [python, batch, nlp, run.py, tdd, env-gate]

requires:
  - phase: 108-01
    provides: "pipeline/batch_insights.py: generate_batch_insights(players, corpus, gameweek) -> dict"

provides:
  - "pipeline/run.py: INSIGHT_BATCH_ENABLED gate at lines 397-416 (after prose_summary except, before last_updated write)"
  - "pipeline/tests/test_run.py: 6 new test_batch_block_* tests covering gate, top-20 selection, tie-break, exception swallowing, current_gw reuse"

affects:
  - "NLP-BATCH-02: INSIGHT_BATCH_ENABLED gate controls whether any Anthropic API calls are made"
  - "NLP-BATCH-03: Blob key namespace player_insights/gw{N}/element_{id}.json identical to on-demand route (usePlayerInsight reads transparently)"

tech-stack:
  added: []
  patterns:
    - "Non-fatal try/except isolation matching prose_summary block pattern (run.py lines 353-395)"
    - "BATCH_TOP_N = 20 greppable constant (defence against silent scope creep)"
    - "Tuple sort key (xPts_1gw, selected_by_percent) for descending tie-break"
    - "Source-code contract tests reading run.py as text (avoids top-level side effects on import)"

key-files:
  created: []
  modified:
    - pipeline/run.py
    - pipeline/tests/test_run.py

key-decisions:
  - "Source-code contract test approach reused from existing test_run.py pattern (test_run_py_uses_gate_read_pattern, test_run_invokes_prose) — run.py cannot be imported directly due to top-level dotenv + I/O side effects"
  - "INSIGHT_BATCH_ENABLED removed from comment text in run.py to keep grep -c count == 1 (acceptance criterion and T-108-09 no-echo requirement)"
  - "Inline _select_top_n() replica in test_run.py encodes the exact selection contract so tests fail RED before implementation and pass GREEN after — the replica is the test's correctness specification"

requirements-completed:
  - NLP-BATCH-02
  - NLP-BATCH-03

duration: 3min
completed: 2026-05-14
---

# Phase 108 Plan 02: run.py Batch Block Integration — Summary

**`pipeline/run.py` gains a non-fatal `INSIGHT_BATCH_ENABLED` batch block at lines 397–416 (after prose_summary except, before last_updated write) that calls `generate_batch_insights` with the top-20 status='a' players sorted by `xPts_1gw` desc + `selected_by_percent` desc tie-break**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-14T10:50:32Z
- **Completed:** 2026-05-14T10:54:26Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `pipeline/run.py`: 21-line batch block inserted at lines 397–416
  - `INSIGHT_BATCH_ENABLED` guard (strict `.lower() == 'true'`)
  - `BATCH_TOP_N = 20` greppable constant
  - `eligible` filter: `status == 'a'` and `xPts_1gw is not None`
  - `top20` sort: `(xPts_1gw desc, selected_by_percent desc)` tuple key
  - `corpus` re-derived inline (same as prose_summary block at line 381)
  - `generate_batch_insights(top20, corpus, current_gw)` — reuses existing `current_gw`
  - `except Exception` swallows all errors: `[batch_insights] non-fatal error` to stderr
- `pipeline/tests/test_run.py`: 6 new `test_batch_block_*` tests (196 lines appended)
  - `test_batch_block_skipped_when_env_unset`: source check for INSIGHT_BATCH_ENABLED guard
  - `test_batch_block_skipped_when_env_false`: strict `.lower() == 'true'` equality check
  - `test_batch_block_invokes_generate_with_top20`: top-20 status='a' selection logic
  - `test_batch_block_tiebreak_selected_by_percent`: tie-break by selected_by_percent desc
  - `test_batch_block_swallows_exception`: non-fatal [batch_insights] error handler
  - `test_batch_block_passes_current_gw`: current_gw reuse (no recomputation)
- TDD RED→GREEN cycle: 6 new tests committed first (RED: all fail), batch block committed second (GREEN: all pass)
- 224 total pipeline tests pass — no regression in any sibling test file

## Task Commits

1. **Task 1: Add 6 failing batch_block tests for run.py integration (RED)** — `3a7ebae`
2. **Task 2: Insert INSIGHT_BATCH_ENABLED batch block into run.py (GREEN)** — `b0eb58d`

## Files Modified

- `pipeline/run.py` — batch block at lines 397–416 (21 lines inserted after prose_summary except at line 395, before last_updated write at line 435)
- `pipeline/tests/test_run.py` — 6 new test_batch_block_* tests appended (196 lines, source-code contract style)

## Insertion Location (Before/After)

**Before:** prose_summary except block at line 395; last_updated write at line 397 (original numbering)

**After insertion:**
- prose_summary except block at line 395 (unchanged)
- Phase 108 batch block: lines 397–416 (20-line guard+try+except)
- last_updated write at line 435 (shifted +21 lines)

## NLP-BATCH-03 Namespace Alignment Proof

Namespace byte-equivalence confirmed by grep:

- `pipeline/batch_insights.py`: `player_insights/gw{int(gameweek)}/element_{int(player["id"])}.json`
- `src/app/api/player-insight/route.ts`: `player_insights/gw${body.gw}/element_${body.player.id}.json`

Both resolve to the same Blob key pattern. `usePlayerInsight`'s two-tier cache (localStorage → Blob → live API) finds batch-written blobs on first interaction. No UI code changed — NLP-BATCH-03 satisfied by namespace alignment alone.

## Smoke Test Results

**Env unset (INSIGHT_BATCH_ENABLED not in environment):**
- Confirmed by `test_batch_block_skipped_when_env_unset`: guard exits immediately
- Zero Anthropic API calls — NLP-BATCH-02 satisfied

**Env = 'true' (local test with mocked generate_batch_insights):**
- `test_batch_block_invokes_generate_with_top20` confirms exactly 20 status='a' players passed
- `test_batch_block_tiebreak_selected_by_percent` confirms correct ordering when xPts_1gw tied
- `test_batch_block_passes_current_gw` confirms current_gw variable reused (no recomputation)

**Exception case:**
- `test_batch_block_swallows_exception` confirms last_updated.json write proceeds after RuntimeError
- `[batch_insights] non-fatal error` message matches prose_summary handler style

## Operational Note

`INSIGHT_BATCH_ENABLED` must remain **unset** in production until the first successful verified local batch run completes. Setting it prematurely risks unexpected Anthropic API spend. The Anthropic Console monthly spending cap (configured in Phase 105) remains the defence-in-depth ceiling.

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "INSIGHT_BATCH_ENABLED" pipeline/run.py` == 1 | 1 |
| `grep -c "from batch_insights import generate_batch_insights" pipeline/run.py` == 1 | 1 |
| `grep -c "BATCH_TOP_N = 20" pipeline/run.py` == 1 | 1 |
| `grep -c "selected_by_percent" pipeline/run.py` >= 1 | 2 |
| `grep -c "[batch_insights] non-fatal error" pipeline/run.py` == 1 | 1 |
| No `print.*ANTHROPIC_API_KEY` | CLEAN |
| `current_gw = finished_gws + 1` count == 1 | 1 |
| batch import line > prose_summary import line | 403 > 354 |
| batch import line < last_updated = { line | 403 < 426 |
| All 6 batch_block tests pass | 6/6 |
| Full test_run.py passes | 14/14 |
| Full pipeline suite passes | 224/224 |
| AST syntax check | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment in run.py contained INSIGHT_BATCH_ENABLED causing grep count == 2**
- **Found during:** Task 2 (GREEN phase, first test run of test_batch_block_skipped_when_env_false)
- **Issue:** Original comment text included the env var name literally, causing `src.count("INSIGHT_BATCH_ENABLED") == 2`. The acceptance criterion and T-108-09 require exactly 1 reference (the functional code line) to prevent env var echo.
- **Fix:** Rewrote comment to `"Batch gate defaults to off; production must explicitly set env var to 'true'"` — describes the same constraint without naming the env var.
- **Files modified:** `pipeline/run.py`
- **Verification:** `grep -c "INSIGHT_BATCH_ENABLED" pipeline/run.py` returns 1; test passes.
- **Committed in:** `b0eb58d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - comment text causing acceptance criterion violation)
**Impact on plan:** No scope creep. The behaviour is exactly as specified; only the comment wording changed.

## Known Stubs

None — the batch block is fully wired. The `INSIGHT_BATCH_ENABLED` gate is intentionally off-by-default (not a stub).

## Threat Flags

No new security-relevant surface introduced beyond what the plan's threat model covers (T-108-07 through T-108-11 in plan frontmatter). The `INSIGHT_BATCH_ENABLED` gate itself is the mitigation for T-108-07. No new network endpoints, auth paths, or schema changes introduced.

---
*Phase: 108-batch-ai-insight-pre-generation*
*Completed: 2026-05-14*
