# Phase 89: Event-Aware Pipeline Scheduling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 89-event-aware-pipeline-scheduling
**Areas discussed:** Gate signal mechanism, Cron granularity & day coverage, workflow_dispatch gate bypass

---

## Gate Signal Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| $GITHUB_OUTPUT boolean | Gate writes `run=true/false` to $GITHUB_OUTPUT, always exits 0. Pipeline step uses `if: steps.gate.outputs.run == 'true'`. No continue-on-error needed. | ✓ |
| Exit codes + continue-on-error | exit(0) = skip, exit(1) = proceed. Gate step has `continue-on-error: true`, pipeline step uses `if: steps.gate.outcome == 'failure'`. Matches ROADMAP "exits with status 0 (skip)" wording but semantically backwards. | |

**User's choice:** $GITHUB_OUTPUT boolean
**Notes:** Clean GitHub Actions idiom. Gate step always succeeds — the output variable carries the decision, not the exit code.

---

## Cron Granularity & Day Coverage

### Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| 30-minute intervals | Fires every 30 min during GW window hours. Gate handles precise 90-min logic. Reasonable Actions spend. | ✓ |
| 15-minute intervals | Finer resolution, enters window sooner. 2× the Actions runs but each is <1 min if gate skips. | |

### Day Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Fri/Sat/Sun only | Covers the vast majority of FPL deadlines. Existing 4×/day baseline still refreshes on midweek DGW days. | ✓ |
| Add Tue/Wed/Thu midweek window | Adds `0,30 18-21 * * 2,3,4` for DGW midweek deadlines like GW33/GW36. | |

**User's choice:** 30-minute intervals, Fri/Sat/Sun only
**Notes:** Specific entries locked: `'0,30 8-13 * * 6,0'` (Sat/Sun 8am–1:30pm UTC) and `'0,30 16-20 * * 5'` (Fri 4pm–8:30pm UTC).

---

## workflow_dispatch Gate Bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Always bypass gate | Gate step only runs on `schedule` events. `workflow_dispatch` always runs full pipeline. Correct for debugging. | ✓ |
| Optional bypass_gate input | `workflow_dispatch` input `bypass_gate: true` (default). More flexible but more complex YAML. | |
| Respect gate always | Manual dispatch also goes through gate. Consistent but can't force a run outside a window. | |

**User's choice:** Always bypass gate
**Notes:** Gate step has `if: github.event_name == 'schedule'`. Pipeline step condition: `github.event_name == 'workflow_dispatch' || steps.gate.outputs.run == 'true'`.

---

## Claude's Discretion

- Python datetime handling: `datetime.fromisoformat()` + `datetime.now(timezone.utc)` for UTC-aware comparison
- `PIPELINE_DEADLINE_WINDOW_MINUTES` default: `int(os.getenv('PIPELINE_DEADLINE_WINDOW_MINUTES', '90'))`
- Test mocking strategy: `now` parameter injected into gate function (avoids patching); HTTP errors via `unittest.mock.patch` on `fpl_client.get_bootstrap_static`
- DGW next-deadline selection: filter future events, sort ascending, pick nearest

## Deferred Ideas

- Midweek DGW cron entries (Tue/Wed/Thu) — existing 4×/day baseline covers these at lower frequency; revisit if a midweek deadline is missed in practice
- `bypass_gate` workflow_dispatch input — not needed given always-bypass decision
