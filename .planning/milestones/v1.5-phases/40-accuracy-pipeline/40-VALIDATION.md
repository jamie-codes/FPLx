---
phase: 40
slug: accuracy-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.5 (Python unit tests) |
| **Config file** | None — run from project root with `python -m pytest pipeline/tests/` |
| **Quick run command** | `python -m pytest pipeline/tests/test_accuracy.py -x` |
| **Full suite command** | `python -m pytest pipeline/tests/ -x && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest pipeline/tests/test_accuracy.py -x`
- **After every plan wave:** Run `python -m pytest pipeline/tests/ -x && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 0 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py -x` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_structure -x` | ❌ W0 | ⬜ pending |
| 40-02-02 | 02 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_haulter_detection -x` | ❌ W0 | ⬜ pending |
| 40-02-03 | 02 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_xpts_reconstruction -x` | ❌ W0 | ⬜ pending |
| 40-02-04 | 02 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_proj_pts_reconstruction -x` | ❌ W0 | ⬜ pending |
| 40-02-05 | 02 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_hit_rate_computation -x` | ❌ W0 | ⬜ pending |
| 40-02-06 | 02 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_dgw_aggregation -x` | ❌ W0 | ⬜ pending |
| 40-03-01 | 03 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_snapshot_format -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/__init__.py` — make tests discoverable as package
- [ ] `pipeline/tests/test_accuracy.py` — unit tests for `compute_accuracy_backtest()` and `build_predictions_snapshot()`

*Framework install: Not needed — pytest 8.3.5 already available.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `accuracy_backtest.json` written to `pipeline/cache/` and Vercel Blob | ACC-01 | Requires live pipeline run with real FPL data | Run `python pipeline/run.py`, check `pipeline/cache/accuracy_backtest.json` exists and contains valid JSON with `gws_covered`, `summary`, `haulters`, `players` keys |
| `predictions_snapshot.json` written with current GW players | ACC-01 | Requires live pipeline run | Run `python pipeline/run.py`, check `pipeline/cache/predictions_snapshot.json` has correct GW number and player list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
