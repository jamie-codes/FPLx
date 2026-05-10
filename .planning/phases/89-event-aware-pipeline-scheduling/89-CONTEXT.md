# Phase 89: Event-Aware Pipeline Scheduling - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure DevOps/GitHub Actions phase. Adds a deadline-guard script and a dense conditional cron schedule so the pipeline runs data-refresh only inside the 90-minute window before each GW deadline — without burning Actions minutes the rest of the week. A concurrency guard prevents race conditions with the existing 4×/day baseline.

**What ships:**
- `pipeline/refresh_gate.py` — standalone deadline-math utility; reads `events[].deadline_time` from FPL bootstrap; writes `run=true/false` to `$GITHUB_OUTPUT`; always exits 0; configurable via `PIPELINE_DEADLINE_WINDOW_MINUTES=90` env var
- `pipeline/tests/test_refresh_gate.py` — 6 pytest cases (before-window / in-window / after-window / failure-skip / DGW double-deadline / cold-bootstrap)
- `.github/workflows/pipeline.yml` — two new dense cron entries (Sat/Sun + Fri), gate step added to all triggers, `concurrency: { group: pipeline, cancel-in-progress: true }` at workflow level

**Out of scope:** TypeScript changes, new API routes, new pipeline data outputs, midweek cron entries (Tue/Wed/Thu)

</domain>

<decisions>
## Implementation Decisions

### Gate → Actions Signal Mechanism
- **D-01:** `refresh_gate.py` communicates its decision via `$GITHUB_OUTPUT` — writes `run=true` when inside the deadline window, `run=false` otherwise. Always exits with code 0 (gate step never fails). The pipeline step uses `if: steps.gate.outputs.run == 'true'`. No `continue-on-error` hackery needed.
- **D-02:** The gate step is conditional on `github.event_name == 'schedule'` — it is skipped entirely for `workflow_dispatch` triggers. This means manual dispatch always runs the full pipeline, which is the correct behaviour for debugging and force-refresh scenarios.
- **D-03:** The pipeline step `if:` condition combines both paths: `github.event_name == 'workflow_dispatch' || steps.gate.outputs.run == 'true'`. This is the single canonical condition — no additional bypass logic needed.

### Cron Schedule Design
- **D-04:** Dense schedule uses **30-minute granularity** on Fri/Sat/Sun only. Two new cron entries:
  - `0,30 8-13 * * 6,0` — Saturday and Sunday, 8am–1:30pm UTC (covers FPL deadlines in both BST and GMT seasons; typical deadline is ~10:30–11:30 UTC)
  - `0,30 16-20 * * 5` — Friday, 4pm–8:30pm UTC (early-kick GWs, Cup rounds)
- **D-05:** The existing 4×/day baseline cron `0 6,12,18,0 * * *` is **preserved unchanged**. REFRESH-01 is additive. Tue/Wed/Thu midweek DGW deadlines are covered by the baseline 4×/day run at lower frequency — the gate handles the window math correctly regardless of which cron fires.

### Concurrency Guard
- **D-06:** `concurrency: { group: pipeline, cancel-in-progress: true }` is declared at the **workflow level** (not job level), so an incoming deadline-window run can pre-empt any in-flight daily-cron run, including the trailing job steps. This prevents Vercel Blob write races.

### refresh_gate.py Architecture
- **D-07:** Bootstrap fetch calls `fpl_client.get_bootstrap_static()` directly — reuses the existing shared HTTP helper rather than writing a duplicate `requests.get()`. Failure of that call → gate sets `run=false` (skip), never `run=true`. The script must NOT import from `pipeline/run.py`.
- **D-08:** "Next deadline" selection logic: filter `events[]` to those with `deadline_time` > `now`, sort ascending, pick the first. If no future events exist (end of season) → skip. For DGW double-deadlines (two future events within a short span), this picks the nearest one — which is the correct behaviour (gate fires for the nearest deadline first, then fires again for the second when it becomes nearest).

### Claude's Discretion
- Python `datetime` parsing of `deadline_time` ISO strings — use `datetime.fromisoformat()` with UTC-aware `datetime.now(timezone.utc)` for comparison
- `PIPELINE_DEADLINE_WINDOW_MINUTES` env var defaults to `90` if not set — `int(os.getenv('PIPELINE_DEADLINE_WINDOW_MINUTES', '90'))`
- Test fixture: mock `datetime.now` via a `now` parameter injected into the gate function (avoids patching); HTTP error mocked with `unittest.mock.patch` on `fpl_client.get_bootstrap_static`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 89 — Goal, 5 success criteria (SC-1 through SC-5), cross-cutting constraints, 6 specified test cases, plan wave structure
- `.planning/REQUIREMENTS.md` §REFRESH-01 — Full requirement text; confirms 90-min window, deadline-guard spec, cron + concurrency spec; Out of Scope section (no true event-driven GH Actions)

### Primary Change Targets
- `.github/workflows/pipeline.yml` — existing 4×/day cron + workflow_dispatch workflow; add concurrency block, gate step, two dense cron entries here
- `pipeline/fpl_client.py` — `get_bootstrap_static()` is the bootstrap fetcher `refresh_gate.py` must call (not duplicate)
- `pipeline/tests/conftest.py` — sys.path injection pattern that `test_refresh_gate.py` must follow

### Existing Patterns to Mirror
- `pipeline/tests/test_data_health.py` — representative test file showing pytest structure, fixture helpers, bare module import style
- `pipeline/data_health.py` — example of a standalone pipeline utility (architecture reference for refresh_gate.py)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/fpl_client.get_bootstrap_static()` — browser-header requests.get with timeout=30; `refresh_gate.py` calls this directly; failure raises `requests.HTTPError` which gate catches and maps to `run=false`
- `pipeline/tests/conftest.py` — sys.path insertion pattern; `test_refresh_gate.py` inherits this automatically (no additional conftest needed)

### Established Patterns
- Bare module imports: all pipeline test files use `from module_name import ...` (not `from pipeline.module_name import ...`) — `test_refresh_gate.py` must follow this
- Pytest helper functions: `_make_*` factory functions for test data (see `test_data_health.py`) — good pattern for DGW and cold-bootstrap fixtures
- `continue-on-error: true` is NOT used anywhere in the current workflow — the `$GITHUB_OUTPUT` approach keeps this clean

### Integration Points
- `.github/workflows/pipeline.yml` job `run-pipeline` → add `id: gate` step before the existing `Run pipeline` step; add `concurrency:` block at workflow level; add two new `schedule:` cron entries under `on:`
- `pipeline/tests/` directory — `test_refresh_gate.py` drops in alongside existing test files, picked up by pytest automatically

</code_context>

<specifics>
## Specific Ideas

- YAML workflow gate step pattern (locked by D-01/D-02/D-03):
  ```yaml
  - name: Check deadline gate
    id: gate
    if: github.event_name == 'schedule'
    run: python pipeline/refresh_gate.py

  - name: Run pipeline
    if: |
      github.event_name == 'workflow_dispatch' ||
      steps.gate.outputs.run == 'true'
    run: python pipeline/run.py
  ```
- Cron entries (locked by D-04): `'0,30 8-13 * * 6,0'` and `'0,30 16-20 * * 5'`
- 6 required test cases (from ROADMAP.md SC-1/SC-5): before-window, in-window, after-window, failure-skip, DGW double-deadline, cold-bootstrap (no future events)

</specifics>

<deferred>
## Deferred Ideas

- Midweek DGW cron entries (Tue/Wed/Thu) — existing 4×/day baseline covers these at lower frequency; revisit if a midweek deadline is missed in practice
- `bypass_gate` workflow_dispatch input — not needed since manual dispatch always bypasses the gate (D-02)

</deferred>

---

*Phase: 89-Event-Aware-Pipeline-Scheduling*
*Context gathered: 2026-05-10*
