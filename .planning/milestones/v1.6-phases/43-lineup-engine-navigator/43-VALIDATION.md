---
phase: 43
slug: lineup-engine-navigator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TypeScript engine), jest/RTL (React components) |
| **Config file** | `vitest.config.ts` / `jest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/optimise-lineup.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/optimise-lineup.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 0 | OPT-01 | — | N/A | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-02 | 01 | 0 | OPT-02 | — | N/A | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-03 | 01 | 0 | OPT-03 | — | N/A | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-04 | 01 | 0 | OPT-04 | — | N/A | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-05 | 01 | 0 | OPT-05 | — | N/A | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | ❌ W0 | ⬜ pending |
| 43-02-01 | 02 | 1 | NAV-01 | — | N/A | integration | `npx vitest run src/app/page.test.tsx` | ✅ | ⬜ pending |
| 43-02-02 | 02 | 1 | NAV-01 | — | N/A | integration | `npx vitest run src/components/nav/MobileNav.test.tsx` | ✅ | ⬜ pending |
| 43-03-01 | 03 | 2 | OPT-01,OPT-02 | — | N/A | component | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/optimise-lineup.test.ts` — RED stubs for OPT-01 through OPT-05 (engine unit tests)
- [ ] `src/components/optimiser/OptimiserPanel.test.tsx` — RED stubs for OPT-01 and OPT-02 (pitch UI component tests)

*Existing `page.test.tsx` and `MobileNav.test.tsx` cover NAV-01 — no new Wave 0 files needed for those.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pitch visual layout (GK bottom, FWD top, bench row) | OPT-01 | CSS layout requires visual inspection | Open Squad > Optimiser, load a team, verify pitch orientation and formation label |
| BGW amber warning banner | OPT-05 | Requires a live BGW scenario | Can be tested by zeroing xPts_1gw on >4 players in mock picks |
| Sub-tab pill row on mobile (Squad section) | NAV-01 | Mobile layout requires device/devtools | Use Chrome DevTools mobile simulation, navigate to Squad section, verify 2 pills |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
