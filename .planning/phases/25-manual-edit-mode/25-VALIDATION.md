---
phase: 25
slug: manual-edit-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | PLAN-04 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | PLAN-04 | unit | `npx vitest run --reporter=verbose` | ✅ | ⬜ pending |
| 25-01-03 | 01 | 1 | PLAN-04 | unit | `npx vitest run --reporter=verbose` | ✅ | ⬜ pending |
| 25-02-01 | 02 | 1 | PLAN-04 | unit | `npx vitest run --reporter=verbose` | ✅ | ⬜ pending |
| 25-02-02 | 02 | 1 | PLAN-04 | unit | `npx vitest run --reporter=verbose` | ✅ | ⬜ pending |
| 25-02-03 | 02 | 2 | PLAN-04 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/planning-engine-rescore.test.ts` — stubs for re-score from step X+1 (PLAN-04)
- [ ] `src/components/planner/__tests__/PlayerPickerModal.test.tsx` — stubs for modal open/close/search (PLAN-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Player picker opens centered on screen, dismisses with Escape and backdrop click | PLAN-04 | DOM dialog behavior requires browser interaction | Open planner, click ✏ icon on a transfer row, verify modal opens; press Escape to close; click outside modal to close |
| Switching back to Suggested restores engine's original recommendation | PLAN-04 | End-to-end state flow across re-score cycles | After manual pick, click ↺ icon; verify player reverts to original suggestion and subsequent steps re-score to original |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
