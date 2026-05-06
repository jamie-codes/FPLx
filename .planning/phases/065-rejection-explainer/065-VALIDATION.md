---
phase: 65
slug: rejection-explainer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/lib/__tests__/rejection.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (quick), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/__tests__/rejection.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Wave 0 | 01 | 0 | WHY-01/02/03 | — | N/A | unit | `npx vitest run src/lib/__tests__/rejection.test.ts` | ❌ W0 | ⬜ pending |
| computeRejection | 01 | 1 | WHY-01 | — | N/A | unit | `npx vitest run src/lib/__tests__/rejection.test.ts` | ❌ W0 | ⬜ pending |
| GemTable expand | 01 | 1 | WHY-01 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |
| HighOwnershipCallout | 02 | 1 | WHY-02 | — | N/A | unit (RTL) | `npx vitest run src/components/transfers/HighOwnershipCallout.test.tsx` | ❌ W0 | ⬜ pending |
| ExplainPanel rejection | 02 | 1 | WHY-03 | — | N/A | unit (RTL) | `npx vitest run src/components/squad/ExplainPanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/rejection.test.ts` — covers WHY-01 computeRejection (rank, positive framing, fragility delegation, ownership formatting, BGW guard)
- [ ] `src/components/transfers/HighOwnershipCallout.test.tsx` — covers WHY-02 render/empty/cap-at-3
- [ ] `src/components/squad/ExplainPanel.test.tsx` — covers WHY-03 rejectionReasons prop (section renders when non-empty, omitted when empty, position below positive reasons)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop expand row visible on GemTable | WHY-01 | CSS table-row display requires browser render | Open GemTable on desktop, click any row, confirm rejection panel appears |
| Mobile expand preserves action-sheet + hidden columns | WHY-01 | Mobile layout requires device/responsive view | Open GemTable on mobile viewport, expand row, confirm Compare/Dismiss + hidden columns present above rejection panel |
| WHY-02 callout absent when no high-ownership players absent | WHY-02 | Conditional render requires live squad data | Load a squad where all >20% players are in transfer candidates; confirm callout not rendered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
