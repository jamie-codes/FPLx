---
phase: 91
slug: calibration-charts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 91 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Python)** | pytest |
| **Framework (TS)** | vitest 4.1.2 + @testing-library/react + jsdom |
| **Config file (Python)** | pytest.ini / pyproject.toml (already present) |
| **Config file (TS)** | vitest.config.ts (already present) |
| **Quick run command** | `pytest pipeline/tests/test_accuracy.py -x -k calibration && npx vitest run src/components/accuracy/AccuracyTab.test.tsx` |
| **Full suite command** | `pytest pipeline/tests/ && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest pipeline/tests/test_accuracy.py -x -k calibration && npx vitest run src/components/accuracy/AccuracyTab.test.tsx`
- **After every plan wave:** Run `pytest pipeline/tests/test_accuracy.py && npx vitest run src/components/accuracy/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 091-01-01 | 01 | 0 | CAL-01 | — | N/A | unit (pytest) | `pytest pipeline/tests/test_accuracy.py -x -k calibration` | ⚠️ Wave 0 extend | ⬜ pending |
| 091-01-02 | 01 | 0 | CAL-01 | — | N/A | component (vitest) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ⚠️ Wave 0 extend | ⬜ pending |
| 091-02-01 | 02 | 1 | CAL-01 | — | N/A | unit (pytest) | `pytest pipeline/tests/test_accuracy.py -x -k calibration` | ✅ (green after Wave 1) | ⬜ pending |
| 091-03-01 | 03 | 1 | CAL-01 | — | N/A | unit (vitest) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ✅ (green after Wave 1) | ⬜ pending |
| 091-04-01 | 04 | 2 | CAL-01 | — | null-guarded tooltip; empty-state overlay prevents crash on malformed cache | component (vitest) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` | ✅ (green after Wave 2) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_accuracy.py` — add ≥2 new test functions for `predicted_mean`/`actual_mean` coverage; extend `test_calibration_structure` to assert new keys present and are floats; cover: decile bucketing math, by-position structure, sparse-filter, 5-GW window, sample_n integrity, cold-start absence
- [ ] `src/components/accuracy/AccuracyTab.test.tsx` — add `fixtureWithXptsMeans` fixture (or extend `fixtureWithVersionsAndCalibration`); add ≥5 RED test cases: xPts chart container renders, legacy-cache filter, heading copy "Predicted vs Actual xPts", single-selector both charts, empty-state overlay

*No framework install required — both pytest and vitest are present and configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| y=x diagonal renders geometrically correct in light + dark mode | CAL-01 | Visual correctness requires visual inspection; recharts DOM output is not easily inspectable in Vitest | Run `npm run dev`, navigate to AccuracyTab, enable calibration feature; inspect that dashed diagonal runs from origin to top-right; toggle dark mode |
| Tooltip deviation sign convention (positive = under-prediction) | CAL-01 | Requires live data or fixture with known values | Hover a dot above the diagonal; verify tooltip shows positive deviation (actual > predicted) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
