---
phase: 79
slug: insight-card-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **TS Framework** | Vitest ^4.1.2 + @testing-library/react |
| **TS Config file** | `vitest.config.ts` (jsdom global env) |
| **TS Quick run** | `npx vitest run src/components/insights/InsightsTab.test.tsx` |
| **TS Full suite** | `npm test` (vitest run) |
| **Python framework** | pytest 8.3.5 |
| **Python config** | `pipeline/tests/conftest.py` (sys.path injection) |
| **Python quick run** | `python -m pytest pipeline/tests/test_insights.py -x` |
| **Python full suite** | `python -m pytest pipeline/tests/` |
| **Estimated TS runtime** | ~15 seconds |
| **Estimated Python runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** TS — `npx vitest run src/components/insights/`; Python — `python -m pytest pipeline/tests/test_insights.py -x`
- **After every plan wave:** Both quick runs above + `python -m pytest pipeline/tests/` (full pipeline suite)
- **Before `/gsd-verify-work`:** Full suite (`npm test` AND `python -m pytest pipeline/tests/`) must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 79-01-01 | 01 | 1 | INS-01/INS-02/INS-06 | — | No dangerouslySetInnerHTML introduced | Python unit | `python -m pytest pipeline/tests/test_insights.py::test_each_insight_has_structured_fields -x` | ❌ W0 | ⬜ pending |
| 79-01-02 | 01 | 1 | INS-02 | — | signal_label is computed, not user-controlled | Python unit | `python -m pytest pipeline/tests/test_insights.py::test_signal_label_rules -x` | ❌ W0 | ⬜ pending |
| 79-01-03 | 01 | 1 | INS-06 | — | N/A | Python unit | `python -m pytest pipeline/tests/test_insights.py::test_gw_coverage_present -x` | ❌ W0 | ⬜ pending |
| 79-02-01 | 02 | 1 | INS-01 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "5 zones"` | ❌ W0 | ⬜ pending |
| 79-02-02 | 02 | 1 | INS-02 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "signal badge"` | ❌ W0 | ⬜ pending |
| 79-02-03 | 02 | 2 | INS-03 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "progress bar"` | ❌ W0 | ⬜ pending |
| 79-02-04 | 02 | 2 | INS-04 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "section structure"` | ❌ W0 | ⬜ pending |
| 79-02-05 | 02 | 2 | INS-04 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "collapsible"` | ❌ W0 | ⬜ pending |
| 79-02-06 | 02 | 2 | INS-05 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "Decision Summary"` | ❌ W0 | ⬜ pending |
| 79-02-07 | 02 | 2 | INS-06 | — | N/A | TS component | `npx vitest run src/components/insights/InsightsTab.test.tsx -t "methodology"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_insights.py` — create with stubs covering INS-01/INS-02/INS-06 (uses `pipeline/tests/conftest.py` sys.path pattern)
- [ ] Rewrite `src/components/insights/InsightsTab.test.tsx` — existing tests assert old structure (`HIGH`/`MEDIUM`/`LOW` badge text + `statement`); new fixture must use 16-field `Insight` shape
- [ ] New `Insight[]` test fixture (≥6 insights covering all 6 signal labels, all 16 fields populated)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card structure scannable in under 3 seconds | INS-01 | Perceptual latency — not automatable | Open InsightsTab, scan 3 cards, verify all 5 zones visible without scrolling within the card |
| Sticky Decision Summary stays below nav on scroll | INS-05 | Layout/visual | Scroll InsightsTab; verify panel sticks below pill nav at all scroll positions |
| `<details>` expand reveals methodology text on click | INS-06 | Browser interaction | Click `<summary>` on a card, verify "Sample: N/M · GW1–34 · Confidence: XX%" text appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
