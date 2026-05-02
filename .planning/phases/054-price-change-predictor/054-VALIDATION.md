---
phase: 54
slug: price-change-predictor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Python)** | pytest (pipeline/tests/) |
| **Framework (TS/React)** | Vitest ^4.1.2 |
| **Config file (Python)** | `pipeline/tests/conftest.py` (sys.path injection) |
| **Config file (TS)** | `vitest.config.ts` (root level) |
| **Quick run command (Python)** | `cd pipeline && python -m pytest tests/test_price_changes.py -x` |
| **Quick run command (TS)** | `npm test -- --run src/components/price-changes/` |
| **Full suite command** | `cd pipeline && python -m pytest tests/ -x && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pipeline && python -m pytest tests/test_price_changes.py -x` (Python tasks) or `npm test -- --run src/components/price-changes/` (TS tasks)
- **After every plan wave:** Run full suite: `cd pipeline && python -m pytest tests/ -x && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_rise_prediction -x` | ❌ W0 | ⬜ pending |
| 54-01-02 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_fall_prediction -x` | ❌ W0 | ⬜ pending |
| 54-01-03 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_empty_bootstrap -x` | ❌ W0 | ⬜ pending |
| 54-01-04 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_confidence_clamp -x` | ❌ W0 | ⬜ pending |
| 54-01-05 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_zero_ownership_guard -x` | ❌ W0 | ⬜ pending |
| 54-01-06 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_eta_days_zero -x` | ❌ W0 | ⬜ pending |
| 54-01-07 | 01 | 1 | PRC-01 | — | N/A | unit (Python) | `pytest tests/test_price_changes.py::test_snapshot_days_count -x` | ❌ W0 | ⬜ pending |
| 54-02-01 | 02 | 2 | PRC-01 | — | N/A | unit (TS) | `npm test -- --run src/components/price-changes/` | ❌ W0 | ⬜ pending |
| 54-02-02 | 02 | 2 | PRC-01 | — | N/A | unit (TS) | `npm test -- --run src/components/price-changes/` | ❌ W0 | ⬜ pending |
| 54-02-03 | 02 | 2 | PRC-01 | — | N/A | unit (TS) | `npm test -- --run src/components/price-changes/` | ❌ W0 | ⬜ pending |
| 54-02-04 | 02 | 2 | PRC-01 | — | N/A | unit (TS) | `npm test -- --run src/components/price-changes/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_price_changes.py` — stubs/tests for 7 Python test cases (rise, fall, cold-start, confidence clamp, zero-ownership guard, eta_days zero, snapshot_days count)
- [ ] `src/components/price-changes/PriceChangePanel.test.tsx` — stubs/tests for 4 TS test cases (loading, empty state, rise-before-fall ordering, badge suppression)

*Existing test infrastructure covers all other requirements — no new conftest or framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress bar fills proportionally to confidence_pct in browser | PRC-01 | Visual rendering cannot be automated in Vitest | Load app, navigate to Analyse > Price Changes, verify bar width visually matches confidence percentage |
| "Early data" flag shown when snapshot_days < 14 | PRC-01 (SC-4) | Requires snapshot state manipulation in dev | Seed snapshot with <14 days of data, verify flag appears in panel |
| Cold-start: route returns 200 with `{ predictions: [] }` on fresh checkout | PRC-01 (SC-5) | Requires fresh environment | Delete price_changes.json, restart dev server, hit /api/price-changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
