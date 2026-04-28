---
phase: 33
slug: insights-tab
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 0 | INS-01/02/03 | — | N/A | unit | `npx vitest run src/components/insights/InsightsTab.test.ts` | ❌ Wave 0 | ⬜ pending |
| 33-01-02 | 01 | 1 | INS-01 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |
| 33-01-03 | 01 | 1 | INS-02 | — | N/A | unit | `npx vitest run src/components/insights/InsightsTab.test.ts` | ❌ Wave 0 | ⬜ pending |
| 33-02-01 | 02 | 2 | INS-04 | — | N/A | manual | Run `python pipeline/run.py` and inspect `pipeline/cache/insights.json` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/insights/InsightsTab.test.ts` — render smoke test + tier badge label assertions for INS-01, INS-02, INS-03

*Note: Vitest infrastructure already present (`vitest.config.ts` exists). Only the new test file needs creating.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trivially obvious statements excluded | INS-04 | Pipeline-computed exclusion list — no UI assertion possible | Run `python pipeline/run.py`, open `pipeline/cache/insights.json`, verify no patterns like "bench players score fewer points" appear |
| Insight statements are non-trivial and FPL-relevant | INS-03 | Content quality judgment | Read generated `insights.json`, verify at least one pattern per category, all non-obvious |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
