---
phase: 10
slug: buy-hold-sell-captaincy-engines
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/recommend.test.ts tests/lib/captaincy-engine.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/recommend.test.ts tests/lib/captaincy-engine.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-W0-01 | Wave 0 | 0 | REC-01 | unit stub | `npx vitest run tests/lib/recommend.test.ts` | ❌ W0 | ⬜ pending |
| 10-W0-02 | Wave 0 | 0 | CAP-01, CAP-02 | unit stub | `npx vitest run tests/lib/captaincy-engine.test.ts` | ❌ W0 | ⬜ pending |
| 10-REC-01a | engine | 1 | REC-01 | unit | `npx vitest run tests/lib/recommend.test.ts` | ✅ W0 | ⬜ pending |
| 10-REC-01b | engine | 1 | REC-01 | unit | `npx vitest run tests/lib/recommend.test.ts` | ✅ W0 | ⬜ pending |
| 10-CAP-01 | engine | 1 | CAP-01 | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | ✅ W0 | ⬜ pending |
| 10-CAP-02 | engine | 1 | CAP-02 | unit | `npx vitest run tests/lib/captaincy-engine.test.ts` | ✅ W0 | ⬜ pending |
| 10-UI-01 | UI | 2 | REC-01, CAP-01, CAP-02 | manual | n/a | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/recommend.test.ts` — stubs for REC-01 (Buy/Hold/Sell engine)
- [ ] `tests/lib/captaincy-engine.test.ts` — stubs for CAP-01 + CAP-02 (captaincy engine)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VerdictBadge renders correct colour per label | REC-01 | No component tests in project | Load SquadView in dev, verify Buy=green, Hold=amber, Sell=red |
| CaptaincyPanel shows top-5 with safe/upside badges | CAP-01, CAP-02 | No component tests in project | Load CaptaincyPanel in dev, verify ranking order and badge labels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
