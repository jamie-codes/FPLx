---
phase: 57
slug: effective-ownership-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + React Testing Library 16.3.2 |
| **Config file** | `vitest.config.ts` (jsdom environment) |
| **Quick run command** | `npx vitest run src/components/captaincy/ src/lib/eo-candidates.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/captaincy/ src/lib/eo-candidates.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| EO-01 display | 01 | 1 | EO-01 | N/A | unit/RTL | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ❌ W0 | ⬜ pending |
| EO-01 parseFloat | 01 | 1 | EO-01 | N/A | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ W0 | ⬜ pending |
| EO-02 toggle renders | 01 | 1 | EO-02 | N/A | unit/RTL | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ❌ W0 | ⬜ pending |
| EO-02 max xpts sort | 01 | 1 | EO-02 | N/A | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ W0 | ⬜ pending |
| EO-02 protect rank sort | 01 | 1 | EO-02 | N/A | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ W0 | ⬜ pending |
| EO-02 chase rank sort | 01 | 1 | EO-02 | N/A | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ W0 | ⬜ pending |
| EO-02 differential sort | 01 | 1 | EO-02 | N/A | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ W0 | ⬜ pending |
| EO-03 badge authenticated | 01 | 1 | EO-03 | N/A | unit/RTL | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ❌ W0 | ⬜ pending |
| EO-03 badge unauthenticated | 01 | 1 | EO-03 | N/A | unit | `npx vitest run src/lib/eo-candidates.test.ts` | ❌ W0 | ⬜ pending |
| EO-04 mode isolation | 01 | 1 | EO-04 | N/A | integration | Manual — no shared state to break | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/eo-candidates.test.ts` — stubs for EO-01, EO-02 sort logic, EO-03 badge logic
- [ ] `src/components/captaincy/CaptainPicksPanel.test.tsx` — stubs for EO-01 display, EO-02 toggle, EO-03 badge visibility

*Existing infrastructure (Vitest + RTL) is already installed — Wave 0 only needs test file stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mode toggle does not affect Transfer suggestions or Decision Summary rendering | EO-04 | No shared state to assert in unit tests | Switch modes in the captain panel; verify Transfer and Decision Summary panels are unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
