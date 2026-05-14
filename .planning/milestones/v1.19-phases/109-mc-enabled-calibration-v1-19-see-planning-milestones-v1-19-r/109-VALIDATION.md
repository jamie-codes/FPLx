---
phase: 109
slug: mc-enabled-calibration-v1-19-see-planning-milestones-v1-19-r
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 109 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Python framework** | pytest 8.3.5 |
| **Python config** | `pipeline/tests/conftest.py` (sys.path injection) |
| **Python quick run** | `python3 -m pytest pipeline/tests/test_accuracy.py -q` |
| **Python full suite** | `python3 -m pytest pipeline/tests/ -q` |
| **TS framework** | Vitest 4.1.2 |
| **TS config** | `vitest.config.ts` (jsdom, `@` alias) |
| **TS quick run** | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` |
| **TS full suite** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (Python) + ~10 seconds (TS) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the affected file (Python or TS as appropriate)
- **After every plan wave:** Run full Python suite + full Vitest suite
- **Before `/gsd-verify-work`:** Both full suites must be green
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 109-01-01 | 01 | 0 | MC-CAL-01 | — | N/A | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -k "calibration_mode or mc_path or analytical_fallback or missing_haul_prob or coverage_threshold" -x` | ❌ W0 | ⬜ pending |
| 109-01-02 | 01 | 0 | MC-CAL-02 | — | N/A | unit | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | ❌ W0 | ⬜ pending |
| 109-01-03 | 01 | 1 | MC-CAL-01 | — | N/A | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -q` | ✅ | ⬜ pending |
| 109-01-04 | 01 | 1 | MC-CAL-01 | — | N/A | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -q` | ✅ | ⬜ pending |
| 109-02-01 | 02 | 2 | MC-CAL-02 | — | N/A | unit | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Python (pipeline/tests/test_accuracy.py):**
- [ ] `test_calibration_mode_mc_written_to_summary` — covers MC-CAL-01 (mode field in summary)
- [ ] `test_calibration_mc_path_predicted_rate` — covers MC-CAL-01 (predicted_rate = mean haul_prob)
- [ ] `test_calibration_mc_path_sort_order` — covers MC-CAL-01 (sort by haul_prob not xpts)
- [ ] `test_calibration_analytical_fallback_when_mc_disabled` — covers MC-CAL-01 (fallback path)
- [ ] `test_calibration_mc_coverage_threshold` — covers MC-CAL-01 (80% gate)
- [ ] `test_calibration_missing_haul_prob_defaults_zero` — covers MC-CAL-01 (graceful degradation D-06)
- [ ] `test_calibration_mode_analytical_when_coverage_below_threshold` — covers MC-CAL-01

**TypeScript (src/components/squad/CalibrationHealthIndicator.test.tsx):**
- [ ] `renders MC badge in teal when calibration_mode is mc` — covers MC-CAL-02
- [ ] `renders Analytical badge in zinc when calibration_mode is analytical` — covers MC-CAL-02
- [ ] `mode badge absent when calibration_mode is undefined` — covers MC-CAL-02 (legacy cache compat)
- [ ] `mode badge not rendered in cold-start branch` — covers MC-CAL-02
- [ ] `maxDeviation uses predicted_rate not bucket_mid` — covers D-11 bug fix

*(Existing 34 Python + 9 TS tests remain green — no regressions expected)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CalibrationHealthIndicator renders correct badge label in browser | MC-CAL-02 | Visual rendering in Decision Summary tab | Open Decision Summary tab, confirm badge shows `MC` (teal) or `Analytical` (zinc) adjacent to tier badge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
