---
phase: 42
slug: xpts-accuracy-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (pipeline) + vitest (frontend regression) |
| **Config file** | `pipeline/tests/conftest.py` (sys.path injection) |
| **Quick run command** | `python -m pytest pipeline/tests/test_accuracy.py pipeline/tests/test_form_signal.py -x` |
| **Full suite command** | `python -m pytest pipeline/tests/ -v` |
| **TypeScript regression** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest pipeline/tests/test_form_signal.py pipeline/tests/test_accuracy.py -x`
- **After every plan wave:** Run `python -m pytest pipeline/tests/ -v` + `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual run of `python pipeline/run.py` with sanity check of `accuracy_backtest.json` summary fields
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 0 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_form_signal.py -x` | ❌ W0 | ⬜ pending |
| 42-01-02 | 01 | 0 | ACC-02,03 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py -x` | ❌ W0 | ⬜ pending |
| 42-01-03 | 01 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_form_signal.py::test_form_signal_recency_weighting -x` | ✅ W0 | ⬜ pending |
| 42-01-04 | 01 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_form_signal.py::test_form_signal_dgw_aggregation -x` | ✅ W0 | ⬜ pending |
| 42-01-05 | 01 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_form_signal.py::test_form_signal_returns_none_when_insufficient_history -x` | ✅ W0 | ⬜ pending |
| 42-01-06 | 01 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_merge.py::test_merge_writes_form_signal -x` | ✅ W0 | ⬜ pending |
| 42-01-07 | 01 | 1 | ACC-01 | — | N/A | unit | `python -m pytest pipeline/tests/test_merge.py::test_blend_changes_xpts -x` | ✅ W0 | ⬜ pending |
| 42-02-01 | 02 | 0 | ACC-02,03,04 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py -x` | ❌ W0 | ⬜ pending |
| 42-02-02 | 02 | 1 | ACC-02 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_writes_blended_track -x` | ✅ W0 | ⬜ pending |
| 42-02-03 | 02 | 1 | ACC-02 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_form_signal_uses_strictly_prior_gws -x` | ✅ W0 | ⬜ pending |
| 42-02-04 | 02 | 1 | ACC-03 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_gate_enabled_when_blend_improves -x` | ✅ W0 | ⬜ pending |
| 42-02-05 | 02 | 1 | ACC-03 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_gate_disabled_when_blended_no_better -x` | ✅ W0 | ⬜ pending |
| 42-02-06 | 02 | 1 | ACC-03 | — | N/A | unit | `python -m pytest pipeline/tests/test_run.py::test_form_signal_gate_default_false -x` | ✅ W0 | ⬜ pending |
| 42-02-07 | 02 | 1 | ACC-04 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_mid_tier_track -x` | ✅ W0 | ⬜ pending |
| 42-02-08 | 02 | 1 | ACC-04 | — | N/A | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_mid_tier_top_n_wider -x` | ✅ W0 | ⬜ pending |
| 42-regression | — | final | — | — | N/A | unit | `npx vitest run` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_form_signal.py` — NEW file covering `_compute_form_signal` (ACC-01)
- [ ] `pipeline/tests/test_accuracy.py` — EXTEND with blended-track, gate, mid-tier, no-leak tests (ACC-02, ACC-03, ACC-04)
- [ ] `pipeline/tests/test_merge.py` — NEW or extend with blend integration tests (ACC-01 merge layer)
- [ ] `pipeline/tests/test_run.py` — NEW or extend with gate-read default test (ACC-03 run.py)

*Existing infrastructure (pytest, conftest.py sys.path injection) covers all needs. No new test framework setup required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline end-to-end: `accuracy_backtest.json` has new `xpts_blended_hit_rate` and `form_signal_gate_enabled` fields | ACC-02, ACC-03 | Cannot mock Blob/pipeline state in unit tests | Run `python pipeline/run.py`; inspect `pipeline/cache/accuracy_backtest.json summary` for new fields |
| Gate correctly falls back to baseline when form signal degrades | ACC-03 | Live data needed to confirm gate fires correctly in production run | After pipeline run: confirm `form_signal_gate_enabled` matches whether blended > baseline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
