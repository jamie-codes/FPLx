---
phase: 4
slug: defcon-analysis
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/lib/defcon.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/defcon.test.ts --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DEF-01 | unit | `npx vitest run tests/lib/fpl-adapter.test.ts` | Yes | pending |
| 04-01-02 | 01 | 1 | DEF-01, DEF-02, DEF-03 | import | `python -c "from pipeline.defcon import compute_defcon_stats"` | No — W0 | pending |
| 04-02-01 | 02 | 1 | DEF-01, DEF-02, DEF-03, DEF-04 | unit | `npx vitest run tests/lib/defcon.test.ts` | No — W0 | pending |
| 04-03-01 | 03 | 2 | DEF-04, UIX-01, UIX-02 | build | `npx next build` | N/A | pending |
| 04-03-02 | 03 | 2 | DEF-04, UIX-01, UIX-02 | build | `npx next build` | N/A | pending |
| 04-03-03 | 03 | 2 | DEF-04, UIX-01, UIX-02 | manual | Visual verification | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/defcon.test.ts` — stubs for DEF-01, DEF-02, DEF-03, DEF-04 (created by Plan 02 TDD)
- [ ] Update `tests/fixtures/bootstrap-static-sample.json` — rename `defensive_contributions` to `defensive_contribution`, add `defensive_contribution_per_90` (created by Plan 01 Task 1)
- [ ] Update `tests/lib/fpl-adapter.test.ts` — rename field references (created by Plan 01 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two separate tables render visually distinct | DEF-04 | Visual layout verification | Click DefCon tab, confirm two headed sections |
| Sort indicators and re-ordering | UIX-02 | Interactive DOM behavior | Click column headers, observe row reorder |
| Distance color coding (green/red) | DEF-02 | CSS visual check | Inspect distance column for color classes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
