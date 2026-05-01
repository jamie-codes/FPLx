---
phase: 39
slug: player-comparison-modal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (jsdom environment, `@` alias) |
| **Quick run command** | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 0 | CMP-01 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ W0 | ⬜ pending |
| 39-01-02 | 01 | 0 | CMP-02 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ W0 | ⬜ pending |
| 39-01-03 | 01 | 0 | CMP-03 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ W0 | ⬜ pending |
| 39-01-04 | 01 | 0 | CMP-04 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ W0 | ⬜ pending |
| 39-01-05 | 01 | 0 | CMP-05 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ W0 | ⬜ pending |
| 39-01-06 | 01 | 0 | CMP-06 | — | N/A | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/gem-table/PlayerComparisonModal.test.tsx` — stubs for CMP-01 through CMP-06

*Existing vitest + RTL infrastructure covers the framework setup. Only the test file stub is new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hover-reveal compare icon visible on desktop row hover | CMP-01 | CSS hover states not testable in jsdom | Open app, hover a GemTable row, confirm ⊞ icon appears on player name cell |
| Mobile tap → mini action sheet appears | CMP-01 | Touch events + mobile viewport require real device or Playwright | Open app on mobile, tap player name, confirm "Compare" action sheet |
| Backdrop click closes modal | CMP-02 | jsdom `<dialog>` doesn't fully support showModal() | Open modal, click outside dialog area, confirm it closes |
| Escape key closes modal | CMP-02 | jsdom keyboard event limitations | Open modal, press Escape, confirm it closes |
| Two-column layout on desktop | CMP-03–06 | CSS responsive layout not verifiable in jsdom | Open modal on desktop ≥ 768px, confirm side-by-side column layout |
| Single-column stacked layout on mobile | CMP-03–06 | Viewport-dependent CSS | Open modal on mobile, confirm Player A block above Player B block |
| Player B search auto-focuses | CMP-02 | Focus management in jsdom unreliable | Open modal, confirm cursor is in Player B search field immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
