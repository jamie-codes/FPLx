---
phase: 44
slug: comparison-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.2 + @testing-library/react |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | CMP-01 | — | N/A | unit | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ✅ requires rewrite | ⬜ pending |
| 44-01-02 | 01 | 1 | CMP-02 | — | N/A | unit | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ✅ requires rewrite | ⬜ pending |
| 44-01-03 | 01 | 1 | CMP-03 | — | N/A | unit | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ✅ requires rewrite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- `src/components/optimiser/OptimiserPanel.test.tsx` already exists with 13 passing tests
- Existing `makeValidSquad()` and `makePlayer()` test helpers are reused
- No new test infrastructure needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile card stacking at < 640px viewport | CMP-03 | CSS responsive breakpoint not testable in JSDOM | Open browser at 375px width; verify current/optimised stack vertically per row |
| Green left border visible on changed rows | CMP-01 | CSS border rendering not testable in JSDOM | Visual check in browser; changed rows must show 2px green left border |
| HeadlineRow: singular "player" vs plural "players" | CMP-02 | Edge case in copy | Test with 1 change and 2+ changes; verify singular/plural |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
