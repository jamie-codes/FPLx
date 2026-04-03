---
phase: 22
slug: planning-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/planning-engine.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/planning-engine.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | PLAN-02 | unit | `npx vitest run tests/lib/planning-engine.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | PLAN-02 | unit | `npx vitest run tests/lib/planning-engine.test.ts` | ✅ | ⬜ pending |
| 22-01-03 | 01 | 1 | PLAN-02 | unit | `npx vitest run tests/lib/planning-engine.test.ts` | ✅ | ⬜ pending |
| 22-01-04 | 01 | 2 | PLAN-02 | unit | `npx vitest run tests/lib/planning-engine.test.ts` | ✅ | ⬜ pending |
| 22-02-01 | 02 | 3 | PLAN-03 | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/planning-engine.test.ts` — failing stubs for PLAN-02 (RED phase)
- [ ] `src/lib/types.ts` additions — `PlanResult`, `PlanStep`, `ScoredTransfer` types

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Generate Plan" button activates and shows results | PLAN-03 | Requires browser + real squad data | Load app with team ID set, navigate to Planner tab, click Generate Plan, verify transfer suggestions appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
