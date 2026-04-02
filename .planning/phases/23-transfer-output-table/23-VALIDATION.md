---
phase: 23
slug: transfer-output-table
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/components/TransferPlanTable.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/components/TransferPlanTable.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 0 | PLAN-05 | unit | `npx vitest run tests/components/TransferPlanTable.test.tsx` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | PLAN-05 | unit | `npx vitest run tests/components/TransferPlanTable.test.tsx` | ✅ | ⬜ pending |
| 23-01-03 | 01 | 1 | PLAN-07 | unit | `npx vitest run tests/components/TransferPlanTable.test.tsx` | ✅ | ⬜ pending |
| 23-02-01 | 02 | 2 | PLAN-05, PLAN-07 | integration | `npx vitest run && npx next build 2>&1 | tail -5` | ✅ | ⬜ pending |
| 23-02-02 | 02 | 2 | PLAN-05, PLAN-07 | manual | human-verify checkpoint | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/TransferPlanTable.test.tsx` — stubs for PLAN-05 (table rows, DGW/BGW labels) and PLAN-07 (chip toggle)

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table renders in browser with correct layout | PLAN-05 | Requires visual inspection | Run dev server, open Planner tab, generate a plan, verify table appears with correct columns and row-per-GW layout |
| Chip toggle interaction works | PLAN-07 | Requires click interaction | Click chip toggles for each GW, verify state updates correctly in the table |
| DGW/BGW badges visually correct | PLAN-05 | Requires colour verification | Confirm violet DGW badge, amber BGW badge per UI-SPEC |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
