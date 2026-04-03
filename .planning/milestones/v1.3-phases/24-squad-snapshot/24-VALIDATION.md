---
phase: 24
slug: squad-snapshot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/planning-engine.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/planning-engine.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | PLAN-06 | unit | `npx vitest run tests/lib/planning-engine.test.ts` | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | PLAN-06 | unit | `npx vitest run tests/lib/planning-engine.test.ts` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 2 | PLAN-06 | manual | browser verify | N/A | ⬜ pending |
| 24-02-02 | 02 | 2 | PLAN-06 | manual | browser verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/planning-engine.test.ts` — unit tests for `positionsAfter` in each `PlanStep`: starting XI (positions 1-11), bench (12-15), and transfer inheritance (new player inherits sold player's position)

*Existing Vitest infrastructure covers everything else — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Accordion expand/collapse in browser | PLAN-06 SC-1 | DOM interaction cannot be tested without a browser | Click ▶ in GW cell, verify squad accordion opens showing 15 players grouped by position |
| Green IN badge on transferred player | PLAN-06 SC-2 | Visual highlight requires rendering | Verify transferred-in player shows green "IN" badge |
| Bench Boost dimming removed | PLAN-06 SC-3 | Visual — opacity change | Activate Bench Boost chip, verify all 15 players show at full opacity |
| Collapsed by default | PLAN-06 SC-4 | DOM state after render | On page load after Generate Plan, verify no accordion is open |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
