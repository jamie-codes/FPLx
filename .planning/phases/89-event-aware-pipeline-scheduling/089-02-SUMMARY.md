---
phase: 89-event-aware-pipeline-scheduling
plan: 02
subsystem: pipeline
tags: [pipeline, github-actions, refresh_gate, tdd, green-gate, cron, concurrency]

# Dependency graph
requires:
  - phase: 89-01
    provides: 8-case RED test contract for check_deadline_window() + main()
provides:
  - pipeline/refresh_gate.py: check_deadline_window() + main() implementation
  - .github/workflows/pipeline.yml: 3 cron entries + concurrency block + gate step
affects:
  - GitHub Actions: reduced Actions minutes burn on non-deadline days
  - Vercel Blob: concurrency block prevents write races between concurrent runs

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deadline window math: filter future events, select nearest, compare delta to window"
    - "GitHub Actions gate pattern: gate step conditional on schedule trigger only (D-02)"
    - "Dense cron + guard script: GitHub Actions best practice for pseudo-event-driven scheduling"
    - "Workflow-level concurrency cancel-in-progress: prevents Vercel Blob write races"

key-files:
  created:
    - pipeline/refresh_gate.py
  modified:
    - .github/workflows/pipeline.yml

key-decisions:
  - "D-01: $GITHUB_OUTPUT signal pattern used (not sys.exit codes) for inter-step communication"
  - "D-02: gate step conditional on github.event_name == 'schedule' so workflow_dispatch always bypasses gate"
  - "D-03: canonical OR if-condition on Run pipeline step: workflow_dispatch || steps.gate.outputs.run == 'true'"
  - "D-04: two new dense cron entries added (Sat/Sun 0,30 8-13; Fri 0,30 16-20)"
  - "D-05: baseline 0 6,12,18,0 * * * preserved unchanged (additive change)"
  - "D-06: workflow-level concurrency block (not job-level) with cancel-in-progress: true"
  - "D-07: refresh_gate.py imports from fpl_client only, no run/merge/accuracy/simulate etc imports"
  - "D-08: nearest-future-deadline selection via min() over filtered future events list"

# Metrics
duration: 15min
completed: 2026-05-10
---

# Phase 89 Plan 02: Event-Aware Pipeline Scheduling Summary

**Implement `pipeline/refresh_gate.py` (turns 8 RED tests GREEN) and update `.github/workflows/pipeline.yml` with dense cron entries, workflow-level concurrency block, and gate step — satisfying REFRESH-01 SC-1 through SC-5**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-10
- **Tasks:** 2 (Task 3 is checkpoint:human-verify — awaiting UAT)
- **Files modified:** 2

## Accomplishments

### Task 1: pipeline/refresh_gate.py (GREEN gate)
- Created `pipeline/refresh_gate.py` turning all 8 RED tests GREEN (8/8 pass)
- `check_deadline_window(events, now, window_minutes) -> bool` with correct deadline math
- Defensive tzinfo guard for naive ISO strings: `if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)`
- `PIPELINE_DEADLINE_WINDOW_MINUTES` env var with default 90 when unset
- `_write_output(run: bool)` is a no-op when `GITHUB_OUTPUT` is not set (safe for local pytest)
- `main()` catches all exceptions, writes `run=false`, always returns without raising (Pitfall 2)
- Isolation rule D-07 confirmed: zero imports from run/merge/accuracy/simulate/insights/etc
- 181 total pipeline tests pass (no regression)

### Task 2: .github/workflows/pipeline.yml (cron + gate + concurrency)
- Workflow-level `concurrency: { group: pipeline, cancel-in-progress: true }` (D-06) — placed at top level, not inside `jobs:`
- Baseline cron `0 6,12,18,0 * * *` preserved unchanged (D-05)
- Two new dense cron entries added (D-04):
  - `0,30 8-13 * * 6,0` — Sat/Sun 08:00-13:30 UTC (covers weekend FPL deadlines)
  - `0,30 16-20 * * 5` — Fri 16:00-20:30 UTC (early-kick / Cup rounds)
- `Check deadline gate` step with `id: gate` and `if: github.event_name == 'schedule'` (D-01, D-02)
- `Run pipeline` step updated to canonical OR condition (D-03): `workflow_dispatch || steps.gate.outputs.run == 'true'`
- Maintenance comment block above schedule entries documenting each cron's purpose
- YAML parses cleanly; structural assertions pass

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create pipeline/refresh_gate.py (GREEN) | d0a3504 | pipeline/refresh_gate.py (NEW) |
| 2 | Update pipeline.yml | 9d719d8 | .github/workflows/pipeline.yml (MODIFIED) |

## Decisions Implemented

- **D-01** ($GITHUB_OUTPUT signal): gate writes `run=true\n` or `run=false\n` to GITHUB_OUTPUT file
- **D-02** (gate skipped on workflow_dispatch): `if: github.event_name == 'schedule'` on gate step
- **D-03** (canonical OR if-condition): `workflow_dispatch || steps.gate.outputs.run == 'true'` on Run pipeline step
- **D-04** (two new cron entries): Sat/Sun 0,30 8-13 and Fri 0,30 16-20 added
- **D-05** (baseline preserved): `0 6,12,18,0 * * *` unchanged
- **D-06** (workflow-level concurrency): `concurrency: { group: pipeline, cancel-in-progress: true }` at YAML root
- **D-07** (no run.py import): refresh_gate.py imports only from fpl_client; isolation rule verified
- **D-08** (nearest-future-deadline selection): `nearest = min(future)` after filtering past events

## Success Criteria Status

- [x] **SC-1** (Window math): 8 pytest cases (before/in/after/DGW/cold/naive-ISO/failure) all pass
- [x] **SC-2** (Dense cron + gate guard): 3 cron entries; gate step runs before pipeline on every schedule trigger
- [x] **SC-3** (Concurrency): `concurrency: { group: pipeline, cancel-in-progress: true }` at workflow level
- [x] **SC-4** (Baseline preserved): `0 6,12,18,0 * * *` unchanged
- [x] **SC-5** (Failure-skip): HTTP exception -> `run=false` confirmed by `test_failure_skip_main`
- [ ] **Manual UAT** (Task 3 checkpoint): awaiting user verification in GitHub Actions UI

## Deviations from Plan

None — plan executed exactly as written. Implementation content matches the plan's `<action>` blocks verbatim.

## Known Stubs

None. All logic is fully wired.

## Threat Surface Scan

No new threat surface introduced beyond what is already documented in the plan's `<threat_model>`. The two files modified (refresh_gate.py and pipeline.yml) match exactly the threat register entries T-89-04 through T-89-12. Mitigations applied:
- T-89-05: Only `run=true|false\n` written to GITHUB_OUTPUT — no user-controlled interpolation
- T-89-10: Gate does not read/write secrets, does not shell out
- T-89-11: Defensive tzinfo guard included and covered by test
- T-89-12: Workflow-level concurrency block prevents Vercel Blob write races

## Manual UAT Outcome (Task 3)

Awaiting — Task 3 is checkpoint:human-verify. See how-to-verify in 089-02-PLAN.md for the 5-step UAT procedure.

---

## Self-Check: PASSED

Files exist:
- FOUND: pipeline/refresh_gate.py
- FOUND: .github/workflows/pipeline.yml

Commits exist:
- FOUND: d0a3504 (feat(89-02): create pipeline/refresh_gate.py turning all 8 RED tests GREEN)
- FOUND: 9d719d8 (feat(89-02): update pipeline.yml with cron entries, gate step, and concurrency block)

*Phase: 89-event-aware-pipeline-scheduling*
*Completed: 2026-05-10*
