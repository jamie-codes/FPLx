---
phase: 36
slug: navigation-consolidation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | NAV-01 | — | N/A | unit | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ W0 | ⬜ pending |
| 36-01-02 | 01 | 1 | NAV-02 | — | N/A | unit | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ W0 | ⬜ pending |
| 36-01-03 | 01 | 1 | NAV-03 | — | N/A | unit | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ W0 | ⬜ pending |
| 36-01-04 | 01 | 1 | NAV-04 | — | N/A | unit | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ W0 | ⬜ pending |
| 36-01-05 | 01 | 1 | NAV-05 | — | N/A | unit | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ W0 | ⬜ pending |
| 36-01-06 | 01 | 1 | D-05 | — | N/A | unit | `npm test -- src/app/page.test.tsx` | ❌ W0 | ⬜ pending |
| 36-01-07 | 01 | 1 | D-06 | — | N/A | unit | `npm test -- src/app/page.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/nav/MobileNav.test.tsx` — unit tests covering NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
- [ ] `src/app/page.test.tsx` — unit tests covering D-05 (section memory) and D-06 (default landing state)

*Existing test infrastructure (vitest + @testing-library/react + jsdom) is already installed. Only the test files themselves are missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop two-tier bar renders correctly | NAV-01 | Visual layout; CSS breakpoint split (`hidden sm:flex`) not testable in jsdom | Open app at sm+ breakpoint; verify section row + sub-tab row both render |
| Mobile bottom bar + pill row positioning | NAV-03 | Fixed viewport positioning not measurable in jsdom | Open app on mobile; verify both bars are fixed at bottom, pills row sits above section bar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
