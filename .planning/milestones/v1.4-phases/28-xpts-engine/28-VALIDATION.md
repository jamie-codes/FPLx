---
phase: 28
slug: xpts-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/lib/xpts-engine.test.ts tests/components/gem-table/XPtsCell.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/xpts-engine.test.ts tests/components/gem-table/XPtsCell.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green (254+ tests)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 0 | DATA-02 | — | N/A | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 0 | XPTS-01 / XPTS-02 | — | N/A | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 1 | DATA-02 | — | Input clamped via max()/min() | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | ✅ W0 | ⬜ pending |
| 28-01-04 | 01 | 1 | DATA-02 | — | N/A | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | ✅ W0 | ⬜ pending |
| 28-02-01 | 02 | 2 | XPTS-01 | — | N/A | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | ✅ W0 | ⬜ pending |
| 28-02-02 | 02 | 2 | XPTS-02 | — | N/A | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/xpts-engine.test.ts` — stubs for DATA-02 (xPts model math, DGW/BGW logic, double-count guard, ceiling flag), XPTS-02 (top-tercile σ classification)
- [ ] `tests/components/gem-table/XPtsCell.test.tsx` — stubs for XPTS-01 (cell rendering, breakdown tooltip), XPTS-02 (VarianceBadge ⬆/= rendering)

*(Existing 22-file, 254-test infrastructure covers all other phase requirements.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| xPts cell tooltip shows correct component breakdown on hover (desktop) | XPTS-01 | Visual tooltip interaction | Open GemTable in browser, hover xPts cell — confirm goal_pts / assist_pts / cs_pts / bonus_pts shown |
| VarianceBadge ⬆ tooltip explains high-ceiling meaning | XPTS-02 | Tooltip copywriting | Hover ⬆ badge — confirm tooltip text matches UI-SPEC copywriting contract |
| Mobile: xPts cell renders cleanly with badge inline | XPTS-01 / XPTS-02 | Responsive layout | Open GemTable on mobile viewport — confirm badge does not overflow cell |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
